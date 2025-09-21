import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { database } from 'firebase-admin';

const createReviewIntoDb = async (userId: string, data: any) => {
  const findExistingReview = await prisma.review.findFirst({
    where: {
      userId: userId,
      courseId: data.courseId,
    },
  });
  if (findExistingReview) {
    throw new AppError(httpStatus.CONFLICT, 'You have already reviewed this course');
  }

  // Check if user has completed the course
  const checkForCompletion = await prisma.studentProgress.findFirst({
    where: {
      userId: userId,
      lesson: {
        section: {
          courseId: data.courseId,
        },
      },
      isCompleted: true,
    },
  });

  if (!checkForCompletion) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only review courses you have completed');
  }
  
  // Create review  
  const result = await prisma.review.create({
    data: {
      userId: userId,
      courseId: data.courseId,
      rating: data.rating,
      comment: data.comment,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Review not created');
  }

  return result;
};

const getReviewListForACourseFromDb = async (
  userId: string,
  courseId: string,
) => {
  const result = await prisma.review.findMany({
    where: {
      courseId: courseId,
    },
    select: {
      id: true,
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

  const totalRatings = result.length;
  const averageRating =
    result.reduce((sum, review) => sum + review.rating, 0) / totalRatings;

  const formattedResult = {
    totalRatings,
    averageRating: parseFloat(averageRating.toFixed(2)),
    reviews: result,
  };


  return formattedResult;
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
  const existingReview = await prisma.review.findUnique({
    where: {
      id: reviewId,
    },
  });
  if (!existingReview) {
    throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  }
  if (existingReview.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only update your own reviews');
  }

  const result = await prisma.review.update({
    where: {
      id: reviewId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Review not updated');
  }
  return result;
   
};

const deleteReviewItemFromDb = async (userId: string, reviewId: string) => {
  const existingReview = await prisma.review.findUnique({
    where: {
      id: reviewId,
      userId: userId,
    },
  });
  if (!existingReview) {
    throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  }
  if (existingReview.userId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only delete your own reviews');
  }

  const deletedItem = await prisma.review.delete({
    where: {
      id: reviewId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Review not deleted');
  }
  return deletedItem;
};

export const reviewService = {
  createReviewIntoDb,
  getReviewListForACourseFromDb,
  getReviewByIdFromDb,
  updateReviewIntoDb,
  deleteReviewItemFromDb,
};
