import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createFaqIntoDb = async (userId: string, data: any) => {
  const result = await prisma.faq.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'faq not created');
  }
  return result;
};

const getFaqListFromDb = async () => {
  const result = await prisma.faq.findMany();
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getFaqByIdFromDb = async (faqId: string) => {
  const result = await prisma.faq.findUnique({
    where: {
      id: faqId,
    },
  });
  if (!result) {
    return { message: 'Faq not found' };
  }
  return result;
};

const updateFaqIntoDb = async (userId: string, faqId: string, data: any) => {
  const result = await prisma.faq.update({
    where: {
      id: faqId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'faqId, not updated');
  }
  return result;
};

const deleteFaqItemFromDb = async (userId: string, faqId: string) => {
  const deletedItem = await prisma.faq.delete({
    where: {
      id: faqId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'faqId, not deleted');
  }

  return deletedItem;
};

export const faqService = {
  createFaqIntoDb,
  getFaqListFromDb,
  getFaqByIdFromDb,
  updateFaqIntoDb,
  deleteFaqItemFromDb,
};
