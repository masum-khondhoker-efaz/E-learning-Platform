import { z } from 'zod';

const addUserWithCompanySchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.string().optional(), // e.g. "admin", "user"
    status: z.string().optional(), // e.g. "active", "inactive"
    dateOfBirth: z.string(), // ISO date string e.g. "1995-10-02"
    companyName: z.string(),
    companyEmail: z.string().email('Invalid company email format'),
    companyAddress: z.string(),
    companyVatId: z.string(),
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
