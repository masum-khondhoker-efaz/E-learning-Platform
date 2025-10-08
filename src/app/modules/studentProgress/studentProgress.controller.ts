import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { studentProgressService } from './studentProgress.service';
import { UserRoleEnum } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';

// studentProgress.controller.ts
const markLessonCompleted = catchAsync(async (req, res) => {
  const user = req.user as any;
  const userRole = user.role;

  if (userRole === UserRoleEnum.EMPLOYEE) {
    const findUser = await prisma.user.findUnique({
      where: { id: user.id, isProfileComplete: true },
    });
    if (!findUser) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Please complete your profile to proceed.',
      );
    }
  }

  const result = await studentProgressService.markLessonCompleted(
    user.id,
    req.body.lessonId,
    userRole,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson marked as completed',
    data: result,
  });
});

const markTestCompleted = catchAsync(async (req, res) => {
  const user = req.user as any;
  const userRole = user.role;
  if (userRole === UserRoleEnum.EMPLOYEE) {
    const findUser = await prisma.user.findUnique({
      where: { id: user.id, isProfileComplete: true },
    });
    if (!findUser) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Please complete your profile to proceed.',
      );
    }
  }

  const result = await studentProgressService.markTestCompleted(
    user.id,
    req.body.testId,
    userRole,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test marked as completed',
    data: result,
  });
});

const markCourseCompleted = catchAsync(async (req, res) => {
  const user = req.user as any;
  const userRole = user.role;
  if (userRole === UserRoleEnum.EMPLOYEE) {
    const findUser = await prisma.user.findUnique({
      where: { id: user.id, isProfileComplete: true },
    });
    if (!findUser) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Please complete your profile to proceed.',
      );
    }
  }

  const result = await studentProgressService.markCourseCompleted(
    user.id,
    req.body.courseId,
    userRole,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course marked as completed',
    data: result,
  });
});

const getALessonMaterialById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const userRole = user.role;
  const lessonMaterialId = req.params.id;
  const result = await studentProgressService.getALessonMaterialByIdFromDb(
    user.id,
    lessonMaterialId,
    userRole,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson material retrieved successfully',
    data: result,
  });
});

const markLessonIncomplete = catchAsync(async (req, res) => {
  const user = req.user as any;
  const lessonId = req.params.id;
  const result = await studentProgressService.markLessonIncomplete(
    user.id,
    lessonId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson marked as incomplete',
    data: result,
  });
});

const getACourseDetails = catchAsync(async (req, res) => {
  const user = req.user as any;
  const courseId = req.params.id;
  const result = await studentProgressService.getACourseDetailsFromDb(
    user.id,
    courseId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course details retrieved successfully',
    data: result,
  });
});

const getMyCoursesProgress = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await studentProgressService.getAllCourseProgress(user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My courses progress retrieved successfully',
    data: result,
  });
});

const getACourseProgress = catchAsync(async (req, res) => {
  const user = req.user as any;
  const courseId = req.params.id;
  const result = await studentProgressService.getAStudentProgress(
    user.id,
    courseId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course progress retrieved successfully',
    data: result,
  });
});

const getLessonStatus = catchAsync(async (req, res) => {
  const user = req.user as any;
  const lessonId = req.params.id;
  const result = await studentProgressService.getLessonCompletionStatus(
    user.id,
    lessonId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson status retrieved successfully',
    data: result,
  });
});

const getCourseCompletion = catchAsync(async (req, res) => {
  const user = req.user as any;
  const userRole = user.role;
  if (userRole === UserRoleEnum.EMPLOYEE) {
    const findUser = await prisma.user.findUnique({
      where: { id: user.id, isProfileComplete: true },
    });
    if (!findUser) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Please complete your profile to proceed.',
      );
    }
  }
  const courseId = req.params.id;
  const result = await studentProgressService.getCourseCompletionStatus(
    user.id,
    courseId,
    userRole,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course completion status retrieved successfully',
    data: result,
  });
});

export const studentProgressController = {
  markLessonCompleted,
  markTestCompleted,
  markCourseCompleted,
  getALessonMaterialById,
  markLessonIncomplete,
  getACourseDetails,
  getMyCoursesProgress,
  getACourseProgress,
  getLessonStatus,
  getCourseCompletion,
};
