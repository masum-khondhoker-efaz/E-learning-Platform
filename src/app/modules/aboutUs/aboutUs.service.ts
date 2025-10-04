import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createAboutUsIntoDb = async (userId: string, data: any) => {
  // check if there is any previous aboutUs
  const existingAboutUs = await prisma.aboutUs.findFirst();
  if (existingAboutUs) {
    throw new AppError(httpStatus.CONFLICT, 'aboutUs already exists');
  }

  const result = await prisma.aboutUs.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'aboutUs not created');
  }
  return result;
};

const getAboutUsListFromDb = async () => {
  const result = await prisma.aboutUs.findFirst();
  if (!result) {
    return { message: 'No aboutUs found' };
  }
  return result;
};

const getAboutUsByIdFromDb = async (userId: string, aboutUsId: string) => {
  const result = await prisma.aboutUs.findUnique({
    where: {
      id: aboutUsId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'aboutUs not found');
  }
  return result;
};

const updateAboutUsIntoDb = async (
  userId: string,
  aboutUsId: string,
  data: any,
) => {
  const result = await prisma.aboutUs.update({
    where: {
      id: aboutUsId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'aboutUsId, not updated');
  }
  return result;
};

const deleteAboutUsItemFromDb = async (userId: string, aboutUsId: string) => {
  const deletedItem = await prisma.aboutUs.delete({
    where: {
      id: aboutUsId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'aboutUsId, not deleted');
  }

  return deletedItem;
};

export const aboutUsService = {
  createAboutUsIntoDb,
  getAboutUsListFromDb,
  getAboutUsByIdFromDb,
  updateAboutUsIntoDb,
  deleteAboutUsItemFromDb,
};
