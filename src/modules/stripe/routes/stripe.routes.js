import { Router } from 'express';
import { createUserAccount, createVirtualAccount, accountSetup  } from '../controller/stripe.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { imageUpload, imageKitUpload } from '../../../utils/imagekit';


const router = Router();


router.post("/create-account", createVirtualAccount);
router.post("/create-user-account", createUserAccount);
router.post("/account-setup", accountSetup);



export default router;
