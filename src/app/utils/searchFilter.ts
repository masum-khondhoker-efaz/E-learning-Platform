export interface ISearchOptions {
  searchTerm?: string;
  searchFields?: string[];
}

export interface IFilterOptions {
  [key: string]: any;
}

export interface IDateRangeFilter {
  startDate?: string | Date;
  endDate?: string | Date;
  dateField?: string;
}

export const buildSearchQuery = (options: ISearchOptions) => {
  const { searchTerm, searchFields } = options;

  if (!searchTerm || !searchFields || searchFields.length === 0) {
    return {};
  }

  return {
    OR: searchFields.map((field) => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive' as const,
      },
    })),
  };
};

export const buildFilterQuery = (filters: IFilterOptions) => {
  const whereClause: any = {};

  Object.keys(filters).forEach((key) => {
    const value = filters[key];
    
    if (value !== undefined && value !== null && value !== '') {
      // Handle array filters (for multiple selections)
      if (Array.isArray(value) && value.length > 0) {
        whereClause[key] = {
          in: value,
        };
      }
      // Handle boolean filters
      else if (typeof value === 'boolean') {
        whereClause[key] = value;
      }
      // Handle string/number filters
      else {
        whereClause[key] = value;
      }
    }
  });

  return whereClause;
};

export const buildDateRangeQuery = (options: IDateRangeFilter) => {
  const { startDate, endDate, dateField = 'createdAt' } = options;
  
  if (!startDate && !endDate) {
    return {};
  }

  const dateQuery: any = {};

  if (startDate) {
    dateQuery.gte = new Date(startDate);
  }

  if (endDate) {
    dateQuery.lte = new Date(endDate);
  }

  return {
    [dateField]: dateQuery,
  };
};

export const combineQueries = (...queries: any[]) => {
  const combinedQuery: any = {};
  
  queries.forEach((query) => {
    if (query && Object.keys(query).length > 0) {
      Object.assign(combinedQuery, query);
    }
  });

  return combinedQuery;
};

export const buildCompleteQuery = (
  searchOptions?: ISearchOptions,
  filterOptions?: IFilterOptions,
  dateRangeOptions?: IDateRangeFilter
) => {
  const searchQuery = searchOptions ? buildSearchQuery(searchOptions) : {};
  const filterQuery = filterOptions ? buildFilterQuery(filterOptions) : {};
  const dateQuery = dateRangeOptions ? buildDateRangeQuery(dateRangeOptions) : {};

  const combinedFilters = combineQueries(filterQuery, dateQuery);
  
  if (Object.keys(searchQuery).length > 0 && Object.keys(combinedFilters).length > 0) {
    return {
      AND: [searchQuery, combinedFilters],
    };
  }

  return combineQueries(searchQuery, combinedFilters);
};

// Utility for handling numeric range filters
export const buildNumericRangeQuery = (
  field: string,
  min?: number,
  max?: number
) => {
  if (min === undefined && max === undefined) {
    return {};
  }

  const rangeQuery: any = {};

  if (min !== undefined) {
    rangeQuery.gte = min;
  }

  if (max !== undefined) {
    rangeQuery.lte = max;
  }

  return {
    [field]: rangeQuery,
  };
};

// Utility for handling enum filters
export const buildEnumQuery = (field: string, values?: string[]) => {
  if (!values || values.length === 0) {
    return {};
  }

  return {
    [field]: {
      in: values,
    },
  };
};