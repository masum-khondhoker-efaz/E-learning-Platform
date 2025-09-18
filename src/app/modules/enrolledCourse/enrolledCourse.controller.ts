import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { enrolledCourseService } from './enrolledCourse.service';

const createEnrolledCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.createEnrolledCourseIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'EnrolledCourse created successfully',
    data: result,
  });
});

const getEnrolledCourseList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.getEnrolledCourseListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse list retrieved successfully',
    data: result,
  });
});

const getEnrolledCourseByStudentId = catchAsync(async (req, res) => {
  const user = req.user as any;
  const studentId = req.params.id;
  const result = await enrolledCourseService.getEnrolledCourseByStudentIdFromDb(user.id, studentId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse details retrieved successfully',
    data: result,
  });
});

const getMyEnrolledCourses = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.getMyEnrolledCoursesFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My EnrolledCourses retrieved successfully',
    data: result,
  });
});

const getMyEnrolledCourseById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.getMyEnrolledCourseByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse details retrieved successfully',
    data: result,
  });
});

const updateEnrolledCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.updateEnrolledCourseIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'EnrolledCourse updated successfully',
    data: result,
  });
});

const deleteEnrolledCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await enrolledCourseService.deleteEnrolledCourseItemFromDb(user.id, req.params.id);
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
  getEnrolledCourseByStudentId,
  getMyEnrolledCourses,
  getMyEnrolledCourseById,
  updateEnrolledCourse,
  deleteEnrolledCourse,
};