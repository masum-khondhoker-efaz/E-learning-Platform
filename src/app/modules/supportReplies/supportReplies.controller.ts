import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { supportRepliesService } from './supportReplies.service';
import { pickValidFields } from '../../utils/pickValidFields';

const createSupportReplies = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.createSupportRepliesIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'SupportReplies created successfully',
    data: result,
  });
});

const getSupportRepliesList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const filters = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'status',
    'type',
    'startDate',
    'endDate',
  ]);
  
  const result = await supportRepliesService.getSupportRepliesListFromDb(filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const updateSupportById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.updateSupportByIdFromDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies details retrieved successfully',
    data: result,
  });
});

const getSupportRepliesReports = catchAsync(async (req, res) => {
  const user = req.user as any;
  const filters = pickValidFields(req.query, [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'searchTerm',
    'status',
    'startDate',
    'endDate',
  ]);
  
  const result = await supportRepliesService.getSupportRepliesReportsFromDb(filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies reports retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const updateSupportReplies = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.updateSupportRepliesIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies updated successfully',
    data: result,
  });
});

const getSpecificRepliesById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.getSpecificRepliesByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies details retrieved successfully',
    data: result,
  });
});

const getSpecificSupportReplyById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.getSpecificSupportReplyByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies details retrieved successfully',
    data: result,
  });
});

const deleteSupportReplies = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.deleteSupportRepliesItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies deleted successfully',
    data: result,
  });
});

export const supportRepliesController = {
  createSupportReplies,
  getSupportRepliesList,
  updateSupportById,
  updateSupportReplies,
  deleteSupportReplies,
  getSpecificRepliesById,
  getSupportRepliesReports,
  getSpecificSupportReplyById,
};