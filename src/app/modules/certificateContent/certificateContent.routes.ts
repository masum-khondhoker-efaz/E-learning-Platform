import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { certificateContentController } from './certificateContent.controller';
import { certificateContentValidation } from './certificateContent.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(certificateContentValidation.certificateContentSchema),
  certificateContentController.createCertificateContent,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  certificateContentController.getCertificateContentList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  certificateContentController.getCertificateContentById,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(certificateContentValidation.updateSchema),
  certificateContentController.updateCertificateContent,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  certificateContentController.deleteCertificateContent,
);

export const certificateContentRoutes = router;
