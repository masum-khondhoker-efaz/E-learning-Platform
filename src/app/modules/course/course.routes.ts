import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { courseController } from './course.controller';
import { courseValidation } from './course.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.any(),
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  courseController.createCourse,
);

router.get('/', auth(), courseController.getCourseList);

router.get('/:id', auth(), courseController.getCourseById);

router.put(
  '/:id',
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
