import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createCourseIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.course.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'course not created');
  }
    return result;
};

const getCourseListFromDb = async (userId: string) => {
  
    const result = await prisma.course.findMany();
    if (result.length === 0) {
    return { message: 'No course found' };
  }
    return result;
};

const getCourseByIdFromDb = async (userId: string, courseId: string) => {
  
    const result = await prisma.course.findUnique({ 
    where: {
      id: courseId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'course not found');
  }
    return result;
  };



const updateCourseIntoDb = async (userId: string, courseId: string, data: any) => {
  
    const result = await prisma.course.update({
      where:  {
        id: courseId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'courseId, not updated');
  }
    return result;
  };

const deleteCourseItemFromDb = async (userId: string, courseId: string) => {
    const deletedItem = await prisma.course.delete({
      where: {
      id: courseId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'courseId, not deleted');
  }

    return deletedItem;
  };

export const courseService = {
createCourseIntoDb,
getCourseListFromDb,
getCourseByIdFromDb,
updateCourseIntoDb,
deleteCourseItemFromDb,
};