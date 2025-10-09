import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { supportService } from './support.service';
import { pickValidFields } from '../../utils/pickValidFields';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createSupport = catchAsync(async (req, res) => {
  const result = await supportService.createSupportIntoDb(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Support created successfully',
    data: result,
  });
});

const getSupportList = catchAsync(async (req, res) => {
  const user = req.user as any;

  
  const result = await supportService.getSupportListFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Support list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getSupportById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportService.getSupportByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Support details retrieved successfully',
    data: result,
  });
});

const updateSupport = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportService.updateSupportIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Support updated successfully',
    data: result,
  });
});

const deleteSupport = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportService.deleteSupportItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Support deleted successfully',
    data: result,
  });
});

export const supportController = {
  createSupport,
  getSupportList,
  getSupportById,
  updateSupport,
  deleteSupport,
};