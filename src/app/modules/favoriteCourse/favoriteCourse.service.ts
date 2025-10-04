import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createFavoriteCourseIntoDb = async (userId: string, data: any) => {

  const existingFavoriteCourse = await prisma.favoriteCourse.findFirst({ 
    where: {
      courseId: data.courseId,
      userId: userId,
    }
  }); 
  if (existingFavoriteCourse) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteCourse already exists');
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

const getFavoriteCourseListFromDb = async (userId: string) => {
  
    const result = await prisma.favoriteCourse.findMany({
      where: {
        userId: userId,
      },
    });
    if (result.length === 0) {
    return { message: 'No favoriteCourse found' };
  }
    return result;
};

const getFavoriteCourseByIdFromDb = async (userId: string, favoriteCourseId: string) => {
  
    const result = await prisma.favoriteCourse.findUnique({ 
    where: {
      id: favoriteCourseId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'favoriteCourse not found');
  }
    return result;
  };



const updateFavoriteCourseIntoDb = async (userId: string, favoriteCourseId: string, data: any) => {
  
    const result = await prisma.favoriteCourse.update({
      where:  {
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

const deleteFavoriteCourseItemFromDb = async (userId: string, favoriteCourseId: string) => {
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