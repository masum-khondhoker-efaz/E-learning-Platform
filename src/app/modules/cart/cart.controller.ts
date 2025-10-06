import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { cartService } from './cart.service';
import { UserRoleEnum } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';

const createCart = catchAsync(async (req, res) => {
  const user = req.user as any;
  const userRole = user.role;
  if (userRole === UserRoleEnum.EMPLOYEE) {
    const findUser = await prisma.user.findUnique({
      where: { id: user.id, isProfileComplete: true },
    });
    if (!findUser) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'You cannot add a course to the cart.',
      );
    }
  }
  const result = await cartService.createCartIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Cart created successfully',
    data: result,
  });
});

const getCartList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.getCartListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart list retrieved successfully',
    data: result,
  });
});

const getCartById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.getCartByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart details retrieved successfully',
    data: result,
  });
});

const updateCart = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.updateCartIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart updated successfully',
    data: result,
  });
});

const deleteCart = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.deleteCartItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart deleted successfully',
    data: result,
  });
});

export const cartController = {
  createCart,
  getCartList,
  getCartById,
  updateCart,
  deleteCart,
};