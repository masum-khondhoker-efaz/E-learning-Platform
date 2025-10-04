import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createTermAndConditionIntoDb = async (userId: string, data: any) => {

  const existingTermAndCondition = await prisma.termAndCondition.findFirst(); 
  if (existingTermAndCondition) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Term & Condition already exists');
  }
  
    const result = await prisma.termAndCondition.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'termAndCondition not created');
  }
    return result;
};

const getTermAndConditionListFromDb = async () => {
  
    const result = await prisma.termAndCondition.findFirst();
    if (!result) {
    return { message: 'Terms And Conditions not found' };
  }
    return result;
};

const getTermAndConditionByIdFromDb = async (termAndConditionId: string) => {
  
    const result = await prisma.termAndCondition.findUnique({ 
    where: {
      id: termAndConditionId,
    }
   });
    if (!result) {
    return { message: 'TermAndCondition not found' };
  }
    return result;
  };



const updateTermAndConditionIntoDb = async (userId: string, termAndConditionId: string, data: any) => {
  
    const result = await prisma.termAndCondition.update({
      where:  {
        id: termAndConditionId,
        // userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'termAndConditionId, not updated');
  }
    return result;
  };

const deleteTermAndConditionItemFromDb = async (userId: string, termAndConditionId: string) => {
    const deletedItem = await prisma.termAndCondition.delete({
      where: {
      id: termAndConditionId,
      // userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'termAndConditionId, not deleted');
  }

    return deletedItem;
  };

export const termAndConditionService = {
createTermAndConditionIntoDb,
getTermAndConditionListFromDb,
getTermAndConditionByIdFromDb,
updateTermAndConditionIntoDb,
deleteTermAndConditionItemFromDb,
};