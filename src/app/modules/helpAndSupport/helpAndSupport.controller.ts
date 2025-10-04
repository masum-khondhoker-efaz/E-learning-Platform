import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { helpAndSupportService } from './helpAndSupport.service';

const createHelpAndSupport = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await helpAndSupportService.createHelpAndSupportIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'HelpAndSupport created successfully',
    data: result,
  });
});

const getHelpAndSupportList = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await helpAndSupportService.getHelpAndSupportListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'HelpAndSupport list retrieved successfully',
    data: result,
  });
});

const getHelpAndSupportById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await helpAndSupportService.getHelpAndSupportByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'HelpAndSupport details retrieved successfully',
    data: result,
  });
});

const updateHelpAndSupport = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await helpAndSupportService.updateHelpAndSupportIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'HelpAndSupport updated successfully',
    data: result,
  });
});

const deleteHelpAndSupport = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await helpAndSupportService.deleteHelpAndSupportItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'HelpAndSupport deleted successfully',
    data: result,
  });
});

export const helpAndSupportController = {
  createHelpAndSupport,
  getHelpAndSupportList,
  getHelpAndSupportById,
  updateHelpAndSupport,
  deleteHelpAndSupport,
};