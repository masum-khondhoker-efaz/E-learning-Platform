import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { favoriteCourseService } from './favoriteCourse.service';

const createFavoriteCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteCourseService.createFavoriteCourseIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'FavoriteCourse created successfully',
    data: result,
  });
});

const getFavoriteCourseList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteCourseService.getFavoriteCourseListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteCourse list retrieved successfully',
    data: result,
  });
});

const getFavoriteCourseById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteCourseService.getFavoriteCourseByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteCourse details retrieved successfully',
    data: result,
  });
});

const updateFavoriteCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteCourseService.updateFavoriteCourseIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteCourse updated successfully',
    data: result,
  });
});

const deleteFavoriteCourse = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteCourseService.deleteFavoriteCourseItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteCourse deleted successfully',
    data: result,
  });
});

export const favoriteCourseController = {
  createFavoriteCourse,
  getFavoriteCourseList,
  getFavoriteCourseById,
  updateFavoriteCourse,
  deleteFavoriteCourse,
};