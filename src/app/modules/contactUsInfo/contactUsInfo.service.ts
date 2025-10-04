import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createContactUsInfoIntoDb = async (userId: string, data: any) => {

  console.log("data in service", data);
  const existingContactUsInfo = await prisma.contactUsInfo.findFirst();
  if (existingContactUsInfo) {
    throw new AppError(httpStatus.BAD_REQUEST, 'contactUsInfo already exists');
  }

  const result = await prisma.contactUsInfo.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'contactUsInfo not created');
  }
  return result;
};

const getContactUsInfoListFromDb = async () => {
  const result = await prisma.contactUsInfo.findFirst();
  if (!result) {
    return { message: 'No contactUsInfo found' };
  }
  return result;
};

const getContactUsInfoByIdFromDb = async (
  userId: string,
  contactUsInfoId: string,
) => {
  const result = await prisma.contactUsInfo.findUnique({
    where: {
      id: contactUsInfoId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'contactUsInfo not found');
  }
  return result;
};

const updateContactUsInfoIntoDb = async (
  userId: string,
  contactUsInfoId: string,
  data: any,
) => {
  const findExisting = await prisma.contactUsInfo.findUnique({
    where: {
      id: contactUsInfoId,
    },
  });
  if (!findExisting) {
    throw new AppError(httpStatus.BAD_REQUEST, 'contactUsInfo not found');
  }
  const result = await prisma.contactUsInfo.update({
    where: {
      id: contactUsInfoId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'contactUsInfoId, not updated');
  }
  return result;
};

const deleteContactUsInfoItemFromDb = async (
  userId: string,
  contactUsInfoId: string,
) => {
  const deletedItem = await prisma.contactUsInfo.delete({
    where: {
      id: contactUsInfoId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'contactUsInfoId, not deleted');
  }

  return deletedItem;
};

export const contactUsInfoService = {
  createContactUsInfoIntoDb,
  getContactUsInfoListFromDb,
  getContactUsInfoByIdFromDb,
  updateContactUsInfoIntoDb,
  deleteContactUsInfoItemFromDb,
};
