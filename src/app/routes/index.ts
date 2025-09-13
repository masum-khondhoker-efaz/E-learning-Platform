import express from 'express';
import { UserRouters } from '../modules/user/user.routes';
import { AuthRouters } from '../modules/auth/auth.routes';
import { termAndConditionRoutes } from '../modules/termAndCondition/termAndCondition.routes';
import { privacyPolicyRoutes } from '../modules/privacyPolicy/privacyPolicy.routes';
import { supportRepliesRoutes } from '../modules/supportReplies/supportReplies.routes';
import { reviewRoutes } from '../modules/review/review.routes';

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
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
