import express from 'express';
import { UserRouters } from '../modules/user/user.routes';
import { AuthRouters } from '../modules/auth/auth.routes';
import { termAndConditionRoutes } from '../modules/termAndCondition/termAndCondition.routes';
import { privacyPolicyRoutes } from '../modules/privacyPolicy/privacyPolicy.routes';
import { reviewRoutes } from '../modules/review/review.routes';
import { categoryRoutes } from '../modules/category/category.routes';
import { courseRoutes } from '../modules/course/course.routes';
import { testRoutes } from '../modules/test/test.routes';
import test from 'node:test';
import { testAttemptRoutes } from '../modules/testAttempt/testAttempt.routes';
import { enrolledCourseRoutes } from '../modules/enrolledCourse/enrolledCourse.routes';
import { aboutUsRoutes } from '../modules/aboutUs/aboutUs.routes';
import { helpAndSupportRoutes } from '../modules/helpAndSupport/helpAndSupport.routes';
import { faqRoutes } from '../modules/faq/faq.routes';
import { studentProgressRoutes } from '../modules/studentProgress/studentProgress.routes';
import { certificateRoutes } from '../modules/certificate/certificate.routes';

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
    path: '/about-us',
    route: aboutUsRoutes,
  },
  {
    path: '/help-and-support',
    route: helpAndSupportRoutes,
  },
  {
    path: '/faqs',
    route: faqRoutes,
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
    path: '/enrolled-courses',
    route: enrolledCourseRoutes,
  },
  {
    path: '/attempt-test',
    route: testAttemptRoutes,
  },
  {
    path: '/student-progress',
    route: studentProgressRoutes,
  },
  {
    path: '/certificates',
    route: certificateRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
