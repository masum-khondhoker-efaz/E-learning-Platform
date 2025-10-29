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
import generateOtpToken from '../../utils/generateOtpToken';
import verifyOtp from '../../utils/verifyOtp';

// Initialize Stripe with your secret API key
const stripe = new Stripe(config.stripe.stripe_secret_key as string, {
  apiVersion: '2025-08-27.basil',
});

interface UserWithOptionalPassword extends Omit<User, 'password'> {
  password?: string;
}

const registerUserIntoDB = async (payload: {
  fullName?: string;
  email?: string;
  password?: string;
  address?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  vatId?: string;
  companyName?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyVatId?: string;
}) => {
  // Determine intent
  const hasPersonal =
    !!payload.fullName &&
    !!payload.email &&
    !!payload.password &&
    !!payload.dateOfBirth;
  const hasCompany =
    !!payload.companyName &&
    !!payload.companyEmail &&
    !!payload.password &&
    !!payload.companyAddress &&
    !!payload.companyVatId;

  if (!hasPersonal && !hasCompany) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Provide either personal (fullName, email, dateOfBirth, password) or complete company info.',
    );
  }

  // Check if either personal or company email already exists
  const emailsToCheck: any[] = [];
  if (payload.email) emailsToCheck.push({ email: payload.email });
  if (payload.companyEmail) emailsToCheck.push({ email: payload.companyEmail });

  if (emailsToCheck.length > 0) {
    const existingUser = await prisma.user.findFirst({
      where: { OR: emailsToCheck },
    });
    if (existingUser) {
      const { otp, otpToken } = generateOtpToken(emailsToCheck[0].email);

      // send OTP email
      const recipientName = existingUser.fullName ?? '';
      await emailSender(
        'Verify Your Email',
        emailsToCheck[0].email,
        `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <table width="100%" style="border-collapse: collapse;">
            <tr>
              <td style="background-color: #46BEF2; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px;">
                <p style="font-size: 16px; margin: 0;">Hello <strong>${recipientName}</strong>,</p>
                <p style="font-size: 16px;">Please verify your email.</p>
                <div style="text-align: center; margin: 20px 0;">
                  <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otp}</span><br/> This OTP will expire in 5 minutes.</p>
                </div>
                <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email.</p>
                <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>E-learning</p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-learning Team. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </div>`,
      );
      return otpToken;
    }
  }

  // Hash password once (used for whichever user we create)
  if (!payload.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Password is required for registration.',
    );
  }
  const hashedPassword = await bcrypt.hash(payload.password, 12);

  let createdUser: {
    id: string;
    fullName: string;
    email: string;
    role: UserRoleEnum;
  } | null = null;
  let createdCompany: any = null;

  // Prefer company flow if company info provided (per requirement)
  await prisma.$transaction(async tx => {
    if (hasCompany) {
      // Check company email uniqueness
      // const existingCompanyUser = await tx.user.findUnique({
      //   where: { email: payload.companyEmail },
      // });
      // if (existingCompanyUser) {
      //   throw new AppError(httpStatus.CONFLICT, 'Company email already in use!');
      // }

      // Create a user entry for the company to allow universal login (role = COMPANY)
      const companyUser = await tx.user.create({
        data: {
          fullName: payload.companyName!,
          email: payload.companyEmail!,
          password: hashedPassword,
          role: UserRoleEnum.COMPANY,
          isVerified: false,
          // other fields left null/default
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      });

      if (!companyUser) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Company user not created!');
      }

      // Create company profile linked to the company user
      createdCompany = await tx.company.create({
        data: {
          userId: companyUser.id,
          companyName: payload.companyName!,
          companyEmail: payload.companyEmail!,
          companyAddress: payload.companyAddress!,
          companyVatId: payload.companyVatId!,
        },
      });

      if (!createdCompany) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Company not created!');
      }

      // Ensure createdUser.fullName is non-nullable by falling back to the provided payload.companyName
      createdUser = {
        id: companyUser.id,
        fullName: companyUser.fullName ?? payload.companyName!,
        email: companyUser.email,
        role: companyUser.role,
      };
    } else {
      // Personal (STUDENT) flow
      // Check personal email uniqueness
      // const existingUser = await tx.user.findUnique({
      //   where: { email: payload.email },
      // });
      // if (existingUser) {
      //   throw new AppError(httpStatus.CONFLICT, 'User already exists!');
      // }

      const studentUser = await tx.user.create({
        data: {
          fullName: payload.fullName,
          email: payload.email!,
          password: hashedPassword,
          dateOfBirth: payload.dateOfBirth,
          address: payload.address ?? null,
          phoneNumber: payload.phoneNumber ?? null,
          vatId: payload.vatId ?? null,
          role: UserRoleEnum.STUDENT,
          isVerified: false,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      });

      if (!studentUser) {
        throw new AppError(httpStatus.BAD_REQUEST, 'User not created!');
      }

      createdUser = {
        id: studentUser.id,
        fullName: studentUser.fullName ?? payload.fullName!,
        email: studentUser.email,
        role: studentUser.role,
      };
    }
  });

  if (!createdUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Registration failed!');
  }

  // generate OTP + token for the created user's email
  const emailForOtp = (createdUser as { email: string }).email;
  if (!emailForOtp) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Registration failed!');
  }
  const { otp, otpToken } = generateOtpToken(emailForOtp);

  // send OTP email
  const recipientName = (createdUser as any)?.fullName ?? '';
  await emailSender(
    'Verify Your Email',
    emailForOtp,
    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <table width="100%" style="border-collapse: collapse;">
            <tr>
              <td style="background-color: #46BEF2; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px;">
                <p style="font-size: 16px; margin: 0;">Hello <strong>${recipientName}</strong>,</p>
                <p style="font-size: 16px;">Please verify your email.</p>
                <div style="text-align: center; margin: 20px 0;">
                  <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otp}</span><br/> This OTP will expire in 5 minutes.</p>
                </div>
                <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email.</p>
                <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>E-learning</p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-learning Team. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </div>`,
  );

  // return token for frontend verification
  return otpToken;
};

//resend verification email
const resendUserVerificationEmail = async (email: string) => {
  const userData = await prisma.user.findUnique({
    where: { email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  // ✅ Generate OTP and token
  const otpToken = generateOtpToken(userData.email);

  // ✅ Send email with OTP
  await emailSender(
    'Verify Your Email',
    email,
    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <table width="100%" style="border-collapse: collapse;">
          <tr>
            <td style="background-color: #46BEF2; padding: 20px; text-align: center; color: #000000; border-radius: 10px 10px 0 0;">
              <h2 style="margin: 0; font-size: 24px;">Verify your email</h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
              <p style="font-size: 16px;">Please verify your email.</p>
              <div style="text-align: center; margin: 20px 0;">
                <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otpToken.otp}</span><br/> This OTP will expire in 5 minutes.</p>
              </div>
              <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email.</p>
              <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>E-learning</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-learning Team. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </div>`,
  );

  // ✅ Return token for frontend to verify later
  return otpToken; // frontend must keep this for verification
};

const getMyProfileFromDB = async (id: string) => {
  const Profile = await prisma.user.findUnique({
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
      image: true,
      vatId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Profile;
};

const getCompanyProfileFromDB = async (id: string) => {
  const Profile = await prisma.user.findUnique({
    where: {
      id: id,
    },
    include: {
      Company: {
        select: {
          id: true,
          companyName: true,
          companyEmail: true,
          companyAddress: true,
          companyVatId: true,
        },
      },
    },
  });
  return {
    role: Profile?.role,
    dateOfBirth: Profile?.dateOfBirth ?? null,
    phoneNumber: Profile?.phoneNumber ?? null,
    vatId: Profile?.vatId ?? null,
    fullName: Profile?.Company?.[0]?.companyName ?? null,
    image: Profile?.image ?? null,
    email: Profile?.Company?.[0]?.companyEmail ?? null,
    address: Profile?.Company?.[0]?.companyAddress ?? null,
    // vatId: Profile?.Company?.[0]?.companyVatId ?? null,
  };
};

const updateMyProfileIntoDB = async (id: string, payload: any) => {
  const userData = payload;

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });
  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (existingUser.role === UserRoleEnum.EMPLOYEE && payload.fullName) {
    userData.isProfileComplete = true;
  }

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
  const updatedUser = await prisma.user.findUnique({
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
  if (!updatedUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not updated!');
  }

  // const userWithOptionalPassword = updatedUser as UserWithOptionalPassword;
  // delete userWithOptionalPassword.password;

  return updatedUser;
};

const updateMyProfileForCompanyIntoDB = async (id: string, payload: any) => {
  const userData = payload;
  const existingUser = await prisma.user.findUnique({
    where: { id },
  });
  if (!existingUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  // update user data
  await prisma.$transaction(async (transactionClient: any) => {
    //update company profile if companyName or companyAddress or companyVatId is provided
    const companyData: any = {};
    if (payload.companyName) {
      companyData.companyName = payload.companyName;
      delete userData.companyName;
    }
    if (payload.companyAddress) {
      companyData.companyAddress = payload.companyAddress;
      delete userData.companyAddress;
    }
    if (payload.companyVatId) {
      companyData.companyVatId = payload.companyVatId;
      delete userData.companyVatId;
    }

    console.log('companyData', companyData);
    console.log('userData', Object.keys(companyData).length);

    if (Object.keys(companyData).length > 0) {
      await transactionClient.company.updateMany({
        where: { userId: id },
        data: companyData,
      });
      await transactionClient.user.update({
        where: { id },
        data: {
          fullName: companyData.companyName || existingUser.fullName,
          isProfileComplete: true,
          vatId: companyData.companyVatId || existingUser.vatId || null,
        },
      });
    }

    // Update user data
    const updatedUser = await transactionClient.user.update({
      where: { id },
      data: userData,
    });

    return { updatedUser };
  });
  // Fetch and return the updated user (Company relation is an array so include it and read the first item)
  const updatedUser = await prisma.user.findUnique({
    where: { id },
    include: {
      Company: {
        select: {
          id: true,
          companyName: true,
          companyEmail: true,
          companyAddress: true,
          companyVatId: true,
        },
      },
    },
  });

  // Company is a relation array; return the first company if present
  return {
    companyName: updatedUser?.Company?.[0]?.companyName ?? null,
    image: updatedUser?.image ?? null,
    companyEmail: updatedUser?.Company?.[0]?.companyEmail ?? null,
    companyAddress: updatedUser?.Company?.[0]?.companyAddress ?? null,
    companyVatId: updatedUser?.Company?.[0]?.companyVatId ?? null,
  };
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
  const userData = await prisma.user.findUnique({
    where: {
      id: userId,
      email: user.email,
      status: UserStatus.ACTIVE,
    },
  });

  if (userData?.password === null) {
    throw new AppError(httpStatus.CONFLICT, 'Password not set for this user');
  }

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.oldPassword,
    userData!.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect!');
  }

  const newPasswordSameAsOld: boolean = await bcrypt.compare(
    payload.newPassword,
    userData!.password,
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
      id: userData!.id,
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
    where: { email: payload.email },
  });
  if (userData?.role === UserRoleEnum.EMPLOYEE) {
    const employeeCred = await prisma.employeeCredential.findUnique({
      where: { loginEmail: payload.email },
    });
    if (!employeeCred) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Employee credentials not found!',
      );
    }
    if (!employeeCred.companyId) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Employee not associated with any company!',
      );
    }

    const company = await prisma.user.findUnique({
      where: { id: employeeCred.companyId },
    });
    if (!company?.email) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Associated company email not found!',
      );
    }

    userData.email = company.email;
  }

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  // ✅ Generate OTP + JWT token
  const otpToken = generateOtpToken(userData.email);

  // ✅ Send email
  await emailSender(
    'Reset Your Password',
    userData.email,
    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="background-color: #46BEF2; padding: 20px; text-align: center; color: #fff; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">Reset Password OTP</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px;">
            <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
            <p style="font-size: 16px;">Please verify your email to reset your password.</p>
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otpToken.otp}</span><br/>This OTP will expire in 5 minutes.</p>
            </div>
            <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
            <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>E-learning</p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-learning Team. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>`,
  );

  // ✅ Return token to frontend for later verification
  return otpToken; // frontend must send this back with OTP for verification
};

//resend otp
const resendOtpIntoDB = async (payload: { email: string }) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (userData?.role === UserRoleEnum.EMPLOYEE) {
    const employeeCred = await prisma.employeeCredential.findUnique({
      where: { loginEmail: payload.email },
    });
    if (!employeeCred) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Employee credentials not found!',
      );
    }
    if (!employeeCred.companyId) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Employee not associated with any company!',
      );
    }

    const company = await prisma.user.findUnique({
      where: { id: employeeCred.companyId },
    });
    if (!company?.email) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Associated company email not found!',
      );
    }

    userData.email = company.email;
  }

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  if (!userData.email) {
    throw new AppError(httpStatus.CONFLICT, 'Email not set for this user');
  }

  // ✅ Generate OTP + JWT token
  const otpToken = generateOtpToken(userData.email);

  // ✅ Send email
  await emailSender(
    'Reset Password OTP',
    userData.email,
    `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #000000; border-radius: 10px;">
      <table width="100%" style="border-collapse: collapse;">
        <tr>
          <td style="background-color: #46BEF2; padding: 20px; text-align: center; color: #fff; border-radius: 10px 10px 0 0;">
            <h2 style="margin: 0; font-size: 24px;">Reset Password OTP</h2>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px;">
            <p style="font-size: 16px; margin: 0;">Hello <strong>${userData.fullName}</strong>,</p>
            <p style="font-size: 16px;">Please verify your email to reset your password.</p>
            <div style="text-align: center; margin: 20px 0;">
              <p style="font-size: 18px;">Your OTP is: <span style="font-weight:bold">${otpToken.otp}</span><br/>This OTP will expire in 5 minutes.</p>
            </div>
            <p style="font-size: 14px; color: #555;">If you did not request this change, please ignore this email. No further action is needed.</p>
            <p style="font-size: 16px; margin-top: 20px;">Thank you,<br>E-learning</p>
          </td>
        </tr>
        <tr>
          <td style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888; border-radius: 0 0 10px 10px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-learning Team. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>`,
  );

  // ✅ Return token to frontend for verification
  return otpToken;
};

// verify otp
// const verifyOtpInDB1 = async (bodyData: {
//   email: string;
//   password: string;
//   otp: number;
// }) => {
//   const userData = await prisma.user.findUnique({
//     where: { email: bodyData.email },
//   });

//   if (!userData) {
//     throw new AppError(httpStatus.CONFLICT, 'User not found!');
//   }

//   const currentTime = new Date();

//   // if (userData.otp !== bodyData.otp) {
//   //   throw new AppError(httpStatus.CONFLICT, 'Your OTP is incorrect!');
//   // }

//   // if (!userData.otpExpiry || userData.otpExpiry <= currentTime) {
//   //   throw new AppError(
//   //     httpStatus.CONFLICT,
//   //     'Your OTP has expired. Please request a new one.',
//   //   );
//   // }

//   // Prepare common fields
//   const updateData: any = {
//     otp: null,
//     otpExpiry: null,
//   };

//   // If user is not active, determine what else to update
//   if (userData.status !== UserStatus.ACTIVE) {
//     // updateData.status = UserStatus.ACTIVE;
//   }

//   await prisma.user.update({
//     where: { email: bodyData.email },
//     data: updateData,
//   });

//   // Create a new Stripe customer
//   const customer = await stripe.customers.create({
//     name: userData.fullName,
//     email: userData.email,
//     address: {
//       city: userData.address ?? 'City', // You can modify this as needed
//       country: 'America', // You can modify this as needed
//     },
//     metadata: {
//       userId: userData.id,
//       role: userData.role,
//     },
//   });
//   if (!customer || !customer.id) {
//     throw new AppError(httpStatus.BAD_REQUEST, 'Stripe customer not created!');
//   }

//   return { message: 'OTP verified successfully!' };
// };

const verifyOtpInDB = async (bodyData: {
  email: string;
  otp: number;
  otpToken: string; // <-- token from frontend
}) => {
  await prisma.$transaction(async tx => {
    const userData = await tx.user.findUnique({
      where: { email: bodyData.email },
    });

    if (!userData) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
    }

    // ✅ use JWT util to validate OTP
    const isValid = verifyOtp(bodyData.email, bodyData.otp, bodyData.otpToken);
    if (!isValid) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP!');
    }

    // Activate user
    const updatedUser = await tx.user.update({
      where: { email: bodyData.email },
      data: {
        status: UserStatus.ACTIVE,
        isVerified: true,
        isProfileComplete: true,
      },
    });

    // Ensure Stripe customer
    if (!updatedUser.stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: userData.fullName!,
        email: userData.email,
        address: {
          city: userData.address ?? 'City',
          country: 'PL', // Poland for your project
        },
        metadata: {
          userId: userData.id,
          role: userData.role,
        },
      });

      await tx.user.update({
        where: { id: userData.id },
        data: { stripeCustomerId: customer.id },
      });
    }
  });

  return;
};

// verify otp
const verifyOtpForgotPasswordInDB = async (payload: {
  email: string;
  otp: number;
  otpToken: string;
}) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // ✅ Verify OTP using JWT token
  const isValid = verifyOtp(payload.email, payload.otp, payload.otpToken);
  if (!isValid) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP!');
  }

  // ✅ Clear any existing OTP flags if needed (optional)
  await prisma.user.update({
    where: { email: payload.email },
    data: {
      isVerifiedForPasswordReset: true, // flag to allow password reset
    },
  });

  return;
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
  if (
    payload.role === UserRoleEnum.ADMIN ||
    payload.role === UserRoleEnum.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Admin accounts cannot be created via social sign-up.',
    );
  }

  // Find existing user by email
  let userRecord = await prisma.user.findUnique({
    where: { email: payload.email, role: payload.role },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      image: true,
      isProfileComplete: true,
      status: true,
    },
  });

  let isNewUser = false;

  if (userRecord) {
    // Check profile completion
    // if (userRecord.isProfileComplete === false) {
    //   throw new AppError(
    //     httpStatus.BAD_REQUEST,
    //     'Please complete your profile before logging in',
    //   );
    // }

    // Check if account is blocked
    if (userRecord.status === UserStatus.BLOCKED) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        'Your account is blocked. Please contact support.',
      );
    }
  } else {
    // Validate and sanitize role for new users (default to STUDENT if invalid/missing)
    let userRole: UserRoleEnum = UserRoleEnum.STUDENT;
    if (payload.role && Object.values(UserRoleEnum).includes(payload.role)) {
      userRole = payload.role;
    }

    // If user does not exist, create
    const created = await prisma.user.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        image: payload.image ?? null,
        role: UserRoleEnum.STUDENT, // Default role for social sign-ups
        status: UserStatus.ACTIVE,
        fcmToken: payload.fcmToken ?? null,
        phoneNumber: payload.phoneNumber ?? null,
        address: payload.address ?? null,
        isProfileComplete: true, // Assume social login users have complete profiles
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        image: true,
      },
    });

    // Use created data with defaults (avoid re-fetch)
    userRecord = {
      ...created,
      status: UserStatus.ACTIVE,
      isProfileComplete: true,
    };

    isNewUser = true;
  }

  // Update FCM token if provided (for both new and existing users)
  if (payload.fcmToken && !isNewUser) {
    // Skip for new users if already set during create
    await prisma.user.update({
      where: { id: userRecord.id },
      data: { fcmToken: payload.fcmToken },
    });
  }

  // Helper to build tokens
  const buildTokensForUser = async (
    user: typeof userRecord,
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

  const { accessToken, refreshToken: refreshTokenValue } =
    await buildTokensForUser(userRecord);

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

  return response;
};

const updatePasswordIntoDb = async (payload: any) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }

  // Only allow password update if user has verified OTP (e.g., set a flag after OTP verification)
  if (userData.isVerifiedForPasswordReset !== true) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'OTP verification required before updating password.',
    );
  }

  const hashedPassword: string = await bcrypt.hash(payload.password, 12);
  await prisma.user.update({
    where: { email: payload.email },
    data: {
      password: hashedPassword,
      isVerifiedForPasswordReset: false, // reset flag after password update
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
  getCompanyProfileFromDB,
  updateMyProfileIntoDB,
  updateMyProfileForCompanyIntoDB,
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
