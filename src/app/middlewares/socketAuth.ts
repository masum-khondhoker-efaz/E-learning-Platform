// src/app/middlewares/socketAuth.ts
import { Socket } from 'socket.io';
import { JwtPayload, Secret } from 'jsonwebtoken';
import config from '../../config';
import { verifyToken } from '../utils/verifyToken';
import prisma from '../utils/prisma';
import { UserStatus } from '@prisma/client';

// This middleware validates the socket handshake before allowing connection
export const socketAuth = async (
  socket: Socket,
  next: (err?: Error) => void,
) => {
  try {
   const token = socket.handshake.auth?.token as string || socket.handshake.query.token as string;

    // const token = socket.handshake.query.token as string;
    // console.log('Socket token:', token);

    if (!token) {
      return next(new Error('Authentication error: token missing'));
    }

    const decoded = verifyToken(
      token,
      config.jwt.access_secret as Secret,
    ) as JwtPayload & { role: string };

    if (!decoded?.id) {
      return next(new Error('Authentication error: invalid token payload'));
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: decoded.id, status: UserStatus.ACTIVE },
    });

    if (!existingUser) {
      return next(
        new Error('Authentication error: user not found or inactive'),
      );
    }

    // Attach user info to socket so you can use it later in events
    (socket as any).user = existingUser;
    return next();
  } catch (err) {
    console.error('Socket auth error:', err);
    return next(new Error('Authentication error: invalid or expired token'));
  }
};
