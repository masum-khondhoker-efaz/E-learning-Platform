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
  startDate?: string | Date;
  endDate?: string | Date;
  dateField?: string;
  status?: string;
  type?: string;
  isActive?: string;
  salaryMin?: string;
  salaryMax?: string;
  experienceYears?: string;
  experienceRequired?: string;
  isVerified?: boolean;
  role?: string;
  isSuperAdmin?: boolean | string;
  saloonOwnerId?: string;
  priceMin?: string;
  priceMax?: string;
  jobPostId?: string;
}