import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { testAttemptController } from './testAttempt.controller';
import { testAttemptValidation } from './testAttempt.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.STUDENT),
  validateRequest(testAttemptValidation.testAttemptSchema),
  testAttemptController.createTestAttempt,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  testAttemptController.getTestAttemptList,
);

router.get(
  '/my-grades',
  auth(UserRoleEnum.STUDENT),
  testAttemptController.getMyTestAttempts,
);
router.get(
  '/my-grades/:id',
  auth(UserRoleEnum.STUDENT),
  testAttemptController.getMyTestAttemptById,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  testAttemptController.getTestAttemptById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(testAttemptValidation.gradingSchema),
  testAttemptController.updateTestAttempt,
);

router.delete('/:id', auth(), testAttemptController.deleteTestAttempt);

export const testAttemptRoutes = router;
