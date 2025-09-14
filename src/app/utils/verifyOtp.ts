import jwt from 'jsonwebtoken';
import config from '../../config';
const verifyOtp = (email: string, otp: number, token: string) => {
  try {
    const secret = config.jwt.otp_secret!;
    const decoded = jwt.verify(token, secret) as { email: string; otp: number };
    console.log('Decoded OTP:', decoded.otp, 'Provided OTP:', otp);

    if (decoded.email !== email) {
      throw new Error('Email mismatch');
    }


    if (decoded.otp !== Number(otp)) {
      throw new Error('Invalid OTP');
    }

    return true; // OTP valid
  } catch (err) {
    throw new Error('OTP expired or invalid');
  }
};
export default verifyOtp;
