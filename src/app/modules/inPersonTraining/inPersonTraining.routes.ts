import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { inPersonTrainingController } from './inPersonTraining.controller';
import { inPersonTrainingValidation } from './inPersonTraining.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.COMPANY),
  validateRequest(inPersonTrainingValidation.createSchema),
  inPersonTrainingController.createInPersonTraining,
);

router.get(
  '/my-requests',
  auth(UserRoleEnum.STUDENT,UserRoleEnum.COMPANY),
  inPersonTrainingController.getMyInPersonTrainingRequest,
);

router.get(
  '/my-requests/:id',
  auth(UserRoleEnum.STUDENT,UserRoleEnum.COMPANY),
  inPersonTrainingController.getMyInPersonTrainingRequestById,
);

router.get(
  '/my-trainings',
  auth(UserRoleEnum.STUDENT,UserRoleEnum.COMPANY),
  inPersonTrainingController.getMyInPersonTrainings,
);

router.get(
  '/my-trainings/:id',
  auth(UserRoleEnum.STUDENT,UserRoleEnum.COMPANY),
  inPersonTrainingController.getMyInPersonTrainingById,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN,UserRoleEnum.ADMIN),
  inPersonTrainingController.getInPersonTrainingList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  inPersonTrainingController.getInPersonTrainingById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(inPersonTrainingValidation.updateSchema),
  inPersonTrainingController.updateInPersonTraining,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  inPersonTrainingController.deleteInPersonTraining,
);

export const inPersonTrainingRoutes = router;
