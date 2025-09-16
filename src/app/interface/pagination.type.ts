export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginationResult {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface IPaginationResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ISearchAndFilterOptions extends IPaginationOptions {
  searchTerm?: string;
  searchFields?: string[];
  filters?: Record<string, any>;
  courseTitle?: string;
  courseShortDescription?: string;
  courseDescription?: string;
  courseLevel?: string;
  categoryName?: string;
  certificate?: boolean;
  lifetimeAccess?: boolean;
  priceMin?: number;
  priceMax?: number;
  discountPriceMin?: number;
  discountPriceMax?: number;
  instructorName?: string;
  instructorDesignation?: string;
  rating?: number;  
}