import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { privacyPolicyController } from './privacyPolicy.controller';
import { privacyPolicyValidation } from './privacyPolicy.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
 
  validateRequest(privacyPolicyValidation.createPrivacyPolicySchema),
  privacyPolicyController.createPrivacyPolicy,
);

router.get('/', privacyPolicyController.getPrivacyPolicyList);

router.get('/:id', privacyPolicyController.getPrivacyPolicyById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
 
  validateRequest(privacyPolicyValidation.updatePrivacyPolicySchema),
  privacyPolicyController.updatePrivacyPolicy,
);

router.delete(
  '/:id',
  auth(),
 
  privacyPolicyController.deletePrivacyPolicy,
);

export const privacyPolicyRoutes = router;
