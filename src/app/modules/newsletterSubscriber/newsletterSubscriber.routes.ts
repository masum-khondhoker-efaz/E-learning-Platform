import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { newsletterSubscriberController } from './newsletterSubscriber.controller';
import { newsletterSubscriberValidation } from './newsletterSubscriber.validation';

const router = express.Router();

router.post(
  '/',
  validateRequest(newsletterSubscriberValidation.createSchema),
  newsletterSubscriberController.createNewsletterSubscriber,
);

router.get(
  '/',
  auth(),
  newsletterSubscriberController.getNewsletterSubscriberList,
);

router.get(
  '/:id',
  auth(),
  newsletterSubscriberController.getNewsletterSubscriberById,
);

router.put(
  '/:id',
  auth(),
  validateRequest(newsletterSubscriberValidation.updateSchema),
  newsletterSubscriberController.updateNewsletterSubscriber,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  newsletterSubscriberController.deleteNewsletterSubscriber,
);

export const newsletterSubscriberRoutes = router;
