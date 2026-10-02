import { WorkerEntrypoint } from 'cloudflare:workers';
import { DEVICE_ROUTES, SMS_BODY_LIMIT } from './sms.mjs';
export { default, StudioState } from './index.mjs';

// Only a service binding can select this entrypoint. Default fetch remains Access-protected.
export class BookingIntake extends WorkerEntrypoint {
  async create(input) {
    const stub=this.env.STUDIO.get(this.env.STUDIO.idFromName(String(this.env.STUDIO_NAMESPACE||'vocal-studio')));
    try{
      const body=JSON.stringify(input);
      if(new TextEncoder().encode(body).length>16384)return {status:413,body:{success:false,code:'PAYLOAD_TOO_LARGE'}};
      const response=await stub.fetch(new Request('https://studio.internal/booking',{method:'POST',headers:{'content-type':'application/json'},body}));
      return {status:response.status,body:await response.json(),retryAfter:response.headers.get('Retry-After')};
    }catch{return {status:503,body:{success:false,code:'STUDIO_UNAVAILABLE',message:'접수 결과를 확인하지 못했습니다. 잠시 뒤 다시 시도해주세요.'}};}
  }
}

// Narrow private RPC; bearer validation is repeated inside the canonical DO.
export class SmsRelay extends WorkerEntrypoint {
  async deviceRequest(input) {
    try {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['path', 'method', 'token', 'body'].includes(k)) ||
          !Object.hasOwn(DEVICE_ROUTES, input.path) || input.method !== DEVICE_ROUTES[input.path] || typeof input.token !== 'string' ||
          !/^vssms_[A-Za-z0-9_-]{43}$/.test(input.token)) return { status: 400, body: { error: 'sms-invalid-rpc' } };
      if (input.method === 'GET' && input.body != null) return { status: 400, body: { error: 'sms-invalid-rpc' } };
      const body = input.method === 'POST' ? JSON.stringify(input.body) : undefined;
      if (body !== undefined && new TextEncoder().encode(body).length > SMS_BODY_LIMIT) return { status: 413, body: { error: 'sms-body-too-large' } };
      const stub = this.env.STUDIO.get(this.env.STUDIO.idFromName(String(this.env.STUDIO_NAMESPACE || 'vocal-studio')));
      const response = await stub.fetch(new Request('https://studio.internal' + input.path.replace('/device/', '/sms-device/'), {
        method: input.method, headers: { 'Authorization': 'Bearer ' + input.token, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body }),
      }));
      return { status: response.status, body: await response.json() };
    } catch { return { status: 503, body: { error: 'sms-relay-unavailable' } }; }
  }
}
