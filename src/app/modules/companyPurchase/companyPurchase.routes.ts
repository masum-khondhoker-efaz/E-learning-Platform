import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { companyPurchaseController } from './companyPurchase.controller';
import { companyPurchaseValidation } from './companyPurchase.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(companyPurchaseValidation.createSchema),
companyPurchaseController.createCompanyPurchase,
);

router.get('/', auth(), companyPurchaseController.getCompanyPurchaseList);

router.get('/:id', auth(), companyPurchaseController.getCompanyPurchaseById);

router.put(
'/:id',
auth(),
validateRequest(companyPurchaseValidation.updateSchema),
companyPurchaseController.updateCompanyPurchase,
);

router.delete('/:id', auth(), companyPurchaseController.deleteCompanyPurchase);

export const companyPurchaseRoutes = router;