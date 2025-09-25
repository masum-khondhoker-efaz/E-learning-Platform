import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { companyPurchaseService } from './companyPurchase.service';

const createCompanyPurchase = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await companyPurchaseService.createCompanyPurchaseIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'CompanyPurchase created successfully',
    data: result,
  });
});

const getCompanyPurchaseList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await companyPurchaseService.getCompanyPurchaseListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CompanyPurchase list retrieved successfully',
    data: result,
  });
});

const getCompanyPurchaseById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await companyPurchaseService.getCompanyPurchaseByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CompanyPurchase details retrieved successfully',
    data: result,
  });
});

const updateCompanyPurchase = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await companyPurchaseService.updateCompanyPurchaseIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CompanyPurchase updated successfully',
    data: result,
  });
});

const deleteCompanyPurchase = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await companyPurchaseService.deleteCompanyPurchaseItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CompanyPurchase deleted successfully',
    data: result,
  });
});

export const companyPurchaseController = {
  createCompanyPurchase,
  getCompanyPurchaseList,
  getCompanyPurchaseById,
  updateCompanyPurchase,
  deleteCompanyPurchase,
};