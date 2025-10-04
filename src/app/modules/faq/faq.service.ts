import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { calculatePagination, formatPaginationResponse, getPaginationQuery } from '../../utils/pagination';
import { buildFilterQuery, buildSearchQuery, combineQueries } from '../../utils/searchFilter';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createFaqIntoDb = async (userId: string, data: any) => {

  const findExisting = await prisma.faq.findFirst({
    where: {
      question: data.question,
    },
  });
  if (findExisting) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Faq already exists');
  }

  const result = await prisma.faq.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'faq not created');
  }
  return result;
};

const getFaqListFromDb = async (options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query
  const searchFields = [
    'question',
    'answer',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query - FAQs might not have many filters, but you can add if needed
  const filterFields: Record<string, any> = {
    // Add any FAQ-specific filters here if needed
    // For example: ...(options.category && { category: options.category }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.faq.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }
   // Fetch paginated data
  const faqs = await prisma.faq.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      question: true,
      answer: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return formatPaginationResponse(faqs, total, page, limit);
};


const getFaqByIdFromDb = async (faqId: string) => {
  const result = await prisma.faq.findUnique({
    where: {
      id: faqId,
    },
  });
  if (!result) {
    return { message: 'Faq not found' };
  }
  return result;
};

const updateFaqIntoDb = async (userId: string, faqId: string, data: any) => {
  const result = await prisma.faq.update({
    where: {
      id: faqId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'faqId, not updated');
  }
  return result;
};

const deleteFaqItemFromDb = async (userId: string, faqId: string) => {
  const deletedItem = await prisma.faq.delete({
    where: {
      id: faqId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'faqId, not deleted');
  }

  return deletedItem;
};

export const faqService = {
  createFaqIntoDb,
  getFaqListFromDb,
  getFaqByIdFromDb,
  updateFaqIntoDb,
  deleteFaqItemFromDb,
};
