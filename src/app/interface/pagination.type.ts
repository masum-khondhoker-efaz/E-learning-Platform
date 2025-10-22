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
  userId?: string;
  status?: string;
  dateOfBirth?: string;
  role?: string;
  fullName?: string;
  email?: string;
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
  // Support specific filters
  subject?: string;
  message?: string;
  userEmail?: string;
  userName?: string;
  companyName?: string;
  startDate?: string;
  endDate?: string;
  paymentStatus?: string;
  passingScoreMin?: number;
  passingScoreMax?: number;
  totalMarksMin?: number;
  totalMarksMax?: number;
  timeLimitMin?: number;
  timeLimitMax?: number;
  isPublished?: boolean;
  isPassed?: boolean;
  scoreMin?: number;
  scoreMax?: number;
  percentageMin?: number;
  percentageMax?: number;
  userPhone?: string;
  // Learning history specific filters
  isCompleted?: boolean;
  progressMin?: number;
  progressMax?: number;
  companyEmail?: string;
  companyAddress?: string;
}
