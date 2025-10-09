import { Request, Response } from 'express';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status';

import { StripeServices } from './payment.service';

// create a new customer with card
const saveCardWithCustomerInfo = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await StripeServices.saveCardWithCustomerInfoIntoStripe(
    req.body,
    user.id,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Create customer and save card successfully',
    data: result,
  });
});

// Authorize the customer with the amount and send payment request
const authorizedPaymentWithSaveCard = catchAsync(async (req: any, res: any) => {
  const user = req.user as any;
  // console.log(user)
  const result = await StripeServices.authorizePaymentWithStripeCheckout(
    user.id, req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Authorized customer and payment request successfully',
    data: result,
  });
});

// Capture the payment request and deduct the amount
const capturePaymentRequest = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.capturePaymentRequestToStripe(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Capture payment request and payment deduct successfully',
    data: result,
  });
});

// Save new card to existing customer
const saveNewCardWithExistingCustomer = catchAsync(
  async (req: any, res: any) => {
    const result =
      await StripeServices.saveNewCardWithExistingCustomerIntoStripe(req.body);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: 'New card save successfully',
      data: result,
    });
  },
);

// Get all save cards for customer
const getCustomerSavedCards = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.getCustomerSavedCardsFromStripe(
    req?.params?.customerId,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Retrieve customer cards successfully',
    data: result,
  });
});

// Delete card from customer
const deleteCardFromCustomer = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.deleteCardFromCustomer(
    req.params?.paymentMethodId,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Delete a card successfully',
    data: result,
  });
});

// Refund payment to customer
const refundPaymentToCustomer = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.refundPaymentToCustomer(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Refund payment successfully',
    data: result,
  });
});

//payment from owner to rider
const createPaymentIntent = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.createPaymentIntentService(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Stipe payment successful',
    data: result,
  });
});

const getCustomerDetails = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.getCustomerDetailsFromStripe(
    req?.params?.customerId,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Retrieve customer cards successfully',
    data: result,
  });
});

const getAllCustomers = catchAsync(async (req: any, res: any) => {
  const result = await StripeServices.getAllCustomersFromStripe();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Retrieve customer details successfully',
    data: result,
  });
});


export const PaymentController = {
  saveCardWithCustomerInfo,
  authorizedPaymentWithSaveCard,
  capturePaymentRequest,
  saveNewCardWithExistingCustomer,
  getCustomerSavedCards,
  deleteCardFromCustomer,
  refundPaymentToCustomer,
  createPaymentIntent,
  getCustomerDetails,
  getAllCustomers,
  
};
