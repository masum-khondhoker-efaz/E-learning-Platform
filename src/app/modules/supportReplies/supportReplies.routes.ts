import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { supportRepliesController } from './supportReplies.controller';
import { supportRepliesValidation } from './supportReplies.validation';
import { UserRoleEnum } from '@prisma/client';
import { UserAccessFunctionName } from '../../utils/access';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.STUDENT),
  validateRequest(supportRepliesValidation.createSchema),
  supportRepliesController.createSupportReplies,
);

router.get(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  supportRepliesController.getSupportRepliesList,
);

router.get(
  '/reports',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  supportRepliesController.getSupportRepliesReports,
);

router.get(
  '/reply-sent/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  supportRepliesController.getSpecificRepliesById,
);

router.get(
  '/support-sent/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  supportRepliesController.getSpecificSupportReplyById,
);

router.patch(
  '/replies/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(supportRepliesValidation.updateSchema),
  supportRepliesController.updateSupportReplies,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  supportRepliesController.updateSupportById,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  supportRepliesController.deleteSupportReplies,
);

export const supportRepliesRoutes = router;
