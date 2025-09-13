import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from '../auth/auth.service';

const loginUser = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUserFromDB(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User logged in successfully',
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const refreshToken = req.headers.authorization as string;

  const result = await AuthServices.refreshTokenFromDB(refreshToken);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Token refreshed successfully',
    data: result,
  });
});

const logoutUser = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await AuthServices.logoutUserFromDB(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
    message: 'User logged out successfully',
  });
});

export const AuthControllers = { loginUser, logoutUser, refreshToken };
