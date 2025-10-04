import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { newsletterSubscriberService } from './newsletterSubscriber.service';

const createNewsletterSubscriber = catchAsync(async (req, res) => {
  const result = await newsletterSubscriberService.createNewsletterSubscriberIntoDb( req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'NewsletterSubscriber created successfully',
    data: result,
  });
});

const getNewsletterSubscriberList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await newsletterSubscriberService.getNewsletterSubscriberListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'NewsletterSubscriber list retrieved successfully',
    data: result,
  });
});

const getNewsletterSubscriberById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await newsletterSubscriberService.getNewsletterSubscriberByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'NewsletterSubscriber details retrieved successfully',
    data: result,
  });
});

const updateNewsletterSubscriber = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await newsletterSubscriberService.updateNewsletterSubscriberIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'NewsletterSubscriber updated successfully',
    data: result,
  });
});

const deleteNewsletterSubscriber = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await newsletterSubscriberService.deleteNewsletterSubscriberItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'NewsletterSubscriber deleted successfully',
    data: result,
  });
});

export const newsletterSubscriberController = {
  createNewsletterSubscriber,
  getNewsletterSubscriberList,
  getNewsletterSubscriberById,
  updateNewsletterSubscriber,
  deleteNewsletterSubscriber,
};