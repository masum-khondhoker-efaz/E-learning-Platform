import { z } from 'zod';

const addUserWithCompanySchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').optional(),
    email: z.string().email('Invalid email format').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    // role: z.string().optional(), // e.g. "admin", "user"
    status: z.string().optional(), // e.g. "active", "inactive"
    dateOfBirth: z.string().optional(), // ISO date string e.g. "1995-10-02"
    address: z.string().optional(),
    phoneNumber: z.string().optional(),
    courseId: z.string().optional(),
    companyName: z.string().optional(),
    companyEmail: z.string().email('Invalid company email format').optional(),
    companyAddress: z.string().optional(),
    companyVatId: z.string().optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const adminValidation = {
  addUserWithCompanySchema,
  updateSchema,
};
