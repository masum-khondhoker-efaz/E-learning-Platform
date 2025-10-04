import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { aboutUsController } from './aboutUs.controller';
import { aboutUsValidation } from './aboutUs.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(aboutUsValidation.createSchema),
  aboutUsController.createAboutUs,
);

router.get('/', aboutUsController.getAboutUsList);

router.get('/:id', aboutUsController.getAboutUsById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(aboutUsValidation.updateSchema),
  aboutUsController.updateAboutUs,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  aboutUsController.deleteAboutUs,
);

export const aboutUsRoutes = router;
