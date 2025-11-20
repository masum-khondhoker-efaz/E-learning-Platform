import prisma from '../../utils/prisma';
import { CheckoutStatus, UserRoleEnum, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import * as bcrypt from 'bcrypt';
import { send } from 'process';
import emailSender from '../../utils/emailSender';

function threeDigitsToWords(n: number): string {
  const ones = [
    '',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
  ];
  const teens = [
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ];
  const tens = [
    '',
    '',
    'twenty',
    'thirty',
    'forty',
    'fifty',
    'sixty',
    'seventy',
    'eighty',
    'ninety',
  ];

  let out = '';
  if (n >= 100) {
    out += ones[Math.floor(n / 100)] + ' hundred';
    n = n % 100;
    if (n) out += ' ';
  }
  if (n >= 20) {
    out += tens[Math.floor(n / 10)];
    n = n % 10;
    if (n) out += '-' + ones[n];
  } else if (n >= 10) {
    out += teens[n - 10];
  } else if (n > 0) {
    out += ones[n];
  } else if (!out) {
    out = 'zero';
  }
  return out;
}

// helper: convert whole number to words (English) up to trillions
function integerToWords(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const scales = [
    { value: 1_000_000_000_000, name: 'trillion' },
    { value: 1_000_000_000, name: 'billion' },
    { value: 1_000_000, name: 'million' },
    { value: 1_000, name: 'thousand' },
  ];
  for (const s of scales) {
    if (n >= s.value) {
      const cnt = Math.floor(n / s.value);
      parts.push(`${threeDigitsToWords(cnt)} ${s.name}`);
      n = n % s.value;
    }
  }
  if (n > 0) {
    parts.push(threeDigitsToWords(n));
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
// Convert VAT % from "20" to 0.20
function normalizeVat(v: number) {
  return v > 1 ? v / 100 : v;
}

// Calculate price ex VAT, VAT amount and final price
function calculatePrices(
  basePrice: number,
  discount?: number,
  vatPerc?: number,
) {
  const vat = normalizeVat(vatPerc ?? 0);

  // Step 1: Apply discount if available (discount and basePrice are net, VAT not included)
  const finalBase =
    typeof discount === 'number' && discount > 0 && discount < basePrice
      ? discount
      : basePrice;

  // Since basePrice is net (VAT not included):
  const priceExVat = finalBase;

  // VAT amount based on net price (vat is already normalized to a decimal, e.g. 0.23)
  const vatAmount = priceExVat * vat;

  // Price including VAT
  const priceIncVat = priceExVat * (1 + vat);

  return {
    base: basePrice,
    finalBase,
    priceExVat,
    vatAmount,
    priceIncVat,
  };
}

async function generateAndAssignInvoiceNumber(): Promise<string> {
  const now = new Date();
  const month = now.getMonth() + 1; // 1..12
  const year = now.getFullYear();

  // load existing company purchases' invoice payloads (may be JSON objects)
  const companyPurchases = await prisma.companyPurchase.findMany({
    // where: { invoice: { not: null } as any },
    select: { invoice: true },
  });

  const enrolledCourseInvoices = await prisma.enrolledCourse.findMany({
    // where: { invoice: { not: null } as any },
    select: { invoice: true },
  });

  // Combine both sources so invoice sequence considers invoices issued for both company purchases and individual enrollments
  const purchases = [...companyPurchases, ...enrolledCourseInvoices];

  // pattern: seq/month/year/LE
  const pattern = /^(\d+)\/(\d{1,2})\/(\d{4})\/LE$/;
  let maxSeqForYear = 0;

  for (const p of purchases) {
    const inv = p.invoice as any;
    // invoice may be stored as object where the invoice number sits under 'Invoice'
    let invString: string | undefined;
    if (typeof inv === 'string') {
      invString = inv;
    } else if (inv && typeof inv === 'object') {
      // prefer new 'Invoice' field
      invString =
        (inv['Invoice'] as string) ??
        (inv.invoice as string) ??
        (inv.invoice_number as string) ??
        undefined;
    }
    if (!invString) continue;
    const m = invString.match(pattern);
    if (!m) continue;
    const seq = parseInt(m[1], 10);
    const invYear = parseInt(m[3], 10);
    if (invYear === year && seq > maxSeqForYear) maxSeqForYear = seq;
  }

  let candidateSeq = maxSeqForYear + 1;
  let candidate = `${candidateSeq}/${month}/${year}/LE`;

  // Ensure absolute uniqueness (in case of race/collisions) by re-checking existence
  // Try a few times incrementing the sequence if collision is found
  const MAX_TRIES = 50;
  let tries = 0;
  while (tries < MAX_TRIES) {
    // check in-memory loaded invoices first (covers both companyPurchase and enrolledCourse)
    const collisionInMemory = purchases.some(p => {
      const inv = p.invoice as any;
      if (typeof inv === 'string') return inv === candidate;
      if (inv && typeof inv === 'object') {
        const val =
          (inv['Invoice'] as string) ??
          (inv.invoice as string) ??
          (inv.invoice_number as string) ??
          undefined;
        return val === candidate;
      }
      return false;
    });

    if (!collisionInMemory) {
      // also check DB for a plain-string invoice stored on companyPurchase (best-effort)
      // use JsonNullableFilter shape so Prisma accepts the filter (equals)
      const exists = await prisma.companyPurchase.findFirst({
        where: {
          invoice: { equals: candidate as any },
        } as any,
        select: { id: true },
      });

      if (!exists) break;
    }

    candidateSeq += 1;
    candidate = `${candidateSeq}/${month}/${year}/LE`;
    tries += 1;
  }

  if (tries >= MAX_TRIES) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Could not generate unique invoice number',
    );
  }

  // return the generated unique invoice number
  return candidate;
}

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
    const totalAmount = selectedItems.reduce((sum, item) => {
      const price = item.course?.price ?? 0;
      const discount = item.course?.discountPrice ?? null;
      const effectivePrice =
        typeof discount === 'number' && discount > 0 && discount < price
          ? discount
          : price;
      return sum + effectivePrice;
    }, 0);

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
  // 1) Fetch checkout and its items (lookup by id only; validate ownership/status after)
  const checkout = await prisma.checkout.findUnique({
    where: { id: checkoutId },
    include: {
      items: { include: { course: true } },
      user: true,
    },
  });

  if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  // validate ownership
  if (checkout.userId !== userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  }
  // validate status
  if (checkout.status === CheckoutStatus.PAID) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout already paid');
  }
  if (checkout.status !== CheckoutStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Checkout is not in a payable state',
    );
  }

  // Sanity check: must have items
  if (!checkout.items || checkout.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout has no items');
  }

  // 2) Individual student checkout
  if (checkout.user?.role === UserRoleEnum.STUDENT) {
    const findStudent = await prisma.user.findUnique({
      where: { id: checkout.userId },
    });
    if (!findStudent) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Student not found for checkout',
      );
    }
    const findCourseCreator = await prisma.course.findFirst({
      where: { id: checkout.items[0].courseId },
    });
    if (!findCourseCreator) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Course not found for checkout',
      );
    }
    const courseCreator = await prisma.user.findUnique({
      where: { id: findCourseCreator.userId },
    });
    if (!courseCreator) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Course creator not found for checkout',
      );
    }

    const invoiceData = {
      Seller: courseCreator.fullName,
      Email: courseCreator.email,
      NIP: courseCreator.vatId,
      'Contact Number': courseCreator.phoneNumber,
      Address: courseCreator.address,

      Buyer: findStudent.fullName,
      'Buyer Email': findStudent.email,
      'Buyer NIP': findStudent.vatId,
      'Buyer Contact Number': findStudent.phoneNumber,
      'Buyer Address': findStudent.address,
      'Invoice Number': paymentId,
      'Invoice Date': new Date().toLocaleDateString(),
      'Course(s) Purchased': checkout.items
        .map(item => item.course.courseTitle)
        .join(', '),
      'Course ID(s)': checkout.items.map(item => item.courseId).join(', '),
      'Course Price(s)': checkout.items
        .map(item => {
          const price = item.course?.price ?? 0;
          const discount = item.course?.discountPrice ?? null;
          const effectivePrice =
            typeof discount === 'number' && discount > 0 && discount < price
              ? discount
              : price;
          return effectivePrice.toFixed(2);
        })
        .join(', '),
      'Course vat rate(s) included ': checkout.items.map(_ => '23%').join(', '),
      'Total Amount': checkout.totalAmount?.toFixed(2),
    };

    return await prisma.$transaction(async tx => {
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
              invoice: invoiceData,
              totalAmount: checkout.totalAmount ?? 0,
            },
          });
        }
      }
      // delete the checkout (and its items via cascade) - delete by id only
      await tx.checkoutItem.deleteMany({ where: { checkoutId } });

      await tx.checkout.delete({
        where: { id: checkoutId },
      });

      return { success: true, type: 'individual', checkoutId };
    });
  }

  // 3) Company checkout
  if (checkout.user?.role === UserRoleEnum.COMPANY) {
    const findStudent = await prisma.user.findUnique({
      where: { id: checkout.userId },
    });
    if (!findStudent) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Student not found for checkout',
      );
    }
    const findCourseCreator = await prisma.course.findFirst({
      where: { id: checkout.items[0].courseId },
    });
    if (!findCourseCreator) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Course not found for checkout',
      );
    }
    const courseCreator = await prisma.user.findUnique({
      where: { id: findCourseCreator.userId },
    });
    if (!courseCreator) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Course creator not found for checkout',
      );
    }

    // generate a readable unique invoice number like "1/10/2025/LE" and assign it to paymentId
    // sequence resets each year (cumulative per year). Checks existing CompanyPurchase.invoice values.

    // call the generator so paymentId is replaced with the invoice number for the company flow
    // call the generator to produce a unique invoice number for the company flow
    const invoiceNumber = await generateAndAssignInvoiceNumber();
    // 'JM': 'szt.',
    //  'liczba sztuk': checkout.items.length,
    // 'Cena netto': checkout.totalAmount?.toFixed(2),

    const invoiceData = (() => {
      // compute per-item prices using our helper to avoid inconsistencies
      const items = checkout.items.map(item => {
        const price = item.course?.price ?? 0;
        const discount = item.course?.discountPrice ?? undefined;
        const vatPerc = item.course?.vatPercentage ?? 0; // expect 23 or 0.0 style; calculatePrices normalizes
        const p = calculatePrices(price, discount, vatPerc);
        return {
          courseId: item.courseId,
          courseTitle: item.course?.courseTitle ?? 'Course',
          unitExVat: p.priceExVat,
          vatAmount: p.vatAmount,
          unitIncVat: p.priceIncVat,
          quantity: 1, // checkout item represents one seat; change if your model supports quantity
          totalExVat: p.priceExVat * 1,
          totalIncVat: p.priceIncVat * 1,
        };
      });

      const totalExVat = items.reduce((s, it) => s + it.totalExVat, 0);
      const totalVat = items.reduce(
        (s, it) => s + it.vatAmount * it.quantity,
        0,
      );
      const totalIncVat = items.reduce((s, it) => s + it.totalIncVat, 0);

      return {
        Seller: courseCreator.fullName,
        Email: courseCreator.email,
        NIP: courseCreator.vatId,
        Address: courseCreator.address,

        Buyer: findStudent.fullName,
        'Buyer Email': findStudent.email,
        'Buyer NIP': findStudent.vatId,
        'Buyer Address': findStudent.address,

         Invoice: invoiceNumber,
        'Invoice Date': new Date().toLocaleDateString(),

        'Course(s) Purchased': items.map(i => i.courseTitle).join(', '),
        'Course ID(s)': items.map(i => i.courseId).join(', '),
        'Course(s) unit': 'szt.',
        'Number of Course(s)': items.length,

        // Unit prices (ex VAT)
        'Course(s) Price(s) (ex VAT)': items
          .map(i => i.unitExVat.toFixed(2))
          .join(', '),

        // VAT amount per course (net)
        'Course(s) VAT Amount(s)': items
          .map(i => i.vatAmount.toFixed(2))
          .join(', '),

        // Price including VAT per course (unit)
        'Course(s) Price(s) (inc VAT)': items
          .map(i => i.unitIncVat.toFixed(2))
          .join(', '),

        // Total per course (quantity x unit ex VAT)
        'Course(s) Total (qty x unit ex VAT)': items
          .map(
            i =>
              `${i.quantity} x ${i.unitExVat.toFixed(2)} = ${i.totalExVat.toFixed(2)} (${i.courseTitle})`,
          )
          .join(', '),

        // Totals
        'Total Amount (ex VAT)': totalExVat.toFixed(2),
        'Total VAT amount': totalVat.toFixed(2),
        'Total Amount (inc VAT)': totalIncVat.toFixed(2),

        // keep original Total Amount for compatibility (use ex VAT if that's how checkout.totalAmount is stored)
        'Total Amount Payable': totalIncVat.toFixed(2),

        // Proper amount in words (total invoice, using inc VAT amount)
        'Total amount in words': `${integerToWords(Math.floor(totalIncVat))} złoty and ${Math.round(
          (totalIncVat % 1) * 100,
        )
          .toString()
          .padStart(2, '0')} groszy`,
        'Payment Method': 'Pzrzelewy24 / Blik / Card',
        'Company account number': '12 3456 7890 1234 5678 9012 3456',
        'Signature of the person authorized to receive the vat invoice':
          '____________________',
        'Signature of the person authorized to issue the vat invoice':
          '____________________',
      };
    })();

    const createdCredentialsForEmail: Array<{
      id: string;
      loginEmail: string;
      plainPassword: string;
      courseTitle: string;
      courseId: string;
    }> = [];

    await prisma.$transaction(async tx => {
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
          invoice: invoiceData,
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
            companyId: company.userId,
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
      // delete the checkout (and its items via cascade) - delete by id only
      await tx.checkout.delete({
        where: { id: checkoutId },
      });
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
            tempPassword: null,
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
  const result = await prisma.checkout.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          course: {
            select: {
              id: true,
              courseTitle: true,
              courseShortDescription: true,
              courseThumbnail: true,
              price: true,
              discountPrice: true,
            },
          },
        },
      },
    },
  });

  if (!result || result.length === 0) {
    return [];
  }

  // flatten items for each checkout
  return result.map(checkout => ({
    ...checkout,
    items: checkout.items.map(item => ({
      id: item.id,
      courseId: item.courseId,
      courseTitle: item.course.courseTitle,
      courseShortDescription: item.course.courseShortDescription,
      courseThumbnail: item.course.courseThumbnail,
      price: item.course.price,
      discountPrice: item.course.discountPrice,
    })),
  }));
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
  return await prisma.$transaction(async tx => {
    // fetch checkout by id and validate ownership
    const checkout = await tx.checkout.findUnique({
      where: { id: checkoutId },
    });
    if (!checkout || checkout.userId !== userId) {
      throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
    }

    // delete checkout items for this checkout
    const deletedItems = await tx.checkoutItem.deleteMany({
      where: { checkoutId },
    });

    if (deletedItems.count === 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'No checkout items deleted');
    }

    // delete the checkout record itself
    const deletedCheckout = await tx.checkout.delete({
      where: { id: checkoutId },
    });

    return { deletedCheckout, deletedItemsCount: deletedItems.count };
  });
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
