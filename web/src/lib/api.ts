import { getToken, clearAuth } from './auth';

export const API_BASE =
  (import.meta.env?.VITE_API_URL as string) || 'http://127.0.0.1:8000';

function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Accept': 'application/json', ...(init.headers || {}), ...authHeader() },
  });
  if (res.status === 401) {
    clearAuth();
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

export async function getJson(path: string) { return request(path); }
export async function postJson(path: string, body?: any) {
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                         body: body !== undefined ? JSON.stringify(body) : undefined });
}
export async function delJson(path: string) { return request(path, { method: 'DELETE' }); }
