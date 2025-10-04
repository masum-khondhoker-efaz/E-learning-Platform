import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createPrivacyPolicyIntoDb = async (userId: string, data: {
  content: string;
}) => {

  // check if there is any previous Privacy & Policy
  const existingPrivacyPolicy = await prisma.privacyPolicy.findFirst();
  if (existingPrivacyPolicy) {
    throw new AppError(httpStatus.CONFLICT, 'Privacy & Policy already exists');
  }
  
    const result = await prisma.privacyPolicy.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Privacy & Policy is not created');
  }
    return result;
};

const getPrivacyPolicyListFromDb = async () => {
  
    const result = await prisma.privacyPolicy.findFirst();
    if (!result) {
    return { message: 'Privacy & Policy is not found' };
  }
    return result;
};

const getPrivacyPolicyByIdFromDb = async (privacyPolicyId: string) => {
  
    const result = await prisma.privacyPolicy.findUnique({ 
    where: {
      id: privacyPolicyId,
    }
   });
    if (!result) {
      return { message: 'Privacy & Policy is not not found' };
  }
    return result;
  };



const updatePrivacyPolicyIntoDb = async (userId: string, privacyPolicyId: string, data: any) => {
  
    const result = await prisma.privacyPolicy.update({
      where:  {
        id: privacyPolicyId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'privacyPolicyId, not updated');
  }
    return result;
  };

const deletePrivacyPolicyItemFromDb = async (userId: string, privacyPolicyId: string) => {
    const deletedItem = await prisma.privacyPolicy.delete({
      where: {
      id: privacyPolicyId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'privacyPolicyId, not deleted');
  }

    return deletedItem;
  };

export const privacyPolicyService = {
createPrivacyPolicyIntoDb,
getPrivacyPolicyListFromDb,
getPrivacyPolicyByIdFromDb,
updatePrivacyPolicyIntoDb,
deletePrivacyPolicyItemFromDb,
};