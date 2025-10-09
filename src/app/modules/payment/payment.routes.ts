import express from 'express';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';
import { PaymentController } from './payment.controller';

const router = express.Router();


import {
  AuthorizedPaymentPayloadSchema,
  capturedPaymentPayloadSchema,
  refundPaymentPayloadSchema,
  saveNewCardWithExistingCustomerPayloadSchema,
  TStripeSaveWithCustomerInfoPayloadSchema,
} from './payment.validation';
import validateRequest from '../../middlewares/validateRequest';


// create a new customer with card
router.post(
  '/save-card',
  auth(),
  validateRequest(TStripeSaveWithCustomerInfoPayloadSchema),
  PaymentController.saveCardWithCustomerInfo,
);

// Authorize the customer with the amount and send payment request
router.post(
  '/authorize-payment',
  auth(),
  validateRequest(AuthorizedPaymentPayloadSchema),
  PaymentController.authorizedPaymentWithSaveCard,
);

// Capture the payment request and deduct the amount
router.post(
  '/capture-payment',
  validateRequest(capturedPaymentPayloadSchema),
  PaymentController.capturePaymentRequest,
);

// Save new card to existing customer
router.post(
  '/save-new-card',
  validateRequest(saveNewCardWithExistingCustomerPayloadSchema),
  PaymentController.saveNewCardWithExistingCustomer,
);


// Delete card from customer
router.delete(
  '/delete-card/:paymentMethodId',
  PaymentController.deleteCardFromCustomer,
);

// Refund payment to customer
router.post(
  '/refund-payment',
  validateRequest(refundPaymentPayloadSchema),
  PaymentController.refundPaymentToCustomer,
);

router.get('/customers/:customerId', PaymentController.getCustomerDetails);

router.get(
  '/customers', 
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  PaymentController.getAllCustomers);
  
  router.get('/:customerId', PaymentController.getCustomerSavedCards);


export const PaymentRoutes = router;
