import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { aboutUsService } from './aboutUs.service';

const createAboutUs = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await aboutUsService.createAboutUsIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'AboutUs created successfully',
    data: result,
  });
});

const getAboutUsList = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await aboutUsService.getAboutUsListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AboutUs list retrieved successfully',
    data: result,
  });
});

const getAboutUsById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await aboutUsService.getAboutUsByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AboutUs details retrieved successfully',
    data: result,
  });
});

const updateAboutUs = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await aboutUsService.updateAboutUsIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AboutUs updated successfully',
    data: result,
  });
});

const deleteAboutUs = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await aboutUsService.deleteAboutUsItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'AboutUs deleted successfully',
    data: result,
  });
});

export const aboutUsController = {
  createAboutUs,
  getAboutUsList,
  getAboutUsById,
  updateAboutUs,
  deleteAboutUs,
};