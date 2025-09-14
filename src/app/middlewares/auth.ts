import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../errors/AppError';
import prisma from '../utils/prisma';
import { verifyToken } from '../utils/verifyToken';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import { Admin, User } from '@prisma/client';

const auth = (...roles: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization;

      if (!token) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      }

      const verifyUserToken = verifyToken(
        token,
        config.jwt.access_secret as Secret,
      );

      // Check token purpose
      if (!verifyUserToken.purpose || verifyUserToken.purpose !== 'access') {
        throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token purpose!');
      }

      // Check user exists with admin relations
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: verifyUserToken.id },
      });

      if (!user) {
        throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized!');
      }
      if (user.status !== UserStatus.ACTIVE) {
        throw new AppError(
          httpStatus.UNAUTHORIZED,
          'User is not active. Please contact support.',
        );
      }
      // if (!user.isProfileComplete) {
      //   throw new AppError(
      //     httpStatus.FORBIDDEN,
      //     'Please complete your profile to proceed.',
      //   );
      // }

      // Role-based access check
      if (roles.length && !roles.includes(user.role)) {
        throw new AppError(httpStatus.FORBIDDEN, 'Forbidden!');
      }

      // Attach user to request object
      req.user = user;
      if (roles.length && !roles.includes(verifyUserToken.role)) {
        throw new AppError(httpStatus.FORBIDDEN, 'Forbidden!');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default auth;
