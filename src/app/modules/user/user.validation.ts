import z from 'zod';
const registerUser = z.object({
  body: z.object({
    fullName: z
      .string({
        required_error: 'Name is required!',
      })
      .optional(),
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      })
      .optional(),
    dateOfBirth: z
      .string({
        required_error: 'Date of birth is required!',
      })
      .optional(),
    password: z
      .string({
        required_error: 'Password is required!',
      })
      .optional(),
    address: z
      .string({
        required_error: 'Address is required!',
      })
      .optional(),
    phoneNumber: z
      .string({
        required_error: 'Phone number is required!',
      })
      .optional(),
    vatId: z
      .string({
        required_error: 'VAT ID is required!',
      })
      .optional(),
    companyName: z
      .string({
        required_error: 'Company name is required!',
      })
      .optional(),
    companyEmail: z
      .string({
        required_error: 'Company email is required!',
      })
      .email({
        message: 'Invalid email format!',
      })
      .optional(),
    companyAddress: z
      .string({
        required_error: 'Company address is required!',
      })
      .optional(),
    companyVatId: z
      .string({
        required_error: 'Company VAT ID is required!',
      })
      .optional(),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    fullName: z
      .string({
        required_error: 'Name is required!',
      })
      .optional(),
    gender: z
      .string({
        required_error: 'Password is required!',
      })
      .optional(),
    phoneNumber: z
      .string({
        required_error: 'Phone number is required!',
      })
      .optional(),
    dateOfBirth: z
      .string({
        required_error: 'Date of birth is required!',
      })
      .optional(),

    address: z
      .string({
        required_error: 'Address is required!',
      })
      .optional(),
    vatId: z
      .string({
        required_error: 'VAT ID is required!',
      })
      .optional(),
    companyName: z
      .string({
        required_error: 'Company name is required!',
      })
      .optional(),
    companyAddress: z
      .string({
        required_error: 'Company address is required!',
      })
      .optional(),
    companyVatId: z
      .string({
        required_error: 'Company VAT ID is required!',
      })
      .optional(),
  }),
});

const updatePasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    password: z.string({
      required_error: 'Password is required!',
    }),
  }),
});

const forgetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    newPassword: z.string({
      required_error: 'Password is required!',
    }),
  }),
});

const verifyOtpSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    otp: z.number({
      required_error: 'OTP is required!',
    }),
    otpToken: z.string({
      required_error: 'OTP token is required!',
    }),
  }),
});

const socialLoginSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      })
      .optional(),
    fullName: z.string({
      required_error: 'name is required!',
    }),
    fcmToken: z.string({
      required_error: 'Fcm token is required!',
    }),
    phoneNumber: z
      .string({
        required_error: 'Phone number is required!',
      })
      .optional(),
    plateForm: z.enum(['GOOGLE', 'FACEBOOK', 'APPLE'], {
      required_error: 'PlatForm is required!',
    }),
    image: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const UserValidations = {
  registerUser,
  updateProfileSchema,
  updatePasswordSchema,
  forgetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
  socialLoginSchema,
};
