export interface CategoryCount {
  _id: string;
  count: number;
}

export interface Stats {
  total: number;
  active: number;
  inactive: number;
  featured: number;
  pendingReviews: number;
  owners: number;
  byCategory: CategoryCount[];
  zones: CategoryCount[];
}