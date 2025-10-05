import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { 
  buildSearchQuery, 
  buildFilterQuery, 
  combineQueries 
} from '../../utils/searchFilter';
import { 
  calculatePagination, 
  formatPaginationResponse, 
  getPaginationQuery 
} from '../../utils/pagination';

const createFavoriteCourseIntoDb = async (userId: string, data: any) => {
  const existingFavoriteCourse = await prisma.favoriteCourse.findFirst({
    where: {
      courseId: data.courseId,
      userId: userId,
    },
  });
  if (existingFavoriteCourse) {
    return { message: 'Course already in favorite list' };
  }

  const result = await prisma.favoriteCourse.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteCourse not created');
  }
  return result;
};


const getFavoriteCourseListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for course fields
  const searchFields = [
    'course.courseTitle',
    'course.courseShortDescription',
    'course.instructorName',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    userId: userId, // Always filter by the current user
    ...(options.courseLevel && { 
      course: { courseLevel: options.courseLevel } 
    }),
    ...(options.categoryName && { 
      course: { 
        category: { name: options.categoryName } 
      } 
    }),
    ...(options.certificate !== undefined && { 
      course: { certificate: options.certificate } 
    }),
    ...(options.lifetimeAccess !== undefined && { 
      course: { lifetimeAccess: options.lifetimeAccess } 
    }),
    ...(options.instructorName && { 
      course: { instructorName: options.instructorName } 
    }),
  };
  
  // Handle price range filters
  if (options.priceMin !== undefined || options.priceMax !== undefined) {
    filterFields.course = {
      ...filterFields.course,
      price: {
        ...(options.priceMin !== undefined && { gte: Number(options.priceMin) }),
        ...(options.priceMax !== undefined && { lte: Number(options.priceMax) }),
      },
    };
  }

  const filterQuery = buildFilterQuery(filterFields);

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.favoriteCourse.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const favoriteCourses = await prisma.favoriteCourse.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      course: {
        select: {
          id: true,
          courseTitle: true,
          courseShortDescription: true,
          courseLevel: true,
          price: true,
          discountPrice: true,
          instructorName: true,
          instructorImage: true,
          courseThumbnail: true,
          certificate: true,
          lifetimeAccess: true,
          createdAt: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return formatPaginationResponse(favoriteCourses, total, page, limit);
};

const getFavoriteCourseByIdFromDb = async (
  userId: string,
  favoriteCourseId: string,
) => {
  const result = await prisma.favoriteCourse.findUnique({
    where: {
      id: favoriteCourseId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'favoriteCourse not found');
  }
  return result;
};

const updateFavoriteCourseIntoDb = async (
  userId: string,
  favoriteCourseId: string,
  data: any,
) => {
  const result = await prisma.favoriteCourse.update({
    where: {
      id: favoriteCourseId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteCourseId, not updated');
  }
  return result;
};

const deleteFavoriteCourseItemFromDb = async (
  userId: string,
  favoriteCourseId: string,
) => {
  const existingItem = await prisma.favoriteCourse.findUnique({
    where: {
      id: favoriteCourseId,
    },
  });
  if (!existingItem) {
    throw new AppError(httpStatus.NOT_FOUND, 'favoriteCourse not found');
  }
  const deletedItem = await prisma.favoriteCourse.delete({
    where: {
      id: favoriteCourseId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteCourseId, not deleted');
  }

  return deletedItem;
};

export const favoriteCourseService = {
  createFavoriteCourseIntoDb,
  getFavoriteCourseListFromDb,
  getFavoriteCourseByIdFromDb,
  updateFavoriteCourseIntoDb,
  deleteFavoriteCourseItemFromDb,
};
