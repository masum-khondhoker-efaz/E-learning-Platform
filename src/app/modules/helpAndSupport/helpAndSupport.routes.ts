import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { helpAndSupportController } from './helpAndSupport.controller';
import { helpAndSupportValidation } from './helpAndSupport.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(helpAndSupportValidation.createSchema),
  helpAndSupportController.createHelpAndSupport,
);

router.get('/', auth(), helpAndSupportController.getHelpAndSupportList);

router.get('/:id', auth(), helpAndSupportController.getHelpAndSupportById);

router.patch(
  '/:id',
  auth(),
  validateRequest(helpAndSupportValidation.updateSchema),
  helpAndSupportController.updateHelpAndSupport,
);

router.delete('/:id', auth(), helpAndSupportController.deleteHelpAndSupport);

export const helpAndSupportRoutes = router;
