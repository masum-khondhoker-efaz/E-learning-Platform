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

const createCategoryIntoDb = async (userId: string, data: any) => {

  const existingCategory = await prisma.category.findFirst({
    where: {
      name: data.name,
    },
  });
  if (existingCategory) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Category with this name already exists');
  }
  
    const result = await prisma.category.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'category not created');
  }
    return result;
};



const getCategoryListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build the complete where clause manually
  const whereQuery: any = {};

  // Add search conditions
  if (options.searchTerm) {
    whereQuery.OR = [
      {
        name: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
      {
        description: {
          contains: options.searchTerm,
          mode: 'insensitive' as const,
        },
      },
    ];
  }

  // Add specific name filter (if you want exact name matching)
  if (options.categoryName) {
    whereQuery.name = {
      contains: options.categoryName,
      mode: 'insensitive' as const,
    };
  }

  // Sorting
  const orderBy = {
    [sortBy]: sortOrder,
  };

  // Fetch total count for pagination
  const total = await prisma.category.count({ where: whereQuery });

  if (total === 0) {
    return formatPaginationResponse([], 0, page, limit);
  }

  // Fetch paginated data
  const categories = await prisma.category.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      // Include course count for each category
      _count: {
        select: {
          Course: true,
        },
      },
    },
  });

  // Transform data to include course count
  const transformedCategories = categories.map(category => ({
    id: category.id,
    name: category.name,
    userId: category.userId,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    courseCount: category._count.Course,
  }));

  return formatPaginationResponse(transformedCategories, total, page, limit);
};

const getCategoryByIdFromDb = async (userId: string, categoryId: string) => {
  
    const result = await prisma.category.findUnique({ 
    where: {
      id: categoryId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'category not found');
  }
    return result;
  };



const updateCategoryIntoDb = async (userId: string, categoryId: string, data: any) => {

  const existingCategory = await prisma.category.findFirst({
    where: {
      id: { not: categoryId },
      name: data.name,
    },
  });
  if (existingCategory) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Category with this name already exists');
  }
  
    const result = await prisma.category.update({
      where:  {
        id: categoryId,
        // userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'categoryId, not updated');
  }
    return result;
  };

const deleteCategoryItemFromDb = async (userId: string, categoryId: string) => {


  const existingCategory = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
  });
  if (!existingCategory) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }

  const findCoursesWithCategory = await prisma.course.findFirst({
    where: {
      categoryId: categoryId,
    },
  });
  if (findCoursesWithCategory) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cannot delete category with associated courses');
  }

    const deletedItem = await prisma.category.delete({
      where: {
      id: categoryId,
      // userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'categoryId, not deleted');
  }

    return deletedItem;
  };

export const categoryService = {
createCategoryIntoDb,
getCategoryListFromDb,
getCategoryByIdFromDb,
updateCategoryIntoDb,
deleteCategoryItemFromDb,
};