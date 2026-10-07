export interface LoginResponse {
  token: string;
  username: string;
  role: 'admin' | 'owner';
  businessId?: string;
  name?: string;
}