import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';


interface PurchasePayload {
  companyId: string;
  items: { courseId: string; emails: string[] }[];
}

const createCompanyPurchaseIntoDb = async (payload: PurchasePayload) => {
  const { companyId, items } = payload;

  // Start transaction
  return await prisma.$transaction(async (tx) => {
    const purchase = await tx.companyPurchase.create({
      data: { companyId, totalAmount: 0 },
    });

    const allItems = [];

    for (const item of items) {
      const purchaseItem = await tx.companyPurchaseItem.create({
        data: {
          purchaseId: purchase.id,
          courseId: item.courseId,
        },
      });

      for (const email of item.emails) {
        const tempPassword = uuid().slice(0, 8); // generate temp password
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const credential = await tx.employeeCredential.create({
          data: {
            companyId,
            purchaseItemId: purchaseItem.id,
            courseId: item.courseId,
            loginEmail: email,
            passwordHash,
            tempPassword,
          },
        });

        allItems.push({ purchaseItem, credential });
      }
    }

    return { purchase, items: allItems };
  });
};


const getCompanyPurchaseListFromDb = async (userId: string) => {
  
    const result = await prisma.companyPurchase.findMany();
    if (result.length === 0) {
    return { message: 'No companyPurchase found' };
  }
    return result;
};

const getCompanyPurchaseByIdFromDb = async (userId: string, companyPurchaseId: string) => {
  
    const result = await prisma.companyPurchase.findUnique({ 
    where: {
      id: companyPurchaseId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'companyPurchase not found');
  }
    return result;
  };



const updateCompanyPurchaseIntoDb = async (userId: string, companyPurchaseId: string, data: any) => {
  
    const result = await prisma.companyPurchase.update({
      where:  {
        id: companyPurchaseId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'companyPurchaseId, not updated');
  }
    return result;
  };

const deleteCompanyPurchaseItemFromDb = async (userId: string, companyPurchaseId: string) => {
    const deletedItem = await prisma.companyPurchase.delete({
      where: {
      id: companyPurchaseId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'companyPurchaseId, not deleted');
  }

    return deletedItem;
  };

export const companyPurchaseService = {
createCompanyPurchaseIntoDb,
getCompanyPurchaseListFromDb,
getCompanyPurchaseByIdFromDb,
updateCompanyPurchaseIntoDb,
deleteCompanyPurchaseItemFromDb,
};