import prisma from '../../utils/prisma';
import { PaymentStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { format } from 'path';

const createEnrolledCourseIntoDb = async (
  userId: string,
  data: {
    courseId: string;
  },
) => {
  const findCourse = await prisma.course.findUnique({
    where: {
      id: data.courseId,
    },
  });
  if (!findCourse) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found');
  }

  // Check if the user is already enrolled in the course
  const existingEnrollment = await prisma.enrolledCourse.findFirst({
    where: {
      userId: userId,
      courseId: data.courseId,
    },
  });

  if (existingEnrollment) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'User is already enrolled in this course',
    );
  }

  const result = await prisma.enrolledCourse.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'enrolledCourse not created');
  }
  return result;
};

const getEnrolledCourseListFromDb = async (userId: string) => {
  const result = await prisma.enrolledCourse.findMany({
    where: { paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      enrolledAt: true,
      user: { select: { id: true, fullName: true, email: true, image: true } },
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });
  if (result.length === 0) {
    return { message: 'No enrolledCourse found' };
  }

  return result.map((enrolled) => ({
    id: enrolled.id,
    courseId: enrolled.courseId,
    paymentStatus: enrolled.paymentStatus,
    enrolledAt: enrolled.enrolledAt,
    userId: enrolled.user?.id,
    userFullName: enrolled.user?.fullName,
    userEmail: enrolled.user?.email,
    userImage: enrolled.user?.image,
    courseTitle: enrolled.course?.courseTitle,
    coursePrice: enrolled.course?.price,
  }));
  
};

const getEnrolledCourseByStudentIdFromDb = async (userId: string, studentId: string) => {
  const result = await prisma.enrolledCourse.findMany({
    where: { userId: studentId,
       paymentStatus: PaymentStatus.COMPLETED 
      },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      enrolledAt: true,
      user: { select: { id: true, fullName: true, email: true, image: true } },
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });
  if (result.length === 0) {
    return { message: 'No enrolledCourse found for this student' };
  }

  return result.map((enrolled) => ({
    id: enrolled.id,
    courseId: enrolled.courseId,
    paymentStatus: enrolled.paymentStatus,
    enrolledAt: enrolled.enrolledAt,
    userId: enrolled.user?.id,
    userFullName: enrolled.user?.fullName,
    userEmail: enrolled.user?.email,
    userImage: enrolled.user?.image,
    courseTitle: enrolled.course?.courseTitle,
    coursePrice: enrolled.course?.price,
  }));
};

const getMyEnrolledCoursesFromDb = async (userId: string) => {
  const result = await prisma.enrolledCourse.findMany({
    where: { userId: userId, 
      paymentStatus: PaymentStatus.COMPLETED 
    },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      enrolledAt: true,
      user: { select: { id: true, fullName: true, email: true, image: true } },
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });
  if (result.length === 0) {
    return { message: 'No enrolledCourse found for this student' };
  }

  return result.map((enrolled) => ({
    id: enrolled.id,
    courseId: enrolled.courseId,
    paymentStatus: enrolled.paymentStatus,
    enrolledAt: enrolled.enrolledAt,
    userId: enrolled.user?.id,
    userFullName: enrolled.user?.fullName,
    userEmail: enrolled.user?.email,
    userImage: enrolled.user?.image,
    courseTitle: enrolled.course?.courseTitle,
    coursePrice: enrolled.course?.price,
  }));
}
    

const getMyEnrolledCourseByIdFromDb = async (
  userId: string,
  enrolledCourseId: string,
) => {
  const result = await prisma.enrolledCourse.findFirst({
    where: {
      courseId: enrolledCourseId,
      userId: userId,
      // paymentStatus: PaymentStatus.COMPLETED,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'enrolledCourse not found');
  }
  return result;
};

const updateEnrolledCourseIntoDb = async (
  userId: string,
  enrolledCourseId: string,
  data: any,
) => {
  const result = await prisma.enrolledCourse.update({
    where: {
      id: enrolledCourseId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'enrolledCourseId, not updated');
  }
  return result;
};

const deleteEnrolledCourseItemFromDb = async (
  userId: string,
  enrolledCourseId: string,
) => {
  const deletedItem = await prisma.enrolledCourse.delete({
    where: {
      id: enrolledCourseId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'enrolledCourseId, not deleted');
  }

  return deletedItem;
};

export const enrolledCourseService = {
  createEnrolledCourseIntoDb,
  getEnrolledCourseListFromDb,
  getEnrolledCourseByStudentIdFromDb,
  getMyEnrolledCoursesFromDb,
  getMyEnrolledCourseByIdFromDb,
  updateEnrolledCourseIntoDb,
  deleteEnrolledCourseItemFromDb,
};
