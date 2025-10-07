import prisma from '../../utils/prisma';
import { PaymentStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { format } from 'path';
import { studentProgressService } from '../studentProgress/studentProgress.service';

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
      invoiceId: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          phoneNumber: true,
        },
      },
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });
  if (result.length === 0) {
    return { message: 'No enrolledCourse found' };
  }

  return result.map(enrolled => ({
    id: enrolled.id,
    courseId: enrolled.courseId,
    paymentStatus: enrolled.paymentStatus,
    enrolledAt: enrolled.enrolledAt,
    invoiceId: enrolled.invoiceId,
    userId: enrolled.user?.id,
    userFullName: enrolled.user?.fullName,
    userEmail: enrolled.user?.email,
    userPhoneNumber: enrolled.user?.phoneNumber,
    userImage: enrolled.user?.image,
    courseTitle: enrolled.course?.courseTitle,
    coursePrice: enrolled.course?.price,
  }));
};

const getEmployeesCourseListFromDb = async (userId: string) => {
  const result = await prisma.employeeCredential.findMany({
    where: { paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      paymentStatus: true,
      sentAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          phoneNumber: true,
        },
      },
      course: {
        select: {
          id: true,
          courseTitle: true,
          price: true,
        },
      },
    },
  });
  if (result.length === 0) {
    return { message: 'No enrolledCourse found for employees' };
  }
  return result.map(credential => ({
    id: credential.id,
    courseId: credential.course?.id,
    courseTitle: credential.course?.courseTitle,
    coursePrice: credential.course?.price,
    paymentStatus: credential.paymentStatus,
    enrolledAt: credential.sentAt,
    userId: credential.user?.id,
    userFullName: credential.user?.fullName,
    userEmail: credential.user?.email,
    userImage: credential.user?.image,
    userPhoneNumber: credential.user?.phoneNumber,
  }));
};

const getEmployeesCourseByIdFromDb = async (
  userId: string,
  enrolledId: string,
) => {
  const result = await prisma.employeeCredential.findUnique({
    where: { id: enrolledId, paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      sentAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          phoneNumber: true,
        },
      },
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });
  if (!result) {
    return { message: 'No enrolledCourse found for this employee' };
  }
  return {
    id: result.id,
    courseId: result.courseId,
    paymentStatus: result.paymentStatus,
    enrolledAt: result.sentAt,
    userId: result.user?.id,
    userFullName: result.user?.fullName,
    userEmail: result.user?.email,
    userImage: result.user?.image,
    userPhoneNumber: result.user?.phoneNumber,
    courseTitle: result.course?.courseTitle,
    coursePrice: result.course?.price,
  };
};

const getEnrolledCourseByStudentIdFromDb = async (
  userId: string,
  enrolledId: string,
) => {
  const result = await prisma.enrolledCourse.findUnique({
    where: { id: enrolledId, paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      enrolledAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          image: true,
          phoneNumber: true,
        },
      },
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });
  if (!result) {
    return { message: 'No enrolledCourse found for this student' };
  }

  return {
    id: result.id,
    courseId: result.courseId,
    paymentStatus: result.paymentStatus,
    enrolledAt: result.enrolledAt,
    userId: result.user?.id,
    userFullName: result.user?.fullName,
    userEmail: result.user?.email,
    userImage: result.user?.image,
    userPhoneNumber: result.user?.phoneNumber,
    courseTitle: result.course?.courseTitle,
    coursePrice: result.course?.price,
  };
};

const getMyEnrolledCoursesFromDb = async (userId: string) => {
  const enrolledCourses = await prisma.enrolledCourse.findMany({
    where: { userId, paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      courseId: true,
      paymentStatus: true,
      enrolledAt: true,
      course: { select: { id: true, courseTitle: true, price: true } },
    },
  });

  if (!enrolledCourses.length) {
    return { message: 'No enrolledCourse found for this student' };
  }

  const courseProgressList =
    await studentProgressService.getAllCourseProgress(userId);
  const progressMap = new Map<string, (typeof courseProgressList)[number]>();
  courseProgressList.forEach(progress => {
    progressMap.set(progress.courseId, progress);
  });

  return enrolledCourses.map(enrolled => ({
    id: enrolled.id,
    courseId: enrolled.courseId,
    paymentStatus: enrolled.paymentStatus,
    enrolledAt: enrolled.enrolledAt,
    courseTitle: enrolled.course?.courseTitle,
    coursePrice: enrolled.course?.price,
    progress: progressMap.get(enrolled.courseId) || {
      completedLessons: 0,
      totalLessons: 0,
      progressPercentage: 0,
    },
  }));
};

const getMyEnrolledCoursesForEmployeeFromDb = async (userId: string) => {
  const result = await prisma.employeeCredential.findMany({
    where: { userId: userId, paymentStatus: PaymentStatus.COMPLETED },
    select: {
      id: true,
      paymentStatus: true,
      sentAt: true,
      course: {
        select: {
          id: true,
          courseTitle: true,
          price: true,
        },
      },
    },
  });

  if (result.length === 0) {
    return { message: 'No enrolledCourse found for this employee' };
  }
  return result.map(credential => ({
    id: credential.id,
    courseId: credential.course?.id,
    courseTitle: credential.course?.courseTitle,
    coursePrice: credential.course?.price,
    paymentStatus: credential.paymentStatus,
    enrolledAt: credential.sentAt,
  }));
};

const getMyEnrolledCourseByIdFromDb = async (
  userId: string,
  enrolledCourseId: string,
) => {
  const result = await prisma.enrolledCourse.findFirst({
    where: {
      courseId: enrolledCourseId,
      userId: userId,
      paymentStatus: PaymentStatus.COMPLETED,
    },
    include: {
      course: {
        include: {
          Section: {
            include: {
              Lesson: true,
              Test: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'enrolledCourse not found');
  }
  return result;
};

const getMyEnrolledCourseByIdFromDbForEmployee = async (
  userId: string,
  enrolledCourseId: string,
) => {
  const result = await prisma.employeeCredential.findFirst({
    where: {
      courseId: enrolledCourseId,
      userId: userId,
      paymentStatus: PaymentStatus.COMPLETED,
    },
    select: {
      userId: true,
      paymentStatus: true,
      courseId: true,
      progress: true,
      isCompleted: true,
      sentAt: true,
      course: {
        include: {
          Section: {
            include: {
              Lesson: true,
              Test: { select: { id: true, title: true } },
            },
          },
        },
      },
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
  getEmployeesCourseListFromDb,
  getEnrolledCourseByStudentIdFromDb,
  getEmployeesCourseByIdFromDb,
  getMyEnrolledCoursesForEmployeeFromDb,
  getMyEnrolledCoursesFromDb,
  getMyEnrolledCourseByIdFromDb,
  getMyEnrolledCourseByIdFromDbForEmployee,
  updateEnrolledCourseIntoDb,
  deleteEnrolledCourseItemFromDb,
};
