import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { studentProgressController } from './studentProgress.controller';
import { studentProgressValidation } from './studentProgress.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/lessons',
  auth(UserRoleEnum.STUDENT),
  studentProgressController.markLessonCompleted,
);

// router.post(
//   '/lessons/:id/incomplete',
//   auth(UserRoleEnum.STUDENT),
//   studentProgressController.markLessonIncomplete,
// );

router.get(
  '/course-details/:id',
  auth(UserRoleEnum.STUDENT),
  studentProgressController.getACourseDetails,
);

router.get(
  '/lessons/:id',
  auth(UserRoleEnum.STUDENT),
  studentProgressController.getLessonStatus,
);

router.get(
  '/my-courses-progress',
  auth(),
  studentProgressController.getMyCoursesProgress,
);

router.get(
  '/courses/:id',
  auth(UserRoleEnum.STUDENT),
  studentProgressController.getACourseProgress,
);

router.get(
  '/courses/:id/completion',
  auth(),
  studentProgressController.getCourseCompletion,
);

export const studentProgressRoutes = router;
