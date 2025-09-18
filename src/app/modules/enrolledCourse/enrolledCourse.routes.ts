import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { enrolledCourseController } from './enrolledCourse.controller';
import { enrolledCourseValidation } from './enrolledCourse.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.STUDENT),
  validateRequest(enrolledCourseValidation.createSchema),
  enrolledCourseController.createEnrolledCourse,
);

router.get(
  '/students',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  enrolledCourseController.getEnrolledCourseList,
);

router.get(
  '/students/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  enrolledCourseController.getEnrolledCourseByStudentId,
);

router.get(
  '/my-courses',
  auth(UserRoleEnum.STUDENT),
  enrolledCourseController.getMyEnrolledCourses,
);

router.get(
  '/my-courses/:id',
  auth(UserRoleEnum.STUDENT),
  enrolledCourseController.getMyEnrolledCourseById,
);

router.patch(
  '/:id',
  auth(),
  validateRequest(enrolledCourseValidation.updateSchema),
  enrolledCourseController.updateEnrolledCourse,
);

router.delete('/:id', auth(), enrolledCourseController.deleteEnrolledCourse);

export const enrolledCourseRoutes = router;
