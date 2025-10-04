import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { faqController } from './faq.controller';
import { faqValidation } from './faq.validation';
import { UserRoleEnum } from '@prisma/client';
import { UserAccessFunctionName } from '../../utils/access';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(faqValidation.createFaqSchema),
  faqController.createFaq,
);

router.get('/', faqController.getFaqList);

router.get('/:id', faqController.getFaqById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(faqValidation.updateFaqSchema),
  faqController.updateFaq,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  faqController.deleteFaq,
);

export const faqRoutes = router;
