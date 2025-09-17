import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { testController } from './test.controller';
import { testValidation } from './test.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(testValidation.createTestSchema),
  testController.createTest,
);

router.get('/', auth(), testController.getTestList);

router.get('/:id', auth(), testController.getTestById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(testValidation.updateTestSchema),
  testController.updateTest,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  testController.deleteTest,
);

export const testRoutes = router;
