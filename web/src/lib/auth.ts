export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

export interface User {
  id: number;
  name: string;
  email: string;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: any) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser<T = any>(): T | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

// 👇 Compatibility export for older code that imported this
export function isAuthenticated(): boolean {
  return !!getToken();
}
