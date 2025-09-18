import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { studentProgressService } from './studentProgress.service';

// studentProgress.controller.ts
const markLessonCompleted = catchAsync(async (req, res) => {
  const user = req.user as any;
  const lessonId = req.params.id;
  const result = await studentProgressService.markLessonCompleted(
    user.id,
    lessonId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lesson marked as completed',
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

const getCourseProgress = catchAsync(async (req, res) => {
  const user = req.user as any;
  const courseId = req.params.id;
  const result = await studentProgressService.getStudentProgress(
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
  const courseId = req.params.id;
  const result = await studentProgressService.getCourseCompletionStatus(
    user.id,
    courseId,
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
  markLessonIncomplete,
  getCourseProgress,
  getLessonStatus,
  getCourseCompletion,
};
