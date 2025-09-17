import express from 'express';
import { UserRouters } from '../modules/user/user.routes';
import { AuthRouters } from '../modules/auth/auth.routes';
import { termAndConditionRoutes } from '../modules/termAndCondition/termAndCondition.routes';
import { privacyPolicyRoutes } from '../modules/privacyPolicy/privacyPolicy.routes';
import { supportRepliesRoutes } from '../modules/supportReplies/supportReplies.routes';
import { reviewRoutes } from '../modules/review/review.routes';
import { categoryRoutes } from '../modules/category/category.routes';
import { courseRoutes } from '../modules/course/course.routes';
import { testRoutes } from '../modules/test/test.routes';
import test from 'node:test';
import { testAttemptRoutes } from '../modules/testAttempt/testAttempt.routes';

const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRouters,
  },
  {
    path: '/users',
    route: UserRouters,
  },
  // {
  //   path: '/notifications',
  //   route: NotificationRoutes,
  // },
  {
    path: '/terms-&-conditions',
    route: termAndConditionRoutes,
  },
  {
    path: '/privacy-policy',
    route: privacyPolicyRoutes,
  },
  {
    path: '/support',
    route: supportRepliesRoutes,
  },
  {
    path: '/reviews',
    route: reviewRoutes,
  },
  {
    path: '/categories',
    route: categoryRoutes,
  },
  {
    path: '/courses',
    route: courseRoutes,
  },
  {
    path: '/tests',
    route: testRoutes,
  },
  {
    path: '/attempt-test',
    route: testAttemptRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
