import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

// const createCartIntoDb1 = async (userId: string, data: any) => {

//     const result = await prisma.cart.create({
//     data: {
//       ...data,
//       userId: userId,
//     },
//   });
//   if (!result) {
//     throw new AppError(httpStatus.BAD_REQUEST, 'cart not created');
//   }
//     return result;
// };

const getOrCreateCart = async (userId?: string, companyId?: string) => {
  if (!userId && !companyId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Either userId or companyId is required',
    );
  }

  const whereCondition = userId ? { userId } : { companyId };

  let cart = await prisma.cart.findFirst({
    where: whereCondition,
    include: { items: { include: { course: true } } },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: whereCondition,
      include: { items: { include: { course: true } } },
    });
  }

  return cart;
};

const createCartIntoDb = async (
  data: { courseId: string },
  userId?: string,
  companyId?: string,
) => {
  const cart = await getOrCreateCart(userId, companyId);

  // check if course already in cart
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      courseId: data.courseId,
    },
  });

  if (existingItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Course already in cart');
  }

  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      courseId: data.courseId,
    },
  });

  // return updated cart
  return await getOrCreateCart(userId, companyId);
};

// const getCartListFromDb1 = async (userId: string) => {

//     const result = await prisma.cart.findMany();
//     if (result.length === 0) {
//     return { message: 'No cart found' };
//   }
//     return result;
// };

const getCartListFromDb = async (cartId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { course: true } } },
  });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  return cart.items;
};

const getCartByIdFromDb = async (userId: string, cartId: string) => {
  const result = await prisma.cart.findUnique({
    where: {
      id: cartId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'cart not found');
  }
  return result;
};

const updateCartIntoDb = async (userId: string, cartId: string, data: any) => {
  const result = await prisma.cart.update({
    where: {
      id: cartId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'cartId, not updated');
  }
  return result;
};

// const deleteCartItemFromDb1 = async (userId: string, cartId: string) => {
//     const deletedItem = await prisma.cart.delete({
//       where: {
//       id: cartId,
//       userId: userId,
//     },
//   });
//   if (!deletedItem) {
//     throw new AppError(httpStatus.BAD_REQUEST, 'cartId, not deleted');
//   }

//     return deletedItem;
// };

const deleteCartItemFromDb = async (cartId: string, courseId: string) => {
  const existing = await prisma.cartItem.findUnique({
    where: {
      cartId_courseId: { cartId, courseId },
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found in cart');
  }

  await prisma.cartItem.delete({
    where: { cartId_courseId: { cartId, courseId } },
  });

  return { message: 'Course removed from cart' };
};


// Get the current cart
const getCart = async (userId?: string, companyId?: string) => {
  const cart = await getOrCreateCart(userId, companyId);
  return cart;
};


export const cartService = {
  createCartIntoDb,
  getCartListFromDb,
  getCartByIdFromDb,
  updateCartIntoDb,
  deleteCartItemFromDb,
  getCart,
};
