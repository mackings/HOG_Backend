import { Router } from 'express';
import { createRapydUserWalletAndAccount, rapydWebhook } from '../controller/rapyd.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { imageUpload, imageKitUpload } from '../../../utils/imagekit';


const router = Router();


router.post("/createRapydUserWalletAndAccount", createRapydUserWalletAndAccount);
// router.post("/webhook", express.json({ type: "*/*" }), rapydWebhook);



export default router;
