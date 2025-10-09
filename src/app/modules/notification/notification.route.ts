import express from 'express';
import  {notificationController}  from './notification.controller';
import auth from '../../middlewares/auth';

const router = express.Router();


router.post(
  '/send-notification',
  auth(),
  notificationController.sendNotifications
);

router.post(
  '/send-notification',
  auth(),
  notificationController.sendNotification
);

router.get('/', auth(), notificationController.getNotifications);

router.get(
  '/:notificationId',
  auth(),
  notificationController.getSingleNotificationById
);



export const notificationsRoute = router;
