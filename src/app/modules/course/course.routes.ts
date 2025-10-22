import { User, UserRoleEnum, CheckoutStatus } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { courseController } from './course.controller';
import { courseValidation } from './course.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.any(),
  parseBody,
  auth(),
  validateRequest(courseValidation.createCourseSchema),
  courseController.createCourse,
);

router.get(
  '/popular-courses',
  courseController.getPopularCourses,
);


router.get(
  '/details/:id',
  auth(UserRoleEnum.STUDENT),
  courseController.getACourseById,
);

router.get('/', courseController.getCourseList);

router.get('/:id', courseController.getCourseById);


router.patch(
  '/:id',
  multerUploadMultiple.any(),
  parseBody,
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(courseValidation.updateCourseSchema),
  courseController.updateCourse,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  courseController.deleteCourse,
);

export const courseRoutes = router;
