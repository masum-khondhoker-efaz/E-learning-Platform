import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { testService } from './test.service';

const createTest = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testService.createTestIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Test created successfully',
    data: result,
  });
});

const getTestList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testService.getTestListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test list retrieved successfully',
    data: result,
  });
});

const getTestById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testService.getTestByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test details retrieved successfully',
    data: result,
  });
});

const updateTest = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testService.updateTestIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test updated successfully',
    data: result,
  });
});

const deleteTest = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await testService.deleteTestItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Test deleted successfully',
    data: result,
  });
});

export const testController = {
  createTest,
  getTestList,
  getTestById,
  updateTest,
  deleteTest,
};