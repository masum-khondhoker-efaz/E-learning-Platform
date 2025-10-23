import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { certificateController } from './certificate.controller';
import { certificateValidation } from './certificate.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post('/courses', auth(), certificateController.issueCertificate);

router.get(
  '/all-issued-certificates',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  certificateController.getCertificates,
);

router.get(
  '/a-issued-certificates/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  certificateController.getACertificate,
);

router.get(
  '/completion-check/:id',
  auth(UserRoleEnum.STUDENT, UserRoleEnum.EMPLOYEE),
  certificateController.checkCompletion,
);
router.get('/my-certificates', auth(), certificateController.getMyCertificates);
router.get('/my-certificates/:id', auth(), certificateController.getCertificateByCourseId);
router.get('/certificates/:id/verify', certificateController.verifyCertificate);

export const certificateRoutes = router;
