const API_BASE =
  (import.meta.env?.VITE_API_URL as string) || 'http://127.0.0.1:8000';

function adminAuthHeader() {
  const t = localStorage.getItem('admin_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.headers || {}),
      ...adminAuthHeader(),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    const next = encodeURIComponent(
      window.location.pathname + window.location.search
    );
    window.location.href = `/admin/login?next=${next}`;
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

export async function adminGetJson(path: string) {
  return request(path);
}

export async function adminPostJson(path: string, body?: any) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function adminPutJson(path: string, body?: any) {
  return request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function adminDelJson(path: string) {
  return request(path, { method: 'DELETE' });
}




