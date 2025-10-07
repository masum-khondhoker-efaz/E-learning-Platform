import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


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

const getCategoryListFromDb = async (userId: string) => {
  
    const result = await prisma.category.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (result.length === 0) {
    return { message: 'No category found' };
  }
    return result;
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