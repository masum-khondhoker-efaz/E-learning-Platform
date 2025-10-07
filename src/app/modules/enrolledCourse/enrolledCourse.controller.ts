import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { enrolledCourseService } from './enrolledCourse.service';
import { UserRoleEnum } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';

const createEnrolledCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.createEnrolledCourseIntoDb(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'EnrolledCourse created successfully',
    data: result,
  });
});

const getEnrolledCourseList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.getEnrolledCourseListFromDb(
    user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse list retrieved successfully',
    data: result,
  });
});

const getEmployeesCourseList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.getEmployeesCourseListFromDb(  
    user.id,
  );
  sendResponse(res, { 
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse list retrieved successfully',
    data: result,
  });
});

const getEmployeesCourseById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const enrolledId = req.params.id;
  const result = await enrolledCourseService.getEmployeesCourseByIdFromDb(
    user.id,
    enrolledId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse details retrieved successfully',
    data: result,
  });
});

const getEnrolledCourseByStudentId = catchAsync(async (req, res) => {
  const user = req.user as any;
  const enrolledId = req.params.id;
  const result = await enrolledCourseService.getEnrolledCourseByStudentIdFromDb(
    user.id,
    enrolledId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse details retrieved successfully',
    data: result,
  });
});

const getMyEnrolledCourses = catchAsync(async (req, res) => {
  const user = req.user as any;
  if (user.role === UserRoleEnum.STUDENT) {
    const result = await enrolledCourseService.getMyEnrolledCoursesFromDb(
      user.id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'My EnrolledCourses retrieved successfully',
      data: result,
    });
  }
  if (user.role === UserRoleEnum.EMPLOYEE) {
    const findUser = await prisma.user.findUnique({
      where: { id: user.id, isProfileComplete: true },
    });
    if (!findUser) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Please complete your profile to proceed.',
      );
    }

    const result =
      await enrolledCourseService.getMyEnrolledCoursesForEmployeeFromDb(
        user.id,
      );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'My EnrolledCourses retrieved successfully',
      data: result,
    });
  }
});

const getMyEnrolledCourseById = catchAsync(async (req, res) => {
  const user = req.user as any;

  if (user.role === UserRoleEnum.STUDENT) {
    const result = await enrolledCourseService.getMyEnrolledCourseByIdFromDb(
      user.id,
      req.params.id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'EnrolledCourse details retrieved successfully',
      data: result,
    });
  }
  if (user.role === UserRoleEnum.EMPLOYEE) {
    const findUser = await prisma.user.findUnique({
      where: { id: user.id, isProfileComplete: true },
    });
    if (!findUser) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Please complete your profile to proceed.',
      );
    }
    const result = await enrolledCourseService.getMyEnrolledCourseByIdFromDbForEmployee(
      user.id,
      req.params.id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'EnrolledCourse details retrieved successfully',
      data: result,
    });
  }
});

const updateEnrolledCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.updateEnrolledCourseIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse updated successfully',
    data: result,
  });
});

const deleteEnrolledCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.deleteEnrolledCourseItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse deleted successfully',
    data: result,
  });
});

export const enrolledCourseController = {
  createEnrolledCourse,
  getEnrolledCourseList,
  getEmployeesCourseList,
  getEnrolledCourseByStudentId,
  getEmployeesCourseById,
  getMyEnrolledCourses,
  getMyEnrolledCourseById,
  updateEnrolledCourse,
  deleteEnrolledCourse,
};
