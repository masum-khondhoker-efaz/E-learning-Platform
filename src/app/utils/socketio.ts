// src/app/utils/socketio.ts
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from './prisma';
import { socketAuth } from '../middlewares/socketAuth';
import { SubscriptionPlanStatus, UserRoleEnum } from '@prisma/client';

const onlineUsers = new Set<string>();
const userSockets = new Map<string, Socket>();

export function setupSocketIO(server: HTTPServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
    },
  });

  const messagesNameSpace = io.of('/messages');

  // Apply auth middleware to namespace
  messagesNameSpace.use(socketAuth);

  messagesNameSpace.on('connection', async (socket: Socket) => {
    console.log('✅ User connected to messages namespace');
    const user = (socket as any).user; // comes from socketAuth
    const { id } = user;

    // Add user to online users set
    onlineUsers.add(id);
    userSockets.set(id, socket);

    // Notify all users about the new user's online status
    messagesNameSpace.emit('userStatus', { userId: id, isOnline: true });
    messagesNameSpace.emit('onlineUsers', Array.from(onlineUsers));

    socket.on('disconnect', () => {
      console.log('❌ User disconnected from messages namespace');
      onlineUsers.delete(id);
      userSockets.delete(id);
      messagesNameSpace.emit('userStatus', { userId: id, isOnline: false });
      messagesNameSpace.emit('onlineUsers', Array.from(onlineUsers));
    });

    // userSockets.set(id, socket);

    socket.on('message', async payload => {
      try {
        if (!payload.receiverId || !payload.message) {
          console.log('Receiver ID or message is undefined');
          return;
        }

        // Check subscription plan from user token (assumed to be set by socketAuth)
        const subscriptionPlan = user.subscriptionPlan; // e.g., 'free', 'premium', etc.
        const senderRole = user.role; // e.g., 'saloonOwner', 'barber', etc.

        // Fetch receiver's role
        const receiver = await prisma.user.findUnique({
          where: { id: payload.receiverId },
          select: { role: true },
        });
        if (!receiver) {
          console.log('Receiver not found');
          return;
        }
        const receiverRole = receiver.role;

        // If subscription is free, prevent chat between saloon owner and barber or the customer
        if (
          subscriptionPlan === SubscriptionPlanStatus.FREE &&
          ((senderRole === UserRoleEnum.SALOON_OWNER &&
            receiverRole === UserRoleEnum.BARBER) ||
            (senderRole === UserRoleEnum.SALOON_OWNER &&
              receiverRole === UserRoleEnum.CUSTOMER))
        ) {
          socket.emit('error', {
            message:
              'Chat between saloon owner and barber or customer is not allowed on free plan.',
          });
          return;
        }

        // BASIC_PREMIUM: can only chat with barbers, not customers
        if (
          subscriptionPlan === SubscriptionPlanStatus.BASIC_PREMIUM &&
          receiverRole !== UserRoleEnum.BARBER
        ) {
          socket.emit('error', {
            message: `With BASIC_PREMIUM, you can only chat with barbers.`,
          });
          return;
        }

        // ADVANCED_PREMIUM: can only chat with customers, not barbers
        if (
          subscriptionPlan === SubscriptionPlanStatus.ADVANCED_PREMIUM &&
          receiverRole !== UserRoleEnum.CUSTOMER
        ) {
          socket.emit('error', {
            message: `With ADVANCED_PREMIUM, you can only chat with customers.`,
          });
          return;
        }

        // senderId and receiverId cannot be the same
        if (payload.receiverId === id) {
          console.log('Sender and receiver cannot be the same');
          socket.emit('error', {
            message: 'Sender and receiver cannot be the same',
          });
          return;
        }

        const room = await prisma.room.findFirst({
          where: {
            OR: [
              { senderId: id, receiverId: payload.receiverId },
              { senderId: payload.receiverId, receiverId: id },
            ],
          },
        });
        let roomId;
        if (!room) {
          const newRoom = await prisma.room.create({
            data: {
              senderId: id,
              receiverId: payload.receiverId,
            },
          });
          if (!newRoom) {
            console.log('Error saving room');
            return;
          }
          roomId = newRoom.id;
        } else {
          roomId = room.id;
        }
        const chat = await prisma.chat.create({
          data: {
            senderId: id,
            receiverId: payload.receiverId,
            roomId: roomId,
            message: payload.message,
          },
        });
        if (!chat) {
          console.log('Error saving chat');
          return;
        }
        const roomName = [id, payload.receiverId].sort().join('-');
        // Sender joins the room
        socket.join(roomName);
        // Receiver joins the room if online
        const receiverSocket = userSockets.get(payload.receiverId);
        if (receiverSocket) {
          receiverSocket.join(roomName);
        }
        // Emit the message to the room
        messagesNameSpace.to(roomName).emit('message', chat);

        // Emit updated messageList to both sender and receiver
        const emitMessageList = async (userId: string) => {
          // Only fetch rooms where the user is sender or receiver
          const rooms = await prisma.room.findMany({
            where: {
              OR: [{ senderId: userId }, { receiverId: userId }],
            },
            include: {
              chat: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 1,
              },
            },
          });

          // Collect all unique user IDs involved in these rooms
          const userIds = Array.from(
            new Set(
              rooms
                .map(room => [room.senderId, room.receiverId])
                .flat()
                .filter((uid): uid is string => !!uid),
            ),
          );

          // Fetch user info for all involved users
          const userInfos = await prisma.user.findMany({
            where: {
              id: {
                in: userIds,
              },
            },
            select: {
              id: true,
              fullName: true,
              image: true,
            },
          });

          const roomsWithUnreadMessages = await Promise.all(
            rooms.map(async room => {
              const unReadMessagesCount = await prisma.chat.count({
                where: {
                  roomId: room.id,
                  isRead: false,
                  receiverId: userId,
                },
              });
              return {
                chat: room.chat[0], // Include only the latest chat
                unReadMessagesCount,
                senderName:
                  userInfos.find(userInfo => userInfo.id === room.receiverId)
                    ?.fullName || null,
                senderImage:
                  userInfos.find(userInfo => userInfo.id === room.receiverId)
                    ?.image || null,
                receiverName:
                  userInfos.find(userInfo => userInfo.id === room.senderId)
                    ?.fullName || null,
                receiverImage:
                  userInfos.find(userInfo => userInfo.id === room.senderId)
                    ?.image || null,
                lastMessageAt: room.chat[0]?.createdAt || null,
                roomId: room.id,
              };
            }),
          );

          // Sort so the updated room (the one with the latest message) is on top
          const sortedRooms = roomsWithUnreadMessages.sort((a, b) => {
            // Put the room with the latest message on top
            if (!a.lastMessageAt && !b.lastMessageAt) return 0;
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;
            return (
              new Date(b.lastMessageAt).getTime() -
              new Date(a.lastMessageAt).getTime()
            );
          });

          const targetSocket = userSockets.get(userId);
          if (targetSocket) {
            targetSocket.emit(
              'messageList',
              sortedRooms.length ? sortedRooms : [],
            );
          }
        };

        // Update messageList for both sender and receiver
        await emitMessageList(id);
        if (payload.receiverId !== id) {
          const receiverSocket = userSockets.get(payload.receiverId);
          if (receiverSocket && receiverSocket.connected) {
            await emitMessageList(payload.receiverId);
          } else {
            // Optionally, handle offline receiver (e.g., queue notification)
            console.log('Receiver is not online, cannot emit messageList');
          }
        }
      } catch (error) {
        console.error('Error handling message event:', error);
      }
    });

    socket.on('fetchChats', async payload => {
      try {
        if (!payload || !payload.receiverId) {
          console.log('Receiver ID is undefined');
          return;
        }

        // Check subscription plan from user token (assumed to be set by socketAuth)
        const subscriptionPlan = user.subscriptionPlan; // e.g., 'free', 'premium', etc.
        const senderRole = user.role; // e.g., 'saloonOwner', 'barber', etc.

        // Fetch receiver's role and info
        const receiver = await prisma.user.findUnique({
          where: { id: payload.receiverId },
          select: { fullName: true, image: true, role: true },
        });

        if (!receiver) {
          console.log('Receiver not found');
          return;
        }
        const receiverRole = receiver.role;

        // If subscription is free, prevent chat between saloon owner and barber or customer
        if (
          subscriptionPlan === SubscriptionPlanStatus.FREE &&
          (senderRole === UserRoleEnum.SALOON_OWNER ||
            receiverRole === UserRoleEnum.SALOON_OWNER)
        ) {
          socket.emit('error', {
            message: `Cannot fetch chats between saloon owner and the barber or the customer if saloon owner's subscription is free.`,
          });
          return;
        }

        // BASIC_PREMIUM: can only fetch chats with barbers, not customers
        if (
          subscriptionPlan === SubscriptionPlanStatus.BASIC_PREMIUM &&
          receiverRole !== UserRoleEnum.BARBER
        ) {
          socket.emit('error', {
            message: `With BASIC_PREMIUM, you can only fetch chats with barbers.`,
          });
          return;
        }

        // ADVANCED_PREMIUM: can only fetch chats with customers, not barbers
        if (
          subscriptionPlan === SubscriptionPlanStatus.ADVANCED_PREMIUM &&
          receiverRole !== UserRoleEnum.CUSTOMER
        ) {
          socket.emit('error', {
            message: `With ADVANCED_PREMIUM, you can only fetch chats with customers.`,
          });
          return;
        }

        if (subscriptionPlan === SubscriptionPlanStatus.PRO_PREMIUM) {
          // No restriction for PRO_PREMIUM, allow fetching chats (do nothing, just proceed)
        }

        const room = await prisma.room.findFirst({
          where: {
            OR: [
              { senderId: id, receiverId: payload.receiverId },
              { senderId: payload.receiverId, receiverId: id },
            ],
          },
        });
        if (!room) {
          console.log('Room not found');
          socket.emit('noRoomFound', 'No room found');
          return;
        }
        // Mark all messages as read before fetching chats
        await prisma.chat.updateMany({
          where: {
            roomId: room.id,
            receiverId: id,
            isRead: false,
          },
          data: {
            isRead: true,
          },
        });

        const chats = await prisma.chat.findMany({
          where: {
            roomId: room.id,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        socket.emit('chats', {
          chats,
          receiver: {
            name: receiver?.fullName || null,
            image: receiver?.image || null,
          },
        });

        // Ensure both users join the room
        const roomName = [id, payload.receiverId].sort().join('-');
        socket.join(roomName);
        const receiverSocket = userSockets.get(payload.receiverId);
        if (receiverSocket) {
          receiverSocket.join(roomName);
        }

        // Emit updated messageList to the user
        const emitMessageList = async (userId: string) => {
          const rooms = await prisma.room.findMany({
            where: {
              OR: [{ senderId: userId }, { receiverId: userId }],
            },
            include: {
              chat: {
                orderBy: {
                  createdAt: 'desc',
                },
                take: 1,
              },
            },
          });

          const userIds = Array.from(
            new Set(
              rooms
                .map(room => [room.senderId, room.receiverId])
                .flat()
                .filter((uid): uid is string => !!uid),
            ),
          );

          const userInfos = await prisma.user.findMany({
            where: {
              id: {
                in: userIds,
              },
            },
            select: {
              id: true,
              fullName: true,
              image: true,
            },
          });

          const roomsWithUnreadMessages = await Promise.all(
            rooms.map(async room => {
              const unReadMessagesCount = await prisma.chat.count({
                where: {
                  roomId: room.id,
                  isRead: false,
                  receiverId: userId,
                },
              });
              return {
                chat: room.chat[0],
                unReadMessagesCount,
                senderName:
                  userInfos.find(userInfo => userInfo.id === room.receiverId)
                    ?.fullName || null,
                senderImage:
                  userInfos.find(userInfo => userInfo.id === room.receiverId)
                    ?.image || null,
                receiverName:
                  userInfos.find(userInfo => userInfo.id === room.senderId)
                    ?.fullName || null,
                receiverImage:
                  userInfos.find(userInfo => userInfo.id === room.senderId)
                    ?.image || null,
                lastMessageAt: room.chat[0]?.createdAt || null,
                roomId: room.id,
              };
            }),
          );

          const sortedRooms = roomsWithUnreadMessages.sort((a, b) => {
            if (!a.lastMessageAt && !b.lastMessageAt) return 0;
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;
            return (
              new Date(b.lastMessageAt).getTime() -
              new Date(a.lastMessageAt).getTime()
            );
          });

          const targetSocket = userSockets.get(userId);
          if (targetSocket) {
            targetSocket.emit(
              'messageList',
              sortedRooms.length ? sortedRooms : [],
            );
          }
        };

        await emitMessageList(id);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    });

    socket.on('unReadMessages', async payload => {
      try {
        if (!payload || !payload.receiverId) {
          console.log('Receiver ID is undefined');
          return;
        }
        const room = await prisma.room.findFirst({
          where: {
            OR: [
              { senderId: id, receiverId: payload.receiverId },
              { senderId: payload.receiverId, receiverId: id },
            ],
          },
        });
        if (!room) {
          console.log('Room not found');
          return;
        }
        const chats = await prisma.chat.findMany({
          where: {
            roomId: room.id,
            isRead: false,
            receiverId: id,
          },
        });
        const unReadMessagesCount = await prisma.chat.count({
          where: {
            roomId: room.id,
            isRead: false,
            receiverId: id,
          },
        });
        if (unReadMessagesCount === 0) {
          socket.emit('noUnreadMessages', 'No unread messages left');
          return;
        }
        socket.emit('unReadMessages', chats, unReadMessagesCount);
      } catch (error) {
        console.error('Error fetching unReadMessages:', error);
      }
    });

    socket.on('messageList', async () => {
      try {
        // Only fetch rooms where the user is sender or receiver
        const rooms = await prisma.room.findMany({
          where: {
            OR: [{ senderId: id }, { receiverId: id }],
          },
          include: {
            chat: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        });

        // Collect all unique user IDs involved in these rooms
        const userIds = Array.from(
          new Set(
            rooms
              .map(room => [room.senderId, room.receiverId])
              .flat()
              .filter((uid): uid is string => !!uid),
          ),
        );

        // Fetch user info for all involved users
        const userInfos = await prisma.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
          select: {
            id: true,
            fullName: true,
            image: true,
            subscriptionPlan: true,
            role: true,
          },
        });

        let filteredRooms = rooms;

        // Apply filtering based on saloon owner's subscription plan
        if (user.role === UserRoleEnum.SALOON_OWNER) {
          if (user.subscriptionPlan === SubscriptionPlanStatus.BASIC_PREMIUM) {
            // Only show rooms with barbers
            filteredRooms = rooms.filter(room => {
              const otherUserId =
                room.senderId === id ? room.receiverId : room.senderId;
              const otherUser = userInfos.find(u => u.id === otherUserId);
              return otherUser?.role === UserRoleEnum.BARBER;
            });
          } else if (
            user.subscriptionPlan === SubscriptionPlanStatus.ADVANCED_PREMIUM
          ) {
            // Only show rooms with customers
            filteredRooms = rooms.filter(room => {
              const otherUserId =
                room.senderId === id ? room.receiverId : room.senderId;
              const otherUser = userInfos.find(u => u.id === otherUserId);
              return otherUser?.role === UserRoleEnum.CUSTOMER;
            });
          }
          // PRO_PREMIUM: no restriction
        }

        const roomsWithUnreadMessages = await Promise.all(
          filteredRooms.map(async room => {
            const unReadMessagesCount = await prisma.chat.count({
              where: {
                roomId: room.id,
                isRead: false,
                receiverId: id,
              },
            });

            const otherUserId =
              room.senderId === id ? room.receiverId : room.senderId;
            const otherUser = userInfos.find(u => u.id === otherUserId);

            return {
              chat: room.chat[0], // Always include latest chat
              unReadMessagesCount,
              senderName:
                userInfos.find(userInfo => userInfo.id === room.receiverId)
                  ?.fullName || null,
              senderImage:
                userInfos.find(userInfo => userInfo.id === room.receiverId)
                  ?.image || null,
              receiverName:
                userInfos.find(userInfo => userInfo.id === room.senderId)
                  ?.fullName || null,
              receiverImage:
                userInfos.find(userInfo => userInfo.id === room.senderId)
                  ?.image || null,
              saloonOwnerSubscriptionPlan:
                user.role === UserRoleEnum.SALOON_OWNER
                  ? user.subscriptionPlan
                  : null,
              // Always include the other user's subscription plan name
              // otherUserSubscriptionPlan: otherUser?.subscriptionPlan || null,
              // lastMessageAt: room.chat[0]?.createdAt || null,
              // roomId: room.id,
            };
          }),
        );

        // Emit all rooms, even if unread count is zero
        socket.emit('messageList', roomsWithUnreadMessages);
      } catch (error) {
        console.error('Error fetching messageList:', error);
      }
    });
  });

  return io;
}
