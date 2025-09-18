import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { certificateController } from './certificate.controller';
import { certificateValidation } from './certificate.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/courses/:id',
  auth(),
  certificateController.issueCertificate,
);

router.get(
  '/all-certificates',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  certificateController.getCertificates,
);

router.get(
  '/completion-check/:id',
  auth(),
  certificateController.checkCompletion,
);
router.get('/my-certificates', auth(), certificateController.getMyCertificates);
router.get(
  '/:id',
  auth(),
  certificateController.getCertificate,
);
router.get(
  '/certificates/:id/verify',
  certificateController.verifyCertificate,
);

export const certificateRoutes = router;
