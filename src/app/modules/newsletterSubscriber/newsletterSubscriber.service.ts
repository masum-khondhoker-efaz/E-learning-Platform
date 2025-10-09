import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createNewsletterSubscriberIntoDb = async (data: any) => {

  const existingNewsletterSubscriber = await prisma.newsletterSubscriber.findUnique({
    where: {
      email: data.email,
    },
  });
  if (existingNewsletterSubscriber) {
    throw new AppError(httpStatus.CONFLICT, 'Email is already subscribed');
  }
  
    const result = await prisma.newsletterSubscriber.create({ 
    data: {
      ...data,
    }
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'newsletterSubscriber not created');
  }
    return result;
};

const getNewsletterSubscriberListFromDb = async (userId: string) => {
  
    const result = await prisma.newsletterSubscriber.findMany();
    if (result.length === 0) {
    return { message: 'No newsletterSubscriber found' };
  }
    return result;
};

const getNewsletterSubscriberByIdFromDb = async (userId: string, newsletterSubscriberId: string) => {
  
    const result = await prisma.newsletterSubscriber.findUnique({ 
    where: {
      id: newsletterSubscriberId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'newsletterSubscriber not found');
  }
    return result;
  };



const updateNewsletterSubscriberIntoDb = async (userId: string, newsletterSubscriberId: string, data: any) => {
  
    const result = await prisma.newsletterSubscriber.update({
      where:  {
        id: newsletterSubscriberId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'newsletterSubscriberId, not updated');
  }
    return result;
  };

const deleteNewsletterSubscriberItemFromDb = async (userId: string, newsletterSubscriberId: string) => {
  const findExisting = await prisma.newsletterSubscriber.findUnique({
    where: {
      id: newsletterSubscriberId,
    },
  });
  if (!findExisting) {
    throw new AppError(httpStatus.NOT_FOUND, 'newsletterSubscriber not found');
  }
    const deletedItem = await prisma.newsletterSubscriber.delete({
      where: {
      id: newsletterSubscriberId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'newsletterSubscriberId, not deleted');
  }

    return deletedItem;
  };

export const newsletterSubscriberService = {
createNewsletterSubscriberIntoDb,
getNewsletterSubscriberListFromDb,
getNewsletterSubscriberByIdFromDb,
updateNewsletterSubscriberIntoDb,
deleteNewsletterSubscriberItemFromDb,
};