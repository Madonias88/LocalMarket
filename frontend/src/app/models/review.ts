export interface Review {
  _id: string;
  businessId: string;
  userName: string;
  rating: number;
  comment: string;
  approved: boolean;
  createdAt: string;
}

/** Respuesta pública de GET /reviews/:businessId. */
export interface ReviewsSummary {
  reviews: Review[];
  count: number;
  average: number;
}