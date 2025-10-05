import prisma from '../../utils/prisma';
import {
  InPersonTrainingStatus,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createInPersonTrainingIntoDb = async (userId: string, data: any) => {
  const existingInPersonTraining = await prisma.inPersonTraining.findFirst({
    where: {
      courseId: data.courseId,
      userId: userId,
    },
  });
  if (existingInPersonTraining) {
    return { message: 'InPersonTraining for this course already exists' };
  }

  const result = await prisma.inPersonTraining.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'inPersonTraining not created');
  }
  return result;
};

const getInPersonTrainingListFromDb = async (userId: string) => {
  const result = await prisma.inPersonTraining.findMany();
  if (result.length === 0) {
    return { message: 'No inPersonTraining found' };
  }
  return result;
};

const getInPersonTrainingByIdFromDb = async (
  userId: string,
  inPersonTrainingId: string,
) => {
  const result = await prisma.inPersonTraining.findUnique({
    where: {
      id: inPersonTrainingId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'inPersonTraining not found');
  }
  return result;
};

const getMyInPersonTrainingRequestFromDb = async (userId: string) => {
  console.log('userId:', userId);
  const result = await prisma.inPersonTraining.findMany({
    where: {
      userId: userId,
      status: InPersonTrainingStatus.PENDING,
    },
  });
  if (result.length === 0) {
    return { message: 'No inPersonTrainings found for this user' };
  }
  return result;
};

const getMyInPersonTrainingRequestByIdFromDb = async (
  userId: string,
  inPersonTrainingId: string,
) => {
  const result = await prisma.inPersonTraining.findFirst({
    where: {
      id: inPersonTrainingId,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'InPersonTraining not found for this user',
    );
  }
  return result;
};

const getMyInPersonTrainingsFromDb = async (userId: string) => {
  const result = await prisma.inPersonTraining.findMany({
    where: {
      userId: userId,
      status:
        InPersonTrainingStatus.CONFIRMED || InPersonTrainingStatus.COMPLETED,
    },
  });
  if (result.length === 0) {
    return { message: 'No inPersonTrainings found for this user' };
  }
  return result;
};

const getMyInPersonTrainingByIdFromDb = async (
  userId: string,
  inPersonTrainingId: string,
) => {
  const result = await prisma.inPersonTraining.findFirst({
    where: {
      id: inPersonTrainingId,
      userId: userId,
      status:
        InPersonTrainingStatus.CONFIRMED || InPersonTrainingStatus.COMPLETED,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'InPersonTraining not found for this user',
    );
  }
  return result;
};

const updateInPersonTrainingIntoDb = async (
  userId: string,
  inPersonTrainingId: string,
  data: any,
) => {
  const findExistingInPersonTraining = await prisma.inPersonTraining.findUnique(
    {
      where: {
        id: inPersonTrainingId,
      },
    },
  );
  if (!findExistingInPersonTraining) {
    throw new AppError(httpStatus.NOT_FOUND, 'inPersonTraining not found');
  }

  // Only allow update if status is PENDING
  if (findExistingInPersonTraining.status !== InPersonTrainingStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only PENDING inPersonTrainings can be updated',
    );
  }

  // Proceed with the update

  const result = await prisma.inPersonTraining.update({
    where: {
      id: inPersonTrainingId,
      status: InPersonTrainingStatus.PENDING,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'inPersonTrainingId, not updated',
    );
  }
  return result;
};

const deleteInPersonTrainingItemFromDb = async (
  userId: string,
  inPersonTrainingId: string,
) => {
  const existingItem = await prisma.inPersonTraining.findUnique({
    where: {
      id: inPersonTrainingId,
    },
  });
  if (!existingItem) {
    throw new AppError(httpStatus.NOT_FOUND, 'inPersonTraining not found');
  }
  const deletedItem = await prisma.inPersonTraining.delete({
    where: {
      id: inPersonTrainingId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'inPersonTrainingId, not deleted',
    );
  }

  return deletedItem;
};

export const inPersonTrainingService = {
  createInPersonTrainingIntoDb,
  getInPersonTrainingListFromDb,
  getInPersonTrainingByIdFromDb,
  getMyInPersonTrainingRequestFromDb,
  getMyInPersonTrainingRequestByIdFromDb,
  getMyInPersonTrainingsFromDb,
  getMyInPersonTrainingByIdFromDb,
  updateInPersonTrainingIntoDb,
  deleteInPersonTrainingItemFromDb,
};
