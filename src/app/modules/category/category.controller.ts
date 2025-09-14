import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { categoryService } from './category.service';

const createCategory = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await categoryService.createCategoryIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Category created successfully',
    data: result,
  });
});

const getCategoryList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await categoryService.getCategoryListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category list retrieved successfully',
    data: result,
  });
});

const getCategoryById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await categoryService.getCategoryByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category details retrieved successfully',
    data: result,
  });
});

const updateCategory = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await categoryService.updateCategoryIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category updated successfully',
    data: result,
  });
});

const deleteCategory = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await categoryService.deleteCategoryItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category deleted successfully',
    data: result,
  });
});

export const categoryController = {
  createCategory,
  getCategoryList,
  getCategoryById,
  updateCategory,
  deleteCategory,
};