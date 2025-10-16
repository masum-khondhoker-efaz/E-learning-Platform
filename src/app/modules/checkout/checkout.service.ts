import prisma from '../../utils/prisma';
import { CheckoutStatus, UserRoleEnum, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import * as bcrypt from 'bcrypt';
import { send } from 'process';
import emailSender from '../../utils/emailSender';

const createCheckoutIntoDbForStudent = async (
  userId: string,
  data: { all?: boolean; courseIds?: string[] },
) => {
  return await prisma.$transaction(async tx => {

     // delete existing checkout and items if any
    await tx.checkoutItem.deleteMany({
      where: { checkout: { userId } },
    });
    await tx.checkout.deleteMany({
      where: { userId },
    });
    // 1. Get the user's cart and items
    const cart = await tx.cart.findUnique({
      where: { userId },
      include: { items: { include: { course: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
    }

    // 2. Decide which items to checkout
    let selectedItems;
    if (data.all) {
      selectedItems = cart.items;
    } else if (data.courseIds && data.courseIds.length > 0) {
      selectedItems = cart.items.filter(item =>
        data.courseIds?.includes(item.courseId),
      );
    } else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Provide either all=true or specific courseIds',
      );
    }

    if (selectedItems.length === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No valid cart items selected',
      );
    }

    // 3. Calculate total
    const totalAmount = selectedItems.reduce(
      (sum, item) => sum + (item.course.price || 0),
      0,
    );

    // 4. Create checkout record
    const checkout = await tx.checkout.create({
      data: {
        userId,
        totalAmount,
        status: CheckoutStatus.PENDING,
      },
    });

    // 5. Create checkout items
    await tx.checkoutItem.createMany({
      data: selectedItems.map(item => ({
        checkoutId: checkout.id,
        courseId: item.courseId,
      })),
    });

    // 6. Remove purchased items from cart
    await tx.cartItem.deleteMany({
      where: {
        id: { in: selectedItems.map(item => item.id) },
      },
    });

    return await tx.checkout.findUnique({
      where: { id: checkout.id },
      include: {
        items: {
          include: {
            course: {
              select: {
                id: true,
                courseTitle: true,
                courseShortDescription: true,
                price: true,
                discountPrice: true,
              },
            },
          },
        },
      },
    });
  });
};

// Create checkout from cart

type CreateCheckoutPayload = {
  all?: boolean;
  courseIds?: string[];
};

const createCheckoutIntoDbForCompany = async (
  companyId: string,
  data: CreateCheckoutPayload,
) => {
  if (!companyId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'companyId is required for company checkout',
    );
  }

  // 1. Load the cart owned by this company user (Cart.userId is the owner)
  const cart = await prisma.cart.findUnique({
    where: { userId: companyId }, // your Cart model uses unique userId
    include: { items: { include: { course: true } } },
  });

  if (!cart || !cart.items || cart.items.length === 0) {
    return { message: 'Cart is empty' };
  }

  // 2. Decide which cart items will be checked out
  let itemsToCheckout = cart.items;

  if (!data.all) {
    if (!data.courseIds || data.courseIds.length === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Provide either all=true or a non-empty courseIds array',
      );
    }
    const courseIdSet = new Set(data.courseIds);
    itemsToCheckout = cart.items.filter(ci => courseIdSet.has(ci.courseId));
  }

  if (!itemsToCheckout.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No valid cart items selected for checkout',
    );
  }

  // 3. Compute total amount from the selected items
  const totalAmount = itemsToCheckout.reduce(
    (sum, item) => sum + (item.course?.price ?? 0),
    0,
  );

  // 4. Do the DB changes in a transaction:
  //    - create Checkout
  //    - create CheckoutItem rows
  //    - remove the purchased CartItem rows
  const createdCheckout = await prisma.$transaction(async tx => {
    // Re-fetch cart items inside tx to avoid race conditions
    const txCart = await tx.cart.findUnique({
      where: { id: cart.id },
      include: { items: true },
    });
    if (!txCart) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Cart not found during transaction',
      );
    }

    // Validate selected item ids still belong to cart
    const txItemIds = new Set(txCart.items.map(it => it.id));
    const selectedItemIds = itemsToCheckout.map(it => it.id);
    const missing = selectedItemIds.filter(id => !txItemIds.has(id));
    if (missing.length > 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        'Some selected cart items are no longer available. Please refresh your cart.',
      );
    }

    // Create the checkout record
    const checkout = await tx.checkout.create({
      data: {
        userId: companyId,
        totalAmount,
        status: CheckoutStatus.PENDING,
      },
    });

    // Create CheckoutItem rows (one per selected cart item)
    // Using createMany for performance
    await tx.checkoutItem.createMany({
      data: itemsToCheckout.map(it => ({
        checkoutId: checkout.id,
        courseId: it.courseId,
      })),
    });

    // Remove purchased items from cart so user has remaining items left
    await tx.cartItem.deleteMany({
      where: {
        id: { in: selectedItemIds },
      },
    });

    return checkout; // tx will return this
  });

  // 5. Return the checkout with items & course details
  return await prisma.checkout.findUnique({
    where: { id: createdCheckout.id },
    include: {
      items: {
        include: {
          course: {
            select: {
              id: true,
              courseTitle: true,
              courseShortDescription: true,
              price: true,
              discountPrice: true,
            },
          },
        },
      },
    },
  });
};

const PASSWORD_LENGTH = 8;
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
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Company email invalid for generating employee emails',
    );
  }

  const [prefix, domain] = companyEmail.split('@');
  let tries = 0;
  while (tries < EMAIL_TRIES) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const candidate = `${prefix}_emp_${suffix}@${domain}`;

    // check user and employeeCredential uniqueness inside transaction
    const existingUser = await tx.user.findUnique({
      where: { email: candidate },
    });
    const existingCred = await tx.employeeCredential.findFirst({
      where: { loginEmail: candidate },
    });

    if (!existingUser && !existingCred) return candidate;
    tries++;
  }

  throw new AppError(
    httpStatus.INTERNAL_SERVER_ERROR,
    'Could not generate unique employee email (too many collisions)',
  );
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
const markCheckoutPaid = async (
  userId: string,
  checkoutId: string,
  paymentId: string,
) => {
  // 1) Fetch checkout and its items
  const checkout = await prisma.checkout.findUnique({
    where: { id: checkoutId, userId, status: CheckoutStatus.PENDING },
    include: {
      items: { include: { course: true } },
      user: true,
    },
  });

  if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  if (checkout.status === CheckoutStatus.PAID) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout already paid');
  }

  // Sanity check: must have items
  if (!checkout.items || checkout.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout has no items');
  }

  // 2) Individual student checkout
  if (checkout.user?.role === UserRoleEnum.STUDENT) {
    return await prisma.$transaction(async tx => {
      // update checkout status
      await tx.checkout.update({
        where: { id: checkoutId },
        data: { status: CheckoutStatus.PAID },
      });

      // enroll for each course if not already
      for (const item of checkout.items) {
        const exists = await tx.enrolledCourse.findFirst({
          where: { userId: checkout.userId, courseId: item.courseId },
        });
        if (!exists) {
          await tx.enrolledCourse.create({
            data: {
              userId: checkout.userId,
              courseId: item.courseId,
              paymentStatus: PaymentStatus.COMPLETED,
            },
          });
        }
      }

      return { success: true, type: 'individual', checkoutId };
    });
  }

  // 3) Company checkout
  if (checkout.user?.role === UserRoleEnum.COMPANY) {
    const createdCredentialsForEmail: Array<{
      id: string;
      loginEmail: string;
      plainPassword: string;
      courseTitle: string;
      courseId: string;
    }> = [];

    await prisma.$transaction(async tx => {
      // mark checkout paid
      await tx.checkout.update({
        where: { id: checkoutId, userId, status: CheckoutStatus.PENDING },
        data: { status: CheckoutStatus.PAID },
      });

      // create CompanyPurchase
      const company = await tx.company.findFirst({
        where: { userId: checkout.userId },
      });
      if (!company) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Company not found for this checkout',
        );
      }

      const purchase = await tx.companyPurchase.create({
        data: {
          companyId: company.userId,
          totalAmount: checkout.totalAmount ?? 0,
          invoiceId: paymentId,
        },
      });

      // create purchase items and credentials
      for (const item of checkout.items) {
        const purchaseItem = await tx.companyPurchaseItem.create({
          data: {
            purchaseId: purchase.id,
            courseId: item.courseId,
          },
        });

        const loginEmail = await generateUniqueEmployeeEmail(
          tx,
          company.companyEmail,
        );
        const plainPassword = generateRandomPassword();
        const hashed = await hashPassword(plainPassword);

        const credential = await tx.employeeCredential.create({
          data: {
            companyId: company.id,
            purchaseItemId: purchaseItem.id,
            courseId: item.courseId,
            loginEmail,
            password: hashed,
            tempPassword: plainPassword,
            paymentStatus: PaymentStatus.COMPLETED,
            isSent: false,
          },
        });

        createdCredentialsForEmail.push({
          id: credential.id,
          loginEmail,
          plainPassword,
          courseTitle: item.course?.courseTitle ?? 'Course',
          courseId: item.courseId,
        });
      }
    });

    // send emails after commit
    for (const c of createdCredentialsForEmail) {
      try {
        const company = await prisma.company.findFirst({
          where: { userId: checkout.userId },
          include: {
            User: {
              select: { email: true, fullName: true },
            },
          },
        });
        const recipient = company?.User.email;
        if (!recipient) {
          console.error('Company email not found, cannot send credentials');
          continue;
        }

        const html = `
  <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
      <!-- Header -->
      <tr>
        <td style="background-color: #46BEF2; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0; font-size: 24px;">Course Access Details</h2>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding: 20px;">
          <p style="font-size: 16px; margin: 0;">Hello <strong>${company.User.fullName}</strong>,</p>
          <p style="font-size: 16px;">A new credential has been created for your course:</p>

          <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 18px; margin: 5px 0;">
              <strong>Course:</strong> ${c.courseTitle}
            </p>
            <p style="font-size: 16px; margin: 5px 0;">
              <strong>Login Email:</strong> ${c.loginEmail}
            </p>
            <p style="font-size: 16px; margin: 5px 0;">
              <strong>Password:</strong> ${c.plainPassword}
            </p>
          </div>

          <p style="font-size: 14px; color: #555;">
            Please use these credentials to log in and access your course materials.
          </p>

          <p style="font-size: 14px; color: #555; margin-top: 20px;">
            If you did not request this course or have any issues, please contact our support team.
          </p>

          <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>E-learning Team</p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-learning Team. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </div>
`;

        await emailSender(
          `Course Credentials for ${c.courseTitle}`,
          recipient,
          html,
        );

        await prisma.employeeCredential.update({
          where: { id: c.id },
          data: {
            isSent: true,
            sentAt: new Date(),
            tempPassword: null, // clear temp password after sending
          },
        });
      } catch (err) {
        console.error('Failed to send credential email for', c.loginEmail, err);
      }
    }

    return { success: true, type: 'company', checkoutId };
  }

  throw new AppError(
    httpStatus.BAD_REQUEST,
    'Checkout user role must be STUDENT or COMPANY',
  );
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
  createCheckoutIntoDbForStudent,
  createCheckoutIntoDbForCompany,
  getCheckoutListFromDb,
  getCheckoutByIdFromDb,
  updateCheckoutIntoDb,
  deleteCheckoutItemFromDb,
  markCheckoutPaid,
};
