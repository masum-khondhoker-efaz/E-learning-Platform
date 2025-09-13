import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { termAndConditionController } from './termAndCondition.controller';
import { termAndConditionValidation } from './termAndCondition.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(termAndConditionValidation.createTermAndConditionSchema),
  termAndConditionController.createTermAndCondition,
);

router.get('/', auth(), termAndConditionController.getTermAndConditionList);

router.get('/:id', auth(), termAndConditionController.getTermAndConditionById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(termAndConditionValidation.updateTermAndConditionSchema),
  termAndConditionController.updateTermAndCondition,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  termAndConditionController.deleteTermAndCondition,
);

export const termAndConditionRoutes = router;
