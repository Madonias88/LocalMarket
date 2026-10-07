import { Injectable, signal } from '@angular/core';

const FAV_KEY = 'lm_favs';

/** Negocios marcados como favoritos por el visitante (persistencia local, sin cuenta necesaria). */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  readonly ids = signal<string[]>(this.load());

  private load(): string[] {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  isFav(id: string | null | undefined): boolean {
    return !!id && this.ids().includes(id);
  }

  toggle(id: string | null | undefined): boolean {
    if (!id) return false;
    const has = this.isFav(id);
    const next = has ? this.ids().filter((i) => i !== id) : [...this.ids(), id];
    this.ids.set(next);
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
    return !has;
  }
}