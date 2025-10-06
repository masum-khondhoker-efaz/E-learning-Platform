import { UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { cartController } from './cart.controller';
import { cartValidation } from './cart.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.COMPANY),
  validateRequest(cartValidation.createSchema),
  cartController.createCart,
);

router.get(
  '/',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.COMPANY),
  cartController.getCartList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.COMPANY),
  cartController.getCartById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.COMPANY),
  validateRequest(cartValidation.updateSchema),
  cartController.updateCart,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.COMPANY),
  cartController.deleteCart,
);

export const cartRoutes = router;
