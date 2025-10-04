import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { contactUsInfoController } from './contactUsInfo.controller';
import { contactUsInfoValidation } from './contactUsInfo.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(contactUsInfoValidation.createSchema),
  contactUsInfoController.createContactUsInfo,
);

router.get('/', contactUsInfoController.getContactUsInfoList);

router.get('/:id', contactUsInfoController.getContactUsInfoById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(contactUsInfoValidation.updateSchema),
  contactUsInfoController.updateContactUsInfo,
);

router.delete('/:id', auth(), contactUsInfoController.deleteContactUsInfo);

export const contactUsInfoRoutes = router;
