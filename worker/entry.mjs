import { WorkerEntrypoint } from 'cloudflare:workers';
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
