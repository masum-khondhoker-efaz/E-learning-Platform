import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adminController } from './admin.controller';
import { adminValidation } from './admin.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.get(
  '/dashboard-stats',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getDashboardStats,
);

router.get(
  '/users',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllUsers,
);

router.get(
  '/users/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getUserById,
);

router.patch(
  '/users/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.updateUserStatus,
);

router.get(
  '/users-with-company',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllUsersWithCompany,
);

router.get(
  '/users-with-company/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAUsersWithCompany,
);

router.post(
  '/users-with-course-access',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(adminValidation.addUserWithCompanySchema),
  adminController.addUserWithCourseAccess,
);


router.get(
  '/enrolled-students',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllEnrolledStudents,
);

router.get(
  '/companies-with-courses',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllCompaniesWithCourses,
);

router.get(
  '/newsletter-subscribers',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllNewsletterSubscribers,
);

export const adminRoutes = router;
