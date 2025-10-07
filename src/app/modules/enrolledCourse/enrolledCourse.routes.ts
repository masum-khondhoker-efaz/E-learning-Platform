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
  '/employees',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  enrolledCourseController.getEmployeesCourseList,
);
router.get(
  '/employees/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  enrolledCourseController.getEmployeesCourseById,
);

router.get(
  '/students/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  enrolledCourseController.getEnrolledCourseByStudentId,
);

router.get(
  '/my-courses',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.EMPLOYEE),
  enrolledCourseController.getMyEnrolledCourses,
);

router.get(
  '/my-courses/:id',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.EMPLOYEE),
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
