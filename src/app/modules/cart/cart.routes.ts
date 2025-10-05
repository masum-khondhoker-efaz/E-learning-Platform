import { UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { cartController } from './cart.controller';
import { cartValidation } from './cart.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.STUDENT),
  validateRequest(cartValidation.createSchema),
  cartController.createCart,
);

router.get('/', auth(UserRoleEnum.STUDENT), cartController.getCartList);

router.get('/:id', auth(UserRoleEnum.STUDENT), cartController.getCartById);

router.put(
  '/:id',
  auth(UserRoleEnum.STUDENT),
  validateRequest(cartValidation.updateSchema),
  cartController.updateCart,
);

router.delete('/:id', auth(UserRoleEnum.STUDENT), cartController.deleteCart);

export const cartRoutes = router;
