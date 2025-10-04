import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { favoriteCourseController } from './favoriteCourse.controller';
import { favoriteCourseValidation } from './favoriteCourse.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.STUDENT),
  validateRequest(favoriteCourseValidation.createSchema),
  favoriteCourseController.createFavoriteCourse,
);

router.get(
  '/',
  auth(UserRoleEnum.STUDENT),
  favoriteCourseController.getFavoriteCourseList,
);

router.get('/:id', auth(), favoriteCourseController.getFavoriteCourseById);

router.put(
  '/:id',
  auth(),
  validateRequest(favoriteCourseValidation.updateSchema),
  favoriteCourseController.updateFavoriteCourse,
);

router.delete('/:id', auth(), favoriteCourseController.deleteFavoriteCourse);

export const favoriteCourseRoutes = router;
