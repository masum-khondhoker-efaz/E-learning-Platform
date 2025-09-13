import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { termAndConditionService } from './termAndCondition.service';

const createTermAndCondition = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await termAndConditionService.createTermAndConditionIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'TermAndCondition created successfully',
    data: result,
  });
});

const getTermAndConditionList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await termAndConditionService.getTermAndConditionListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'TermAndCondition list retrieved successfully',
    data: result,
  });
});

const getTermAndConditionById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await termAndConditionService.getTermAndConditionByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'TermAndCondition details retrieved successfully',
    data: result,
  });
});

const updateTermAndCondition = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await termAndConditionService.updateTermAndConditionIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'TermAndCondition updated successfully',
    data: result,
  });
});

const deleteTermAndCondition = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await termAndConditionService.deleteTermAndConditionItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'TermAndCondition deleted successfully',
    data: result,
  });
});

export const termAndConditionController = {
  createTermAndCondition,
  getTermAndConditionList,
  getTermAndConditionById,
  updateTermAndCondition,
  deleteTermAndCondition,
};