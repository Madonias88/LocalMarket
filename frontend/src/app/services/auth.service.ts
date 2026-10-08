import { Injectable, signal } from '@angular/core';

export interface SessionUser {
  token: string;
  username: string;
  role: 'admin' | 'owner';
  businessId?: string;
  name?: string;
  email?: string;
}

const TOKEN_KEY = 'lm_admin_token';
const SESSION_KEY = 'lm_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly stored: SessionUser | null = (() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  })();

  readonly authed = signal(!!this.stored);
  readonly user = signal<SessionUser | null>(this.stored);

  /** Guarda token (para la API) y la sesion (rol, negocio vinculado, etc.). */
  setSession(session: SessionUser) {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.authed.set(true);
    this.user.set(session);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    this.authed.set(false);
    this.user.set(null);
  }
}