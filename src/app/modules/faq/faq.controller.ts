import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { faqService } from './faq.service';
import { pickValidFields } from '../../utils/pickValidFields';

const createFaq = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await faqService.createFaqIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Faq created successfully',
    data: result,
  });
});

const getFaqList = catchAsync(async (req, res) => {
  const user = req.user as any;
 
  
  const result = await faqService.getFaqListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Faq list retrieved successfully',
    data: result,
  });
});

const getFaqById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await faqService.getFaqByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Faq details retrieved successfully',
    data: result,
  });
});

const updateFaq = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await faqService.updateFaqIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Faq updated successfully',
    data: result,
  });
});

const deleteFaq = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await faqService.deleteFaqItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Faq deleted successfully',
    data: result,
  });
});

export const faqController = {
  createFaq,
  getFaqList,
  getFaqById,
  updateFaq,
  deleteFaq,
};