import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { privacyPolicyService } from './privacyPolicy.service';

const createPrivacyPolicy = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await privacyPolicyService.createPrivacyPolicyIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'PrivacyPolicy created successfully',
    data: result,
  });
});

const getPrivacyPolicyList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await privacyPolicyService.getPrivacyPolicyListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'PrivacyPolicy list retrieved successfully',
    data: result,
  });
});

const getPrivacyPolicyById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await privacyPolicyService.getPrivacyPolicyByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'PrivacyPolicy details retrieved successfully',
    data: result,
  });
});

const updatePrivacyPolicy = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await privacyPolicyService.updatePrivacyPolicyIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'PrivacyPolicy updated successfully',
    data: result,
  });
});

const deletePrivacyPolicy = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await privacyPolicyService.deletePrivacyPolicyItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'PrivacyPolicy deleted successfully',
    data: result,
  });
});

export const privacyPolicyController = {
  createPrivacyPolicy,
  getPrivacyPolicyList,
  getPrivacyPolicyById,
  updatePrivacyPolicy,
  deletePrivacyPolicy,
};