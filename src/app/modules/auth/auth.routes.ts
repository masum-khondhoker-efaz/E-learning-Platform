import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { AuthControllers } from '../auth/auth.controller';
import { authValidation } from '../auth/auth.validation';
const router = express.Router();

router.post(
  '/login',
  validateRequest(authValidation.loginUser),
  AuthControllers.loginUser,
);

router.post('/refresh-token', AuthControllers.refreshToken);

router.post('/logout', auth(), AuthControllers.logoutUser);

export const AuthRouters = router;
