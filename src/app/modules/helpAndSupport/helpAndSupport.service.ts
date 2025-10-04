import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createHelpAndSupportIntoDb = async (userId: string, data: any) => {

  // check if there is any previous helpAndSupport
  const existingHelpAndSupport = await prisma.helpAndSupport.findFirst();
  if (existingHelpAndSupport) {
    throw new AppError(httpStatus.CONFLICT, 'helpAndSupport already exists');
  }
  
    const result = await prisma.helpAndSupport.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'helpAndSupport not created');
  }
    return result;
};

const getHelpAndSupportListFromDb = async () => {
  
    const result = await prisma.helpAndSupport.findFirst();
    if (!result) {
    return { message: 'No helpAndSupport found' };
  }
    return result;
};

const getHelpAndSupportByIdFromDb = async (userId: string, helpAndSupportId: string) => {
  
    const result = await prisma.helpAndSupport.findUnique({ 
    where: {
      id: helpAndSupportId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'helpAndSupport not found');
  }
    return result;
  };



const updateHelpAndSupportIntoDb = async (userId: string, helpAndSupportId: string, data: any) => {
  
    const result = await prisma.helpAndSupport.update({
      where:  {
        id: helpAndSupportId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'helpAndSupportId, not updated');
  }
    return result;
  };

const deleteHelpAndSupportItemFromDb = async (userId: string, helpAndSupportId: string) => {
    const deletedItem = await prisma.helpAndSupport.delete({
      where: {
      id: helpAndSupportId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'helpAndSupportId, not deleted');
  }

    return deletedItem;
  };

export const helpAndSupportService = {
createHelpAndSupportIntoDb,
getHelpAndSupportListFromDb,
getHelpAndSupportByIdFromDb,
updateHelpAndSupportIntoDb,
deleteHelpAndSupportItemFromDb,
};