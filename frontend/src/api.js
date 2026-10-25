const BASE = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : window.location.origin);
const HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'family-lottery' };

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + '/api' + path, { method, headers: HEADERS, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your internet and try again.'); }
  if (res.ok && res.headers.get('content-type')?.includes('text/csv')) return res.blob();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error?.code, data.error?.message || 'Something went wrong.');
  return data;
}
export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  patch: (p, b) => request('PATCH', p, b || {}),
  blob: (p) => request('GET', p),
};
export const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '');
