import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { database } from 'firebase-admin';

const createReviewIntoDb = async (userId: string, data: any) => {
  return {}
};

const getReviewListForSaloonFromDb = async (
  userId: string,
  saloonOwnerId: string,
) => {
  const result = await prisma.review.findMany({
    where: {
      saloonOwnerId: saloonOwnerId,
    },
    select: {
      id: true,
      userId: true,
      barberId: true,
      saloonOwnerId: true,
      bookingId: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result;
};

const getReviewListForBarberFromDb = async (
  userId: string,
  // barberId: string,
) => {
  const result = await prisma.review.findMany({
    where: {
      barberId: userId,
    },
    select: {
      userId: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  if (result.length === 0) {
    return [];
  }
  return result.map(review => ({
    customerId: review.userId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    barberId: userId,
   
  }));
};

const getReviewByIdFromDb = async (userId: string, reviewId: string) => {
  const result = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'review not found');
  }
  return result;
};

const updateReviewIntoDb = async (
  userId: string,
  reviewId: string,
  data: {
    rating: number;
    comment?: string;
  },
) => {
  return {}
   
};

const deleteReviewItemFromDb = async (userId: string, reviewId: string) => {
  return {}
};

export const reviewService = {
  createReviewIntoDb,
  getReviewListForSaloonFromDb,
  getReviewListForBarberFromDb,
  getReviewByIdFromDb,
  updateReviewIntoDb,
  deleteReviewItemFromDb,
};
