import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { checkoutService } from './checkout.service';

const createCheckout = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await checkoutService.createCheckoutIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Checkout created successfully',
    data: result,
  });
});

const getCheckoutList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await checkoutService.getCheckoutListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Checkout list retrieved successfully',
    data: result,
  });
});

const getCheckoutById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await checkoutService.getCheckoutByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Checkout details retrieved successfully',
    data: result,
  });
});

const updateCheckout = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await checkoutService.updateCheckoutIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Checkout updated successfully',
    data: result,
  });
});

const deleteCheckout = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await checkoutService.deleteCheckoutItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Checkout deleted successfully',
    data: result,
  });
});

const markCheckoutPaid = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { checkoutId, paymentId } = req.body;

  if (typeof checkoutId !== 'string' || typeof paymentId !== 'string') {
    return res.status(httpStatus.BAD_REQUEST).json({
      status: 'error',
      message: 'Invalid query parameters',
    });
  }

  const result = await checkoutService.markCheckoutPaid(user.id, checkoutId, paymentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Checkout marked as paid successfully',
    data: result,
  });
});

export const checkoutController = {
  createCheckout,
  getCheckoutList,
  getCheckoutById,
  updateCheckout,
  deleteCheckout,
  markCheckoutPaid,
};