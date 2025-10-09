// Send notification to a single user

import httpStatus, { FORBIDDEN, NOT_FOUND } from 'http-status';
import AppError from '../../errors/AppError';
import prisma from '../../utils/prisma';
import admin from '../../utils/firebase';

const sendSingleNotification = async (userId: string, body: { title: string, body: string  }) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  // if (!user?.fcmToken) {
  //   throw new AppError(httpStatus.NOT_FOUND, 'User not found with FCM token');
  // }

  const message = {
    notification: {
      title: body.title,
      body: body.body,
    },
    // token: user.fcmToken,
  };

  // Attempt to send the notification first, then store in DB if successful
 
    // console.log(req.params.userId);
    // console.log(user.fcmToken);

    // const response = await admin.messaging().send(message);
    // console.log('object');
    // If the notification is sent successfully, save it to the database
    const notification = await prisma.notification.create({
      data: {
        userId: userId,
        title: body.title,
        body: body.body,

        isRead: false, // Default to unread
        isClicked: false, // Default to not clicked
      },
    });

    if(!notification){
        throw new AppError(httpStatus.NOT_FOUND, 'Notification not found');
        }

    return notification; // Return the response from FCM
 
};

// Send notifications to all users with valid FCM tokens
const sendNotifications1 = async (req: any) => {
  const users = await prisma.user.findMany({
    where: {
      fcmToken: {
        not: null, // Ensure the token is not null
      },
    },
    select: {
      id: true,
      fcmToken: true,
    },
  });

  if (!users || users.length === 0) {
    throw new AppError(404, 'No users found with FCM tokens');
  }

  const fcmTokens = users.map(user => user.fcmToken);

  const message = {
    notification: {
      title: req.body.title,
      body: req.body.body,
    },
    tokens: fcmTokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message as any);

  // Find indices of successful responses
  const successIndices = response.responses
    .map((res, idx) => (res.success ? idx : null))
    .filter(idx => idx !== null) as number[];

  // Filter users by success indices
  const successfulUsers = successIndices.map(idx => users[idx]);

  // Prepare notifications data for only successfully notified users
  const notificationData = successfulUsers.map(user => ({
    receiverId: user.id,
    title: req.body.title,
    body: req.body.body,
  }));
  /*

  // Save notifications for successfully notified users
  await prisma.notifications.createMany({
    data: notificationData,
  });
*/
  // Collect failed tokens
  const failedTokens = response.responses
    .map((res, idx) => (!res.success ? fcmTokens[idx] : null))
    .filter(token => token !== null);

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    failedTokens,
  };
};


const sendNotifications = async (req: any) => {
  const users = await prisma.user.findMany({
    where: {
      fcmToken: {
        not: null, // Ensure the token is not null
      },
    },
    select: {
      id: true,
      fcmToken: true,
    },
  });

  if (!users || users.length === 0) {
    throw new AppError(NOT_FOUND, 'No users found with FCM tokens');
  }

  const fcmTokens = users.map(user => user.fcmToken);
  const message = {
    notification: {
      title: req.body.title,
      body: req.body.body,
    },
    tokens: fcmTokens,
  };

  // Send the notification to each device using FCM
  const response = await admin.messaging().sendEachForMulticast(message as any);

  // Find indices of successful responses
  const successIndices = response.responses
    .map((res, idx) => (res.success ? idx : null))
    .filter(idx => idx !== null) as number[];

  // Filter users by success indices
  const successfulUsers = successIndices.map(idx => users[idx]);

  // Prepare notifications data for only successfully notified users
  const notificationData = successfulUsers.map(user => ({
    userId: user.id, // userId of the notified user
    title: req.body.title, // Notification title
    message: req.body.body, // Notification body content
    body: req.body.body, // Body of the notification
    isRead: false, // Default value for unread notifications
    isClicked: false, // Default value for un-clicked notifications
  }));

  // Save notifications for successfully notified users
  await prisma.notification.createMany({
    data: notificationData,
  });

  // Collect failed tokens
  const failedTokens = response.responses
    .map((res, idx) => (!res.success ? fcmTokens[idx] : null))
    .filter(token => token !== null);

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    failedTokens,
  };
};

//TODO  update getNotificationsFromDB to get notifications
const getNotificationsFromDB1 = async (req: any) => {
  const notifications = await prisma.notification.findMany({
    where: {
      userId: req.user.id,
    },

    orderBy: { createdAt: 'desc' },
  });

  if (notifications.length === 0) {
    throw new AppError(NOT_FOUND, 'No notifications found for the user');
  }

  return notifications;
};

const getNotificationsFromDB = async (req: any) => {
  const notifications = await prisma.notification.findMany({
    where: {
      userId: req.user.id,
    },

    orderBy: { createdAt: 'desc' },
  });

  if (notifications.length === 0) {
    return {message: 'No notifications found for the user'};
  }

  return notifications;
};

const getSingleNotificationFromDB = async (
  req: any,
  notificationId: string,
) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: req.user.id,
    },
  });

  if (!notification) {
    throw new AppError(NOT_FOUND, 'Notification not found for the user');
  }

  return notification;
};

export const notificationServices = {
  sendSingleNotification,
  sendNotifications,
  getNotificationsFromDB,
  getSingleNotificationFromDB,
};
