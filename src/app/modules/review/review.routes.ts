import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { reviewController } from './review.controller';
import { reviewValidation } from './review.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.STUDENT),
  validateRequest(reviewValidation.createReviewSchema),
  reviewController.createReview,
);

router.get('/saloon/:id', auth(), reviewController.getReviewListForSaloon);

router.get('/barber', auth(), reviewController.getReviewListForBarber);

router.patch(
  '/:id',
  auth(UserRoleEnum.STUDENT),
  validateRequest(reviewValidation.updateReviewSchema),
  reviewController.updateReview,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  reviewController.deleteReview,
);

export const reviewRoutes = router;
