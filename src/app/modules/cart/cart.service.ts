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

const getOrCreateCart = async (userId: string) => {
  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'userId is required');
  }

  let cart = await prisma.cart.findFirst({
    where: { userId },
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

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
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
  }

  return cart;
};

const createCartIntoDb = async (userId: string, data: { courseId: string }) => {
  // always get or create cart for this user
  const cart = await getOrCreateCart(userId);

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
  return await getOrCreateCart(userId);
};

// const getCartListFromDb1 = async (userId: string) => {

//     const result = await prisma.cart.findMany();
//     if (result.length === 0) {
//     return { message: 'No cart found' };
//   }
//     return result;
// };

const getCartListFromDb = async (userId: string) => {
  const cart = await prisma.cart.findFirst({
    where: { userId: userId },
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

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  return cart.items;
};

const getCartByIdFromDb = async (userId: string, cartItemId: string) => {
  const result = await prisma.cart.findUnique({
    where: {
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'cart not found');
  }

  const cartItem = await prisma.cartItem.findUnique({
    where: {
      id: cartItemId,
      cartId: result.id,
    },
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
  });
  if (!cartItem) {
    throw new AppError(httpStatus.NOT_FOUND, 'No items in cart');
  }

  return cartItem;
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

const deleteCartItemFromDb = async (
  userId: string,
  courseId: string,
) => {
  const cart = await prisma.cart.findUnique({
    where: { userId:  userId },
  });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  const existing = await prisma.cartItem.findUnique({
    where: {
      cartId_courseId: { cartId: cart.id, courseId },
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Course not found in cart');
  }

  await prisma.cartItem.delete({
    where: { cartId_courseId: { cartId: cart.id, courseId } },
  });

  return { message: 'Course removed from cart' };
};

// Get the current cart
// const getCart = async (userId?: string, companyId?: string) => {
//   const cart = await getOrCreateCart(userId);
//   return cart;
// };

export const cartService = {
  createCartIntoDb,
  getCartListFromDb,
  getCartByIdFromDb,
  updateCartIntoDb,
  deleteCartItemFromDb,
  // getCart,
};
