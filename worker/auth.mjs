import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwksCache = new Map();

function allowedEmails(env) {
  return new Set(String(env.ACCESS_ALLOWED_EMAILS || '')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function accessToken(request) {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function jwksFor(teamDomain) {
  if (!jwksCache.has(teamDomain)) {
    jwksCache.set(teamDomain, createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
    ));
  }
  return jwksCache.get(teamDomain);
}

export async function authenticate(request, env) {
  if (env.ENVIRONMENT === 'local-test') {
    const host = new URL(request.url).hostname;
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) throw new Error('local-test-loopback-required');
    return { sub: 'qa-local-principal', email: 'qa@local.invalid', source: 'local-test' };
  }
  const token = accessToken(request);
  if (!token) throw new Error('access-token-required');
  const teamDomain = String(env.ACCESS_TEAM_DOMAIN || '').trim();
  const audience = String(env.ACCESS_AUD || '').trim();
  if (!teamDomain || !audience) throw new Error('access-config-missing');
  const issuer = `https://${teamDomain}`;
  const { payload } = await jwtVerify(token, jwksFor(teamDomain), {
    issuer,
    audience,
  });
  const email = String(payload.email || '').toLowerCase();
  const allowed = allowedEmails(env);
  if (!payload.sub || !email || !allowed.has(email)) throw new Error('access-principal-denied');
  return { sub: String(payload.sub), email, source: 'cloudflare-access' };
}

export function principalId(principal) {
  return `${encodeURIComponent(principal.sub)}|${encodeURIComponent(principal.email)}`;
}
