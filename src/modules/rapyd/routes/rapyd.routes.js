import { Router } from 'express';
import { createRapydUserWalletAndAccount, rapydWebhook , createRapydPayment,
    enableRapydWallet, getAllRapydWallet

} from '../controller/rapyd.controller';
import { isAuth } from '../../../middlewares/auth.middleware';
import { imageUpload, imageKitUpload } from '../../../utils/imagekit';


const router = Router();

router.use(isAuth);
router.post("/createRapydUserWalletAndAccount", createRapydUserWalletAndAccount);
// router.post("/webhook", express.json({ type: "*/*" }), rapydWebhook);
router.post("/createRapydPayment", createRapydPayment);
router.post("/enableRapydWallet", enableRapydWallet);
router.get("/getAllRapydWallet", getAllRapydWallet);



export default router;
