import { Request, Response } from 'express';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status';
import { StripeServices } from './payment.service';
import {  PaymentStatus, UserRoleEnum } from '@prisma/client';
import prisma from '../../utils/prisma';
import Stripe from 'stripe';
import config from '../../../config';
import { checkoutService } from '../checkout/checkout.service';
import AppError from '../../errors/AppError';
import emailSender from '../../utils/emailSender';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

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
    user.id,
    req.body,
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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const handleWebHook = catchAsync(async (req: any, res: any) => {
  const sig = req.headers['stripe-signature'] as string;
 let courseTitle: string = '';
  if (!sig) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Missing Stripe signature header.',
      data: null,
    });
  }

  let event: Stripe.Event;
 

  try {
    event = Stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.stripe_webhook_secret as string,
    );
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return res.status(400).send('Webhook Error');
  }

  
  // ✅ Handle event types
  try {
    switch (event.type) {
      // ✅ Case 1: Payment succeeded via Checkout
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.userId;
        const checkoutId = session.metadata?.checkoutId;

        if (!userId || !checkoutId) {
          console.error('Missing metadata in Checkout Session');
          break;
        }
        courseTitle = session.metadata?.courseTitle as string; 

        // Create or update payment record
                let payment = await prisma.payment.findFirst({
                  where: { paymentIntentId: session.payment_intent as string },
                });
        
                if (payment) {
                  // update using the unique id
                  payment = await prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                      status: PaymentStatus.COMPLETED,
                      paymentIntentId: session.payment_intent as string,
                      paymentAmount: session.amount_total
                        ? session.amount_total / 100
                        : 0,
                      amountProvider: session.customer as string,
                      paymentDate: new Date(),
                    },
                  });
                } else {
                  payment = await prisma.payment.create({
                    data: {
                      userId,
                      paymentAmount: session.amount_total
                        ? session.amount_total / 100
                        : 0,
                      paymentIntentId: session.payment_intent as string,
                      // invoice: session.return_url,
                      amountProvider: session.customer as string,
                      status: PaymentStatus.COMPLETED,
                      paymentDate: new Date(),
                    },
                  });
                }
        
                if (!payment) {
                  throw new AppError(httpStatus.BAD_REQUEST, 'Payment creation failed');
                }

        // Update checkout status
        await checkoutService.markCheckoutPaid(userId, checkoutId, payment.id);

        // await handleCheckoutCompleted(event);



        console.log('✅ Payment completed and database updated');
        break;
      }

      case 'charge.updated': {
        const charge = event.data.object as Stripe.Charge;

        if (charge.status === 'succeeded' && charge.payment_intent) {
          await prisma.payment.updateMany({
            where: { paymentIntentId: charge.payment_intent as string },
            data: {
              status: PaymentStatus.COMPLETED,
              paymentDate: new Date(),
              // invoice: charge.receipt_url,
              paymentMethodId: charge.payment_method as string,
              paymentMethod: charge.payment_method_details?.type,
            },
          });
          const receiptUrl = charge.receipt_url;

          if (charge.billing_details?.email && receiptUrl) {
            const html = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="background-color: #46BEF2; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">Payment Successful</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px;">
            <p style="font-size: 16px;">Hello <strong>${charge.billing_details?.name || 'Customer'}</strong>,</p>
            <p style="font-size: 16px;">Your payment for the course <strong>${courseTitle}</strong> was successful.</p>
            <p style="font-size: 16px;">You can view your payment receipt below:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${receiptUrl}" target="_blank" style="background-color: #46BEF2; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Receipt</a>
            </div>
            <p style="font-size: 14px; color: #555;">If you have any questions, feel free to contact our support team.</p>
            <p style="font-size: 16px; margin-top: 20px;">Thank you,<br/>E-learning Team</p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-learning Team. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>
  `;

            await emailSender(
              `Your payment for ${courseTitle} is successful`,
              charge.billing_details?.email,
              html,
            );
          }

          console.log('✅ Charge succeeded, payment marked as completed');
        }
        break;
      }

      // ❌ Case 2: Payment failed
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;

        await prisma.payment.updateMany({
          where: { paymentIntentId: intent.id },
          data: { status: PaymentStatus.FAILED },
        });

        console.log('❌ Payment failed, updated in DB');
        break;
      }

      // 🕐 Case 3: Payment is processing
      case 'payment_intent.processing': {
        const intent = event.data.object as Stripe.PaymentIntent;

        await prisma.payment.updateMany({
          where: { paymentIntentId: intent.id },
          data: { status: PaymentStatus.REQUIRES_CAPTURE },
        });

        console.log('⏳ Payment processing, marked as pending');
        break;
      }

      // 🧾 Case 4: Payment captured (manual capture)
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;

        await prisma.payment.updateMany({
          where: { paymentIntentId: intent.id },
          data: {
            status: PaymentStatus.COMPLETED,
            paymentDate: new Date(),
          },
        });

        console.log('✅ PaymentIntent succeeded, updated in DB');
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    res.status(200).send('Event received');
  } catch (err) {
    console.error('Error handling webhook event:', err);
    res.status(500).send('Webhook handling failed');
  }
});

const handleCheckoutCompleted = async (event: Stripe.Event) => {
  const session = event.data.object as Stripe.Checkout.Session;

  // 🧾 1. Get course + user metadata
  const courseTitle = session.metadata?.courseTitle ?? 'Course';
  const userId = session.metadata?.userId;
  const nip = session.metadata?.nip ?? '---';
  const customerName = session.customer_details?.name ?? 'Unknown';
  const customerEmail = session.customer_details?.email ?? 'Unknown';

  // 🧾 2. Create Stripe invoice
  const invoiceItem = await stripe.invoiceItems.create({
  customer: session.customer as string,
  amount: session.amount_total ?? 0,
  currency: session.currency ?? 'pln',
  description: `Payment for course: ${courseTitle}`,
});

const invoice = await stripe.invoices.create({
  customer: session.customer as string,
  auto_advance: true,
  collection_method: 'charge_automatically', // ✅ For already paid sessions
});


  // 💾 3. Generate Polish-style invoice PDF
  const pdfPath = path.join('/tmp', `invoice_${invoice.number || Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(18).text('Faktura VAT', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Numer faktury: ${invoice.number || 'FV/Auto'}`);
  doc.text(`Data wystawienia: ${new Date().toLocaleDateString('pl-PL')}`);
  doc.text(`Metoda płatności: Stripe Checkout`);
  doc.moveDown();

  // Seller info
  doc.text('Sprzedawca: LeriRides Sp. z o.o.');
  doc.text('NIP: 5211234567');
  doc.text('Adres: ul. Przykładowa 1, Warszawa, Polska');
  doc.moveDown();

  // Buyer info
  doc.text(`Nabywca: ${customerName}`);
  doc.text(`Email: ${customerEmail}`);
  doc.text(`NIP: ${nip}`);
  doc.moveDown();

  // Line items
  const gross = (session.amount_total ?? 0) / 100;
  const vatRate = 0.23;
  const net = gross / (1 + vatRate);
  const vat = gross - net;

  doc.text(`Opis: ${courseTitle}`);
  doc.text(`Kwota netto: ${net.toFixed(2)} PLN`);
  doc.text(`VAT (23%): ${vat.toFixed(2)} PLN`);
  doc.text(`Suma brutto: ${gross.toFixed(2)} PLN`);
  doc.end();

  // 💾 4. Save invoice PDF path in DB
  // find the user first then check for student or company role
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found for invoice saving');
  }

  if (user.role === UserRoleEnum.STUDENT || user.role === UserRoleEnum.COMPANY) {
    await prisma.enrolledCourse.updateMany({
      where: {
        userId: user.id,
        course: { courseTitle: courseTitle },
        paymentStatus: PaymentStatus.COMPLETED,
      },
      data: {
        invoice: invoice.hosted_invoice_url,
        // localInvoicePath: pdfPath,
      },
    });
  } else if (user.role === UserRoleEnum.EMPLOYEE) {
    await prisma.companyPurchase.updateMany({
      where: {
        companyId: user.id,
        items: { some: { course: { courseTitle: courseTitle } } },
      },
      data: {
        invoice: invoice.hosted_invoice_url,
        // localInvoicePath: pdfPath,
      },
    });
  }

  // 📧 5. Optionally send to customer
  await emailSender(
    `Faktura VAT za kurs ${courseTitle}`,
    customerEmail,
    `<p>W załączniku znajduje się faktura VAT za zakup kursu ${courseTitle}.</p>`,
    pdfPath,
  );
  
 

  console.log('✅ Polish VAT invoice generated and sent');
};

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
  handleWebHook,
};
