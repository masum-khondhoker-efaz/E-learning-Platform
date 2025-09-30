import prisma from '../../utils/prisma';
import { CheckoutStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import * as bcrypt from 'bcrypt';
import { send } from 'process';
import emailSender from '../../utils/emailSender';

// const createCheckoutIntoDb1 = async (userId: string, data: any) => {

//     const result = await prisma.checkout.create({
//     data: {
//       ...data,
//       userId: userId,
//     },
//   });
//   if (!result) {
//     throw new AppError(httpStatus.BAD_REQUEST, 'checkout not created');
//   }
//     return result;
// };

// Create checkout from cart

const createCheckoutIntoDb = async (userId?: string, companyId?: string) => {
  if (!userId && !companyId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Either userId or companyId is required',
    );
  }

  // 1. Get the cart
  const cart = await prisma.cart.findFirst({
    where: { userId, companyId },
    include: { items: { include: { course: true } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
  }

  // 2. Calculate total
  const totalAmount = cart.items.reduce(
    (sum, item) => sum + (item.course.price || 0),
    0,
  );

  // 3. Create checkout
  const checkout = await prisma.checkout.create({
    data: {
      cartId: cart.id,
      userId,
      companyId,
      totalAmount,
      status: CheckoutStatus.PENDING,
    },
    include: {
      cart: { include: { items: { include: { course: true } } } },
    },
  });

  return checkout;
};


const PASSWORD_LENGTH = 10;
const EMAIL_TRIES = 10;

/** Generate a random plain password */
function generateRandomPassword(length = PASSWORD_LENGTH): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/** Hash password */
async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

/**
 * Generate a unique employee login email using companyEmail's domain.
 * Uses the provided prisma transaction client (tx) to check uniqueness.
 */
async function generateUniqueEmployeeEmail(tx: any, companyEmail: string) {
  if (!companyEmail || !companyEmail.includes('@')) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Company email invalid for generating employee emails');
  }

  const [prefix, domain] = companyEmail.split('@');
  let tries = 0;
  while (tries < EMAIL_TRIES) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const candidate = `${prefix}_emp_${suffix}@${domain}`;

    // check user and employeeCredential uniqueness inside transaction
    const existingUser = await tx.user.findUnique({ where: { email: candidate } });
    const existingCred = await tx.employeeCredential.findFirst({ where: { loginEmail: candidate } });

    if (!existingUser && !existingCred) return candidate;
    tries++;
  }

  throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Could not generate unique employee email (too many collisions)');
}

/**
 * markCheckoutPaid
 * - checkoutId: id of checkout
 * - paymentId: provider id (Stripe/Przelewy24)
 *
 * Behavior:
 * - If checkout.userId -> enroll each cart item for that user
 * - If checkout.companyId -> create CompanyPurchase + CompanyPurchaseItem(s) + EmployeeCredential(s)
 *   (employee credentials created with hashed password stored in DB; plain password emailed)
 */
const markCheckoutPaid = async (userId: string, checkoutId: string, paymentId: string) => {
  // 1) Fetch checkout and cart items (sanity checks)
  const checkout = await prisma.checkout.findUnique({
    where: { id: checkoutId },
    include: {
      cart: {
        include: {
          items: {
            include: { course: true },
          },
        },
      },
    },
  });

  if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  if (checkout.status === 'PAID') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout already paid');
  }

  // ensure either userId xor companyId
  if (checkout.userId && checkout.companyId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout cannot have both userId and companyId');
  }
  if (!checkout.userId && !checkout.companyId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout must have either userId or companyId');
  }

  // If individual user checkout -> mark paid and enroll
  if (checkout.userId) {
    return await prisma.$transaction(async (tx) => {
      // update checkout status
      await tx.checkout.update({
        where: { id: checkoutId },
        data: { status: CheckoutStatus.PAID, paymentId },
      });

      // create + for each cart item (if not already enrolled)
      for (const item of checkout.cart.items) {
        const exists = await tx.enrolledCourse.findFirst({
          where: { userId: checkout.userId!, courseId: item.courseId },
        });
        if (!exists) {
          await tx.enrolledCourse.create({
            data: {
              userId: checkout.userId!,
              courseId: item.courseId,
            },
          });
        }
      }

      // optionally: clear cart items (if you want)
       await tx.cartItem.deleteMany({ where: { cartId: checkout.cart.id } });

      return { success: true, type: 'individual', checkoutId };
    });
  }

  // If company checkout -> create purchase + items + credentials
  // We will create the DB rows in a single transaction, but send emails AFTER commit.
  // Collect the credentials to email after the tx commits.
  const createdCredentialsForEmail: Array<{
    id: string;
    loginEmail: string;
    plainPassword: string;
    courseTitle: string;
    courseId: string;
  }> = [];

  // 2) Transaction: set checkout to PAID and create companyPurchase + items + credentials (isSent=false)
  await prisma.$transaction(async (tx) => {
    // mark checkout paid and attach paymentId
    await tx.checkout.update({
      where: { id: checkoutId },
      data: { status: 'PAID', paymentId },
    });

    // create CompanyPurchase
    const purchase = await tx.companyPurchase.create({
      data: {
        companyId: checkout.companyId!,
        totalAmount: checkout.totalAmount ?? 0,
        invoiceId: paymentId,
      },
    });

    // for each cart item create companyPurchaseItem + employeeCredential
    for (const item of checkout.cart.items) {
      // create purchase item
      const purchaseItem = await tx.companyPurchaseItem.create({
        data: {
          purchaseId: purchase.id,
          courseId: item.courseId,
        },
      });

      // generate unique email (use the tx to check uniqueness)
      const company = await tx.company.findUnique({ where: { id: checkout.companyId! } });
      if (!company || !company.companyEmail) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Company email not found for generating credentials');
      }

      const loginEmail = await generateUniqueEmployeeEmail(tx, company.companyEmail);
      const plainPassword = generateRandomPassword();
      const hashed = await hashPassword(plainPassword);

      // create credential with purchaseItemId reference (purchaseItemId is required in EmployeeCredential)
      const credential = await tx.employeeCredential.create({
        data: {
          companyId: checkout.companyId!,
          purchaseItemId: purchaseItem.id,
          courseId: item.courseId,
          loginEmail,
          password: hashed,     // store hashed password in `password` field (per your model)
          tempPassword: plainPassword, // optional - not recommended for long-term storage but provided per your model
          isSent: false,       // we'll send email after transaction commits
        },
      });

      // keep a copy to email after transaction commits
      createdCredentialsForEmail.push({
        id: credential.id,
        loginEmail,
        plainPassword,
        courseTitle: item.course?.courseTitle ?? 'Course',
        courseId: item.courseId,
      });
    }

    // optionally: clear cart items here if you want (inside transaction)
    await tx.cartItem.deleteMany({ where: { cartId: checkout.cart.id } });

    return;
  });

  // 3) After transaction committed: send credentials emails and update isSent/sentAt
  for (const c of createdCredentialsForEmail) {
    try {
      // send email to company email (or to the credential login email if you prefer)
      // I send to the company email as per your flow: manager distributes credentials
      const company = await prisma.company.findUnique({ where: { id: checkout.companyId! } });
      const recipient = company?.companyEmail ?? c.loginEmail;

      // email HTML (you can extract to a helper)
      const html = `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <table width="100%" style="border-collapse: collapse;">
            <tr>
              <td style="background-color: #46BEF2; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">Your Course Access</h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px;">
                <p style="font-size: 16px; margin: 0;">Hello,</p>
                <p style="font-size: 16px;">A credential has been created for <strong>${c.courseTitle}</strong>.</p>
                <div style="text-align: center; margin: 20px 0;">
                  <p style="font-size: 18px; margin-bottom: 10px;">Here are the login details:</p>
                  <p style="font-size: 16px; margin: 5px 0;">Email: <strong>${c.loginEmail}</strong></p>
                  <p style="font-size: 16px; margin: 5px 0;">Password: <strong>${c.plainPassword}</strong></p>
                </div>
                <p style="font-size: 16px;">Please distribute these credentials to the employee. On the first login the employee must complete their profile (first name, last name, date of birth) to get access to the course materials.</p>
                <p style="font-size: 14px; color: #555;">If you did not request this, please contact support.</p>
                <p style="font-size: 16px; margin-top: 20px;">Thank you,<br/>Barbers Time</p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Time. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </div>
      `;

      await emailSender(`Course Credentials for ${c.courseTitle}`, recipient, html);

      // update credential isSent true
      await prisma.employeeCredential.update({
        where: { id: c.id },
        data: {
          isSent: true,
          sentAt: new Date(),
          // optional: remove tempPassword for security after sending: tempPassword: null
        },
      });
    } catch (err) {
      // log error, continue with the next credential
      console.error('Failed to send credential email for', c.loginEmail, err);
      // do not throw — you might want to implement retrying later
    }
  }

  return {type: 'company', checkoutId };
};


const getCheckoutListFromDb = async (userId: string) => {
  const result = await prisma.checkout.findMany();
  if (result.length === 0) {
    return { message: 'No checkout found' };
  }
  return result;
};

const getCheckoutByIdFromDb = async (userId: string, checkoutId: string) => {
  const result = await prisma.checkout.findUnique({
    where: {
      id: checkoutId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'checkout not found');
  }
  return result;
};

const updateCheckoutIntoDb = async (
  userId: string,
  checkoutId: string,
  data: any,
) => {
  const result = await prisma.checkout.update({
    where: {
      id: checkoutId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'checkoutId, not updated');
  }
  return result;
};

const deleteCheckoutItemFromDb = async (userId: string, checkoutId: string) => {
  const deletedItem = await prisma.checkout.delete({
    where: {
      id: checkoutId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'checkoutId, not deleted');
  }

  return deletedItem;
};

export const checkoutService = {
  createCheckoutIntoDb,
  getCheckoutListFromDb,
  getCheckoutByIdFromDb,
  updateCheckoutIntoDb,
  deleteCheckoutItemFromDb,
  markCheckoutPaid,
};
