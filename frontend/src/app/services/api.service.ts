import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import type { Business } from '../models/business';
import type { Category } from '../models/category';
import type { Review, ReviewsSummary } from '../models/review';
import type { LoginResponse } from '../models/auth';
import type { Stats } from '../models/stats';

const API_URL = environment.apiUrl;

/** Respuesta de subida/borrado de fotos (multer). */
export interface PhotoResult {
  photoUrls: string[];
  business: Business;
}

// Los campos de edicion vienen de formularios locales (admin y mi-negocio),
// no del modelo `Business` completo, asi que el body se deja abierto.
export type BusinessEditBody = Record<string, unknown>;

/**
 * Parámetros de la lista pública. Se traducen en el backend a operadores de
 * consulta de MongoDB: $gte/$lte (rating), $in (precio), $eq (destacado,
 * verificado), $exists+$ne (promoción), $size/$not (fotos) y $or de $regex
 * (búsqueda de texto).
 */
export interface BusinessParams {
  category?: string;
  zone?: string;
  q?: string;
  includeInactive?: boolean;
  ratingMin?: number;
  ratingMax?: number;
  price?: string; // lista separada por comas, p. ej. "$,$$"
  featured?: boolean;
  verified?: boolean;
  promo?: boolean;
  photos?: boolean;
  fotos?: number; // cantidad exacta de fotos ($size)
  delivery?: boolean; // solo negocios que ofrecen envío a domicilio
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  token(): string | null {
    return localStorage.getItem('lm_admin_token');
  }

  private headers(admin = false): HttpHeaders {
    let h = new HttpHeaders();
    if (admin) h = h.set('Authorization', `Bearer ${this.token()}`);
    return h;
  }

  // --- publico ---
  categories() {
    return this.http.get<Category[]>(`${API_URL}/categories`);
  }

  /** Zonas disponibles (público): agregación con $group+$sum hecha en MongoDB. */
  zones() {
    return this.http.get<{ _id: string; count: number }[]>(`${API_URL}/businesses/zones`);
  }

  businesses(params?: BusinessParams) {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.zone) qs.set('zone', params.zone);
    if (params?.q) qs.set('q', params.q);
    if (params?.includeInactive) qs.set('includeInactive', '1');
    if (params?.ratingMin !== undefined) qs.set('ratingMin', String(params.ratingMin));
    if (params?.ratingMax !== undefined) qs.set('ratingMax', String(params.ratingMax));
    if (params?.price) qs.set('price', params.price);
    if (params?.featured) qs.set('featured', '1');
    if (params?.verified) qs.set('verified', '1');
    if (params?.promo) qs.set('promo', '1');
    if (params?.photos) qs.set('photos', '1');
    if (params?.fotos !== undefined) qs.set('fotos', String(params.fotos));
    if (params?.delivery) qs.set('delivery', '1');
    const suffix = qs.size ? `?${qs}` : '';
    return this.http.get<Business[]>(`${API_URL}/businesses${suffix}`);
  }

  business(id: string, includeInactive = false) {
    const qs = includeInactive ? '?includeInactive=1' : '';
    return this.http.get<Business>(`${API_URL}/businesses/${id}${qs}`);
  }

  // --- resenas ---
  reviews(businessId: string) {
    return this.http.get<ReviewsSummary>(`${API_URL}/reviews/${businessId}`);
  }

  submitReview(businessId: string, body: { userName: string; rating: number; comment: string }) {
    return this.http.post<Review>(`${API_URL}/reviews/${businessId}`, body);
  }

  adminReviews(params?: { businessId?: string; status?: 'pending' | 'approved' }) {
    const qs = new URLSearchParams();
    if (params?.businessId) qs.set('businessId', params.businessId);
    if (params?.status) qs.set('status', params.status);
    const suffix = qs.size ? `?${qs}` : '';
    return this.http.get<Review[]>(`${API_URL}/reviews/admin/list${suffix}`, {
      headers: this.headers(true),
    });
  }

  setReviewApproved(id: string, approved: boolean) {
    return this.http.put<Review>(`${API_URL}/reviews/${id}`, { approved }, { headers: this.headers(true) });
  }

  deleteReview(id: string) {
    return this.http.delete<{ message: string }>(`${API_URL}/reviews/${id}`, { headers: this.headers(true) });
  }

  // --- admin ---
  stats() {
    return this.http.get<Stats>(`${API_URL}/businesses/stats`, {
      headers: this.headers(true),
    });
  }

  login(username: string, password: string) {
    return this.http.post<LoginResponse>(`${API_URL}/auth/login`, {
      username,
      password,
    });
  }

  /** Registro público de un negocio: queda en revisión (pendiente de aprobación). */
  registerBusiness(body: BusinessEditBody) {
    return this.http.post<{ message: string; business: Business }>(
      `${API_URL}/businesses/register`,
      body
    );
  }

  /** Aprobar una solicitud pendiente: publica el negocio y habilita al dueño. */
  approveBusiness(id: string) {
    return this.http.post<{ message: string; business: Business }>(
      `${API_URL}/businesses/${id}/approve`,
      null,
      { headers: this.headers(true) }
    );
  }

  /** Rechazar una solicitud pendiente: elimina el negocio y la cuenta del dueño. */
  rejectBusiness(id: string) {
    return this.http.post<{ message: string }>(
      `${API_URL}/businesses/${id}/reject`,
      null,
      { headers: this.headers(true) }
    );
  }

  createBusiness(body: BusinessEditBody) {
    return this.http.post<Business>(`${API_URL}/businesses`, body, {
      headers: this.headers(true),
    });
  }

  updateBusiness(id: string, body: BusinessEditBody) {
    return this.http.put<Business>(`${API_URL}/businesses/${id}`, body, {
      headers: this.headers(true),
    });
  }

  deleteBusiness(id: string) {
    return this.http.delete<{ message: string }>(`${API_URL}/businesses/${id}`, {
      headers: this.headers(true),
    });
  }

  // --- fotos (multer) ---
  uploadPhoto(businessId: string, file: File) {
    const fd = new FormData();
    fd.append('photos', file, file.name);
    return this.http.post<PhotoResult>(`${API_URL}/businesses/${businessId}/photos`, fd, {
      headers: this.headers(true),
    });
  }

  removePhoto(businessId: string, url: string) {
    return this.http.request<PhotoResult>(
      'delete',
      `${API_URL}/businesses/${businessId}/photos`,
      { headers: this.headers(true), body: { url } }
    );
  }
}