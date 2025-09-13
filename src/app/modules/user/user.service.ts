import { User, UserStatus, UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import emailSender from '../../utils/emailSender';
import { generateToken, refreshToken } from '../../utils/generateToken';
import prisma from '../../utils/prisma';
import Stripe from 'stripe';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

interface UserWithOptionalPassword extends Omit<User, 'password'> {
  password?: string;
}

const registerUserIntoDB = async (payload: any) => {
  if (payload.email) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email: payload.email,
      },
    });
    if (existingUser) {
      throw new AppError(httpStatus.CONFLICT, 'User already exists!');
    }
  }

  const hashedPassword: string = await bcrypt.hash(payload.password, 12);

  const userData = {
    ...payload,
    password: hashedPassword,
  
  };

  const result = await prisma.$transaction(async (transactionClient: any) => {
    const user = await transactionClient.user.create({
      data: userData,
    });
    if (!user) {
      throw new AppError(httpStatus.BAD_REQUEST, 'User not created!');
    }
  });

  // return login;
  const otp = Math.floor(100000 + Math.random() * 900000);
  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
  const otpExpiresAtString = otpExpiresAt.toISOString();

  await prisma.user.update({
    where: { email: payload.email },
    data: {
      otp: otp,
      otpExpiry: otpExpiresAtString,
    },
  });

  await emailSender(
    'Verify Your Email',
    userData.email!,

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
      </td>
    </tr>
    <tr>

      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `,
  );
  return { message: 'OTP sent via your email successfully' };
};

//resend verification email
const resendUserVerificationEmail = async (email: string) => {
  const userData = await prisma.user.findUnique({
    where: { email: email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  const otp = Math.floor(100000 + Math.random() * 900000);
  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
  const otpExpiresAtString = otpExpiresAt.toISOString();

  await prisma.user.update({
    where: { email: email },
    data: {
      otp: otp,
      otpExpiry: otpExpiresAtString,
    },
  });
  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  await emailSender(
    'Verify Your Email',
    userData.email,

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #000000; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #f5f5f5; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Verify Your Email</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Time Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `,
  );

  return { message: 'OTP sent via your email successfully' };
};







const getMyProfileFromDB = async (id: string) => {
  const Profile = await prisma.user.findUniqueOrThrow({
    where: {
      id: id,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      dateOfBirth: true,
      phoneNumber: true,
      address: true,
      followerCount: true,
      followingCount: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Profile;
};

const updateMyProfileIntoDB = async (id: string, payload: any) => {
  const userData = payload;

  // update user data
  await prisma.$transaction(async (transactionClient: any) => {
    // Update user data
    const updatedUser = await transactionClient.user.update({
      where: { id },
      data: userData,
    });

    return { updatedUser };
  });

  // Fetch and return the updated user
  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      dateOfBirth: true,
      phoneNumber: true,
      gender: true,
    },
  });

  // const userWithOptionalPassword = updatedUser as UserWithOptionalPassword;
  // delete userWithOptionalPassword.password;

  return updatedUser;
};

const updateUserRoleStatusIntoDB = async (id: string, payload: any) => {
  const result = await prisma.user.update({
    where: {
      id: id,
    },
    data: payload,
  });
  return result;
};

const changePassword = async (
  user: any,
  userId: string,
  payload: {
    oldPassword: string;
    newPassword: string;
  },
) => {
  const userData = await prisma.user.findUniqueOrThrow({
    where: {
      id: userId,
      email: user.email,
      status: UserStatus.ACTIVE,
    },
  });

  if (userData.password === null) {
    throw new AppError(httpStatus.CONFLICT, 'Password not set for this user');
  }

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new Error('Password incorrect!');
  }

  const newPasswordSameAsOld: boolean = await bcrypt.compare(
    payload.newPassword,
    userData.password,
  );

  if (newPasswordSameAsOld) {
    throw new AppError(
      httpStatus.CONFLICT,
      'New password must be different from the old password',
    );
  }

  const hashedPassword: string = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: {
      id: userData.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return {
    message: 'Password changed successfully!',
  };
};

const forgotPassword = async (payload: { email: string }) => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (!userData) {
    throw new AppError(httpStatus.CONFLICT, 'User not found!');
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
  const otpExpiresAtString = otpExpiresAt.toISOString();

  await prisma.user.update({
    where: { email: payload.email },
    data: {
      otp: otp,
      otpExpiry: otpExpiresAtString,
    },
  });
  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  await emailSender(
    'Verify Your Email',
    userData.email,

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Reset password OTP</h2>
      </td>
    </tr>
    <tr>

      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `,
  );

  return { message: 'OTP sent via your email successfully' };
};

//resend otp
const resendOtpIntoDB = async (payload: any) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  const otp = Math.floor(100000 + Math.random() * 900000);
  const otpExpiresAt = new Date();
  otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 5);
  const otpExpiresAtString = otpExpiresAt.toISOString();

  await prisma.user.update({
    where: { email: payload.email },
    data: {
      otp: otp,
      otpExpiry: otpExpiresAtString,
    },
  });
  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  await emailSender(
    'Verify Your Email',
    userData.email,

    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #000000; border-radius: 10px;">
    <table width="100%" style="border-collapse: collapse;">
    <tr>
      <td style="background-color: #E98F5A; padding: 20px; text-align: center; color: #f5f5f5; border-radius: 10px 10px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">Reset Password OTP</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px;">
        <p style="font-size: 16px; margin: 0;">Hello <strong>${
          userData.fullName
        }</strong>,</p>
        <p style="font-size: 16px;">Please verify your email.</p>
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 18px;" >Verify email using this OTP: <span style="font-weight:bold"> ${otp} </span><br/> This OTP will be Expired in 5 minutes,</p>
        </div>
        <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
        <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>Barbers Time</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} Barbers Time Team. All rights reserved.</p>
      </td>
    </tr>
    </table>
  </div>

      `,
  );

  return { message: 'OTP sent via your email successfully' };
};
// verify otp
const verifyOtpInDB = async (bodyData: {
  email: string;
  password: string;
  otp: number;
}) => {
  const userData = await prisma.user.findUnique({
    where: { email: bodyData.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.CONFLICT, 'User not found!');
  }

  const currentTime = new Date();

  if (userData.otp !== bodyData.otp) {
    throw new AppError(httpStatus.CONFLICT, 'Your OTP is incorrect!');
  }

  if (!userData.otpExpiry || userData.otpExpiry <= currentTime) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Your OTP has expired. Please request a new one.',
    );
  }

  // Prepare common fields
  const updateData: any = {
    otp: null,
    otpExpiry: null,
  };

  // If user is not active, determine what else to update
  if (userData.status !== UserStatus.ACTIVE) {
    // updateData.status = UserStatus.ACTIVE;

  
  }

  await prisma.user.update({
    where: { email: bodyData.email },
    data: updateData,
  });

  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    name: userData.fullName,
    email: userData.email,
    address: {
      city: userData.address ?? 'City', // You can modify this as needed
      country: 'America', // You can modify this as needed
    },
    metadata: {
      userId: userData.id,
      role: userData.role,
    },
  });
  if (!customer || !customer.id) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Stripe customer not created!');
  }

  return { message: 'OTP verified successfully!' };
};

// verify otp
const verifyOtpForgotPasswordInDB = async (bodyData: {
  email: string;
  password: string;
  otp: number;
}) => {
  const userData = await prisma.user.findUnique({
    where: { email: bodyData.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.CONFLICT, 'User not found!');
  }
  const currentTime = new Date(Date.now());

  if (userData?.otp !== bodyData.otp) {
    throw new AppError(httpStatus.CONFLICT, 'Your OTP is incorrect!');
  } else if (!userData.otpExpiry || userData.otpExpiry <= currentTime) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Your OTP is expired, please send new otp',
    );
  }

  if (userData.status !== UserStatus.ACTIVE) {
    await prisma.user.update({
      where: { email: bodyData.email },
      data: {
        otp: null,
        otpExpiry: null,
        status: UserStatus.ACTIVE,
      },
    });
  } else {
    await prisma.user.update({
      where: { email: bodyData.email },
      data: {
        otp: null,
        otpExpiry: null,
      },
    });
  }

  return { message: 'OTP verified successfully!' };
};



// Define a type for the payload to improve type safety
interface SocialLoginPayload {
  fullName: string;
  email: string;
  image?: string | null;
  role?: UserRoleEnum;
  fcmToken?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
}

const socialLoginIntoDB = async (payload: SocialLoginPayload) => {
  // Prevent creating an ADMIN via social sign-up
  if (payload.role === UserRoleEnum.ADMIN || payload.role === UserRoleEnum.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Admin accounts cannot be created via social sign-up.',
    );
  }

  // Find existing user by email
  let userRecord = await prisma.user.findUnique({
    where: { email: payload.email, role: payload.role},
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      image: true,
      onBoarding: true,
      isSubscribed: true,
      subscriptionEnd: true,
      subscriptionPlan: true,
      isProfileComplete: true,
      status: true,
    },
  });

  let isNewUser = false;

  if (userRecord) {
    // Check profile completion
    if (userRecord.isProfileComplete === false) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Please complete your profile before logging in',
      );
    }

    // Check if account is blocked
    if (userRecord.status === UserStatus.BLOCKED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Your account is blocked. Please contact support.',
      );
    }


    // For BARBER, add similar verification check (assuming a barber model exists)
    // if (userRecord.role === UserRoleEnum.BARBER) {
    //   const barber = await prisma.barber.findFirst({
    //     where: { userId: userRecord.id },
    //   });
      
    //   if (barber?.isVerified === false) {
    //     throw new AppError(
    //       httpStatus.BAD_REQUEST,
    //       'Your barber profile is not verified yet. Please wait for verification.',
    //     );
    //   }
    // }
  } else {
    // Validate and sanitize role for new users (default to CUSTOMER if invalid/missing)
    let userRole: UserRoleEnum = UserRoleEnum.CUSTOMER;
    if (payload.role && Object.values(UserRoleEnum).includes(payload.role)) {
      userRole = payload.role;
    }

    // If user does not exist, create
    const created = await prisma.user.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        image: payload.image ?? null,
        role: userRole,
        status: UserStatus.ACTIVE,
        fcmToken: payload.fcmToken ?? null,
        phoneNumber: payload.phoneNumber ?? null,
        address: payload.address ?? null,
        isProfileComplete: payload.role === UserRoleEnum.CUSTOMER ? true : false, // Auto-complete profile for CUSTOMER
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        image: true,
        onBoarding: true,
        isSubscribed: true,
        subscriptionEnd: true,
        subscriptionPlan: true,
      },
    });
    

    // Use created data with defaults (avoid re-fetch)
    userRecord = {
      ...created,
      status: UserStatus.ACTIVE,
      isProfileComplete: true,
      onBoarding: created.onBoarding ?? false,
      isSubscribed: created.isSubscribed ?? false,
      subscriptionEnd: created.subscriptionEnd ?? null,
      subscriptionPlan: created.subscriptionPlan ?? null,
    };

    isNewUser = true;
  }

  // Update FCM token if provided (for both new and existing users)
  if (payload.fcmToken && !isNewUser) { // Skip for new users if already set during create
    await prisma.user.update({
      where: { id: userRecord.id },
      data: { fcmToken: payload.fcmToken },
    });
  }

  // Helper to build tokens
  const buildTokensForUser = async (
    user: typeof userRecord
  ): Promise<{ accessToken: string; refreshToken: string }> => {
    const accessToken = await generateToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        purpose: 'access',
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as string,
    );

    const refreshTokenValue = await refreshToken(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.refresh_secret as Secret,
      config.jwt.refresh_expires_in as string,
    );

    return { accessToken, refreshToken: refreshTokenValue };
  };

  const { accessToken, refreshToken: refreshTokenValue } = await buildTokensForUser(userRecord);

  // Prepare response based on role
  const response: any = {
    id: userRecord.id,
    name: userRecord.fullName,
    email: userRecord.email,
    role: userRecord.role,
    image: userRecord.image,
    accessToken,
    refreshToken: refreshTokenValue,
  };

  // Add role-specific fields
  if (userRecord.role === UserRoleEnum.SALOON_OWNER) {
    response.isSubscribed = userRecord.isSubscribed;
    response.subscriptionEnd = userRecord.subscriptionEnd;
    response.subscriptionPlan = userRecord.subscriptionPlan;
    response.onBoarding = userRecord.onBoarding;
  } else if (userRecord.role === UserRoleEnum.BARBER) {
    response.onBoarding = userRecord.onBoarding;
  }

  return response;
};

const updatePasswordIntoDb = async (payload: any) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  const hashedPassword: string = await bcrypt.hash(payload.password, 12);
  const result = await prisma.user.update({
    where: {
      email: payload.email,
    },
    data: {
      password: hashedPassword,
    },
  });
  return {
    message: 'Password updated successfully!',
  };
};

const deleteAccountFromDB = async (id: string) => {
  const userData = await prisma.user.findUnique({
    where: { id },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  await prisma.user.delete({
    where: { id },
  });

  return { message: 'Account deleted successfully!' };
};

const updateProfileImageIntoDB = async (
  userId: string,
  profileImageUrl: string,
) => {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      image: profileImageUrl,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      image: true,
    },
  });

  if (!updatedUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Profile image not updated!');
  }

  return updatedUser;
};

export const UserServices = {
  registerUserIntoDB,
  getMyProfileFromDB,
  updateMyProfileIntoDB,
  updateUserRoleStatusIntoDB,
  changePassword,
  forgotPassword,
  verifyOtpInDB,
  verifyOtpForgotPasswordInDB,
  socialLoginIntoDB,
  updatePasswordIntoDb,
  resendOtpIntoDB,
  resendUserVerificationEmail,
  deleteAccountFromDB,
  updateProfileImageIntoDB,
};
