import jwt from 'jsonwebtoken';
import config from '../../config';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
const verifyOtp = (email: string, otp: number, token: string) => {
  try {
    const secret = config.jwt.otp_secret!;
    const decoded = jwt.verify(token, secret) as { email: string; otp: number };
    console.log('Decoded OTP:', decoded.otp, 'Provided OTP:', otp);

    if (decoded.email !== email) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Email mismatch');
    }


    if (decoded.otp !== Number(otp)) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid OTP');
    }

    return true; // OTP valid
  } catch (err) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }
};
export default verifyOtp;
