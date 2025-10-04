import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { contactUsInfoService } from './contactUsInfo.service';

const createContactUsInfo = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await contactUsInfoService.createContactUsInfoIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'ContactUsInfo created successfully',
    data: result,
  });
});

const getContactUsInfoList = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await contactUsInfoService.getContactUsInfoListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ContactUsInfo list retrieved successfully',
    data: result,
  });
});

const getContactUsInfoById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await contactUsInfoService.getContactUsInfoByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ContactUsInfo details retrieved successfully',
    data: result,
  });
});

const updateContactUsInfo = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await contactUsInfoService.updateContactUsInfoIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ContactUsInfo updated successfully',
    data: result,
  });
});

const deleteContactUsInfo = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await contactUsInfoService.deleteContactUsInfoItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'ContactUsInfo deleted successfully',
    data: result,
  });
});

export const contactUsInfoController = {
  createContactUsInfo,
  getContactUsInfoList,
  getContactUsInfoById,
  updateContactUsInfo,
  deleteContactUsInfo,
};