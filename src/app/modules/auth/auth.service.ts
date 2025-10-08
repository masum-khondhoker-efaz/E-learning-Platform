import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import { generateToken, refreshToken } from '../../utils/generateToken';
import prisma from '../../utils/prisma';
import { verifyToken } from '../../utils/verifyToken';
import { UserRoleEnum, UserStatus } from '@prisma/client';

const loginUserFromDB = async (payload: { email: string; password: string }) => {
  // 1. Try to find a user directly
  let user = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  // 2. If no user, try to log in with EmployeeCredential
  if (!user) {
    const employeeCred = await prisma.employeeCredential.findUnique({
      where: { loginEmail: payload.email },
    });

    if (!employeeCred) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Validate password
    const validPassword = await bcrypt.compare(payload.password, employeeCred.password);
    if (!validPassword) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');
    }

    // Check if user already created
    const existingUser = await prisma.user.findUnique({
      where: { email: employeeCred.loginEmail },
    });
    if (existingUser) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'User already exists, please login with your credentials',
      );
    }

    // Create new EMPLOYEE user
    const hashedPassword = await bcrypt.hash(payload.password, 12);
    user = await prisma.user.create({
      data: {
        email: employeeCred.loginEmail,
        password: hashedPassword,
        role: UserRoleEnum.EMPLOYEE,
        isVerified: true,
        isProfileComplete: false,
        status: UserStatus.ACTIVE,
      },
    });

    if (!user) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'User creation failed');
    }

    await prisma.employeeCredential.update({
      where: { loginEmail: employeeCred.loginEmail },
      data: { userId: user.id },
    });

    const accessToken = await generateToken(
      { id: user.id, email: user.email, role: user.role, purpose: 'access' },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as string,
    );

    return {
      id: user.id,
      role: user.role,
      message: 'Please complete your profile before proceeding.',
      accessToken,
    };
  }

  // 3. Validate password for normal users
  if (!user.password) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password is not set');
  }

  const validPassword = await bcrypt.compare(payload.password, user.password);
  if (!validPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');
  }

  // 4. Special checks for EMPLOYEE with incomplete profile
  if (
    user.role === UserRoleEnum.EMPLOYEE &&
    (user.isProfileComplete === false || user.isProfileComplete === null)
  ) {
    const accessToken = await generateToken(
      { id: user.id, email: user.email, role: user.role, purpose: 'access' },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as string,
    );

    return {
      id: user.id,
      role: user.role,
      message: 'Please complete your profile before proceeding.',
      accessToken,
    };
  }

  // 5. Account status checks
  if (user.status === UserStatus.PENDING || user.isVerified === false) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Please verify your email before logging in');
  }
  if (user.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, 'Your account is blocked. Please contact support.');
  }

  // 6. Mark user as logged in
  if (user.isLoggedIn === false) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isLoggedIn: true },
    });
  }

  // 7. Issue tokens
  const accessToken = await generateToken(
    { id: user.id, email: user.email, role: user.role, purpose: 'access' },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshTokenValue = await refreshToken(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    image: user.image,
    accessToken,
    refreshToken: refreshTokenValue,
  };
};


const refreshTokenFromDB = async (refreshedToken: string) => {
  if (!refreshedToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token is required');
  }

  const decoded = await verifyToken(
    refreshedToken,
    config.jwt.refresh_secret as Secret,
  );
  if (!decoded) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
  }

  const userData = await prisma.user.findUnique({
    where: {
      id: (decoded as any).id,
      status: UserStatus.ACTIVE,
    },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const newAccessToken = await generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      purpose: 'access',
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const newRefreshToken = await refreshToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const logoutUserFromDB = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { isLoggedIn: false },
  });
};
export const AuthServices = {
  loginUserFromDB,
  logoutUserFromDB,
  refreshTokenFromDB,
};
