import { DEVICE_ROUTES, deviceBearer, readSmsBody, smsJSON } from './sms.mjs';

// This public Worker has no customer/calendar binding and no owner routes.
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (!Object.hasOwn(DEVICE_ROUTES, url.pathname) || DEVICE_ROUTES[url.pathname] !== request.method || url.search) return smsJSON({ error: 'sms-device-route-denied' }, 404);
      const token = deviceBearer(request);
      const body = request.method === 'POST' ? await readSmsBody(request) : null;
      if (!env.SMS_STUDIO?.deviceRequest) return smsJSON({ error: 'sms-relay-unavailable' }, 503);
      const result = await env.SMS_STUDIO.deviceRequest({ path: url.pathname, method: request.method, token, body });
      return smsJSON(result.body, result.status);
    } catch (e) { return smsJSON({ error: e.status ? e.message : 'sms-relay-unavailable' }, e.status || 503); }
  },
};
