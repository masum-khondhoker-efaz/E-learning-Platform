import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { studentProgressController } from './studentProgress.controller';
import { studentProgressValidation } from './studentProgress.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/lessons/:id/complete',
  auth(UserRoleEnum.STUDENT),
  studentProgressController.markLessonCompleted,
);
router.post(
  '/lessons/:id/incomplete',
  auth(UserRoleEnum.STUDENT),
  studentProgressController.markLessonIncomplete,
);
router.get(
  '/lessons/:id',
  auth(UserRoleEnum.STUDENT),
  studentProgressController.getLessonStatus,
);

router.get(
  '/courses/:id',
  auth(UserRoleEnum.STUDENT),
  studentProgressController.getCourseProgress,
);

router.get(
  '/courses/:id/completion',
  auth(),
  studentProgressController.getCourseCompletion,
);

export const studentProgressRoutes = router;
