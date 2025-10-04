import { UserRoleEnum, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import config from '../../config';
import prisma from '../utils/prisma';

const superAdminData = {
  fullName: 'Super Admin',
  email: 'admin@gmail.com',
  password: '',
  role: UserRoleEnum.SUPER_ADMIN,
  status: UserStatus.ACTIVE,
  isProfileComplete: true,
  isVerified: true,
};

const seedSuperAdmin = async () => {
  try {
    // Check if a super admin already exists
    const isSuperAdminExists = await prisma.user.findFirst({
      where: {
        role: UserRoleEnum.SUPER_ADMIN,
      },
    });

    // If not, create one
    if (!isSuperAdminExists) {
      superAdminData.password = await bcrypt.hash(
        config.super_admin_password as string,
        Number(config.bcrypt_salt_rounds) || 12,
      );
      const superAdmin = await prisma.user.create({
        data: superAdminData,
      });
      const admin = await prisma.admin.create({
        data: {
          userId: superAdmin.id,
          isSuperAdmin: true, // Set isSuperAdmin to true
          systemOwner: true, // Set systemOwner to true
        },
      });
      // Optionally, you can log the created super admin and admin
      console.log('Super Admin created:', superAdmin);
      console.log('Admin created:', admin);
      console.log('Super Admin created successfully.');
    } else {
      return;
      //   console.log("Super Admin already exists.");
    }
  } catch (error) {
    console.error('Error seeding Super Admin:', error);
  }
};

export default seedSuperAdmin;
