import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { inPersonTrainingService } from './inPersonTraining.service';

const createInPersonTraining = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await inPersonTrainingService.createInPersonTrainingIntoDb(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'InPersonTraining created successfully',
    data: result,
  });
});

const getInPersonTrainingList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await inPersonTrainingService.getInPersonTrainingListFromDb(
    user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'InPersonTraining list retrieved successfully',
    data: result,
  });
});

const getInPersonTrainingById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await inPersonTrainingService.getInPersonTrainingByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'InPersonTraining details retrieved successfully',
    data: result,
  });
});

const getMyInPersonTrainingRequest = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await inPersonTrainingService.getMyInPersonTrainingRequestFromDb(
    user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My InPersonTrainings retrieved successfully',
    data: result,
  });
});

const getMyInPersonTrainingRequestById = catchAsync(async (req, res) => {  
  const user = req.user as any;
  const result = await inPersonTrainingService.getMyInPersonTrainingRequestByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My InPersonTraining details retrieved successfully',
    data: result,
  });
});

const getMyInPersonTrainings = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await inPersonTrainingService.getMyInPersonTrainingsFromDb(
    user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My InPersonTrainings retrieved successfully',
    data: result,
  });
});

const getMyInPersonTrainingById = catchAsync(async (req, res) => {  
  const user = req.user as any;
  const result = await inPersonTrainingService.getMyInPersonTrainingByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My InPersonTraining details retrieved successfully',
    data: result,
  });
});

const updateInPersonTraining = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await inPersonTrainingService.updateInPersonTrainingIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'InPersonTraining updated successfully',
    data: result,
  });
});

const deleteInPersonTraining = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await inPersonTrainingService.deleteInPersonTrainingItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'InPersonTraining deleted successfully',
    data: result,
  });
});

export const inPersonTrainingController = {
  createInPersonTraining,
  getInPersonTrainingList,
  getInPersonTrainingById,
  getMyInPersonTrainingRequest,
  getMyInPersonTrainingRequestById,
  getMyInPersonTrainings,
  getMyInPersonTrainingById,
  updateInPersonTraining,
  deleteInPersonTraining,
};
