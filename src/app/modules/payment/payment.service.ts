import httpStatus from 'http-status';
import Stripe from 'stripe';
import config from '../../../config';
import { isValidAmount } from '../../utils/isValidAmount';
import { TStripeSaveWithCustomerInfo } from './payment.interface';
import prisma from '../../utils/prisma';
import { CheckoutStatus, PaymentStatus, UserRoleEnum } from '@prisma/client';
import AppError from '../../errors/AppError';
import { notificationServices } from '../notification/notification.services';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

// Step 1: Create a Customer and Save the Card
const saveCardWithCustomerInfoIntoStripe = async (
  payload: TStripeSaveWithCustomerInfo,
  userId: string,
) => {
  try {
    const { user, paymentMethodId, address } = payload;

    // Create a new Stripe customer
    const customer = await stripe.customers.create({
      name: user.name,
      email: user.email,
      address: {
        city: address.city,
        postal_code: address.postal_code,
        country: address.country,
      },
    });

    // Attach PaymentMethod to the Customer
    const attach = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    // Set PaymentMethod as Default
    const updateCustomer = await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // update profile with customerId
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        stripeCustomerId: customer.id,
      },
    });

    return {
      customerId: customer.id,
      paymentMethodId: paymentMethodId,
    };
  } catch (error: any) {
    throw Error(error.message);
  }
};

// Step 2: Authorize the Payment Using Saved Card

const authorizePaymentWithStripeCheckout = async (
  userId: string,
  payload: {
    checkoutId: string;
  },
) => {
  const { checkoutId } = payload;

  // Retrieve customer info
  const customerDetails = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      stripeCustomerId: true,
    },
  });

  if (!customerDetails) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Customer not found');
  }

  // Ensure Stripe Customer exists
  let customerId = customerDetails.stripeCustomerId;
  if (!customerId) {
    const stripeCustomer = await stripe.customers.create({
      email: customerDetails.email ?? undefined,
    });

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: stripeCustomer.id },
    });

    customerId = stripeCustomer.id;
  }

  // Retrieve checkout details
  const findCheckout = await prisma.checkout.findUnique({
    where: { id: checkoutId },
  });

  if (!findCheckout) {
    throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  }

  // Create Stripe Checkout Session (supports Card + P24)
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'p24'],
    line_items: [
      {
        price_data: {
          currency: 'pln',
          product_data: { name: `Payment for checkout ${checkoutId}` },
          unit_amount: Math.round(findCheckout.totalAmount * 100), // PLN to grosze
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    customer: customerId,
    success_url: `${config.frontend_base_url}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.frontend_base_url}/payment-cancel`,
    metadata: {
      userId,
      checkoutId,
    },
  });

  // Return URL to redirect user to Stripe-hosted payment page
  return { redirectUrl: session.url };
};



// Step 3: Capture the Payment
const capturePaymentRequestToStripe = async (payload: {
  paymentIntentId: string;
}) => {
  try {
    const { paymentIntentId } = payload;

    // Capture the authorized payment using the PaymentIntent ID
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    return paymentIntent;
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

// New Route: Save a New Card for Existing Customer
const saveNewCardWithExistingCustomerIntoStripe = async (payload: {
  customerId: string;
  paymentMethodId: string;
}) => {
  try {
    const { customerId, paymentMethodId } = payload;

    // Attach the new PaymentMethod to the existing Customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Optionally, set the new PaymentMethod as the default
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return {
      customerId: customerId,
      paymentMethodId: paymentMethodId,
    };
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

const getCustomerSavedCardsFromStripe = async (customerId: string) => {
  try {
    // List all payment methods for the customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return { paymentMethods: paymentMethods.data };
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

// Delete a card from a customer in the stripe
const deleteCardFromCustomer = async (paymentMethodId: string) => {
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    return { message: 'Card deleted successfully' };
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

// Refund amount to customer in the stripe
const refundPaymentToCustomer = async (payload: {
  paymentIntentId: string;
}) => {
  try {
    // Refund the payment intent
    const refund = await stripe.refunds.create({
      payment_intent: payload?.paymentIntentId,
    });

    return refund;
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

// Service function for creating a PaymentIntent
const createPaymentIntentService = async (payload: { amount: number }) => {
  if (!payload.amount) {
    throw new AppError(httpStatus.CONFLICT, 'Amount is required');
  }

  if (!isValidAmount(payload.amount)) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Amount '${payload.amount}' is not a valid amount`,
    );
  }

  // Create a PaymentIntent with Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: payload?.amount,
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true, // Enable automatic payment methods like cards, Apple Pay, Google Pay
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    dpmCheckerLink: `https://dashboard.stripe.com/settings/payment_methods/review?transaction_id=${paymentIntent.id}`,
  };
};

const getCustomerDetailsFromStripe = async (customerId: string) => {
  try {
    // Retrieve the customer details from Stripe
    const customer = await stripe.customers.retrieve(customerId);

    return customer;
  } catch (error: any) {
    throw new AppError(httpStatus.NOT_FOUND, error.message);
  }
};

const getAllCustomersFromStripe = async () => {
  try {
    // Retrieve all customers from Stripe
    const customers = await stripe.customers.list({
      limit: 2,
    });

    return customers;
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

export const StripeServices = {
  saveCardWithCustomerInfoIntoStripe,
  authorizePaymentWithStripeCheckout,
  capturePaymentRequestToStripe,
  saveNewCardWithExistingCustomerIntoStripe,
  getCustomerSavedCardsFromStripe,
  deleteCardFromCustomer,
  refundPaymentToCustomer,
  createPaymentIntentService,
  getCustomerDetailsFromStripe,
  getAllCustomersFromStripe,
};
