import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { testAttemptService } from './testAttempt.service';
import AppError from '../../errors/AppError';

const createTestAttempt = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testAttemptService.submitTestAttemptIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'TestAttempt created successfully',
    data: result,
  });
});

const getTestAttemptList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testAttemptService.getTestAttemptListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'TestAttempt list retrieved successfully',
    data: result,
  });
});

const getTestAttemptById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testAttemptService.getTestAttemptByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'TestAttempt details retrieved successfully',
    data: result,
  });
});

const getMyTestAttempts = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testAttemptService.getMyTestAttemptsFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My TestAttempts retrieved successfully',
    data: result,
  });
});

const updateTestAttempt = catchAsync(async (req, res) => {
  const user = req.user as any;
   // Make sure to extract the gradings array from the request body
  const { gradings } = req.body;
  
  if (!gradings || !Array.isArray(gradings)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Gradings must be provided as an array');
  }
  const result = await testAttemptService.gradeShortAnswers(user.id, req.params.id, req.body.gradings);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'TestAttempt updated successfully',
    data: result,
  });
});

const deleteTestAttempt = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testAttemptService.deleteTestAttemptItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'TestAttempt deleted successfully',
    data: result,
  });
});

export const testAttemptController = {
  createTestAttempt,
  getTestAttemptList,
  getTestAttemptById,
  getMyTestAttempts,
  updateTestAttempt,
  deleteTestAttempt,
};