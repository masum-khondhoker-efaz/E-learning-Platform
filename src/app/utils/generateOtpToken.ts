import e from 'cors';
import jwt from 'jsonwebtoken';
import config from '../../config';

const generateOtpToken = (email: string) => {
  const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit
  const secret = config.jwt.otp_secret!; // separate secret for OTPs

  const otpToken = jwt.sign(
    { email, otp },
    secret,
    { expiresIn: config.jwt.otp_expires_in }, // auto-expire
  );

  return { otp, otpToken };
};

export default generateOtpToken;
