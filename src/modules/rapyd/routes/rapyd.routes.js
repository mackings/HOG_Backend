import { Router } from 'express';
import { createRapydUserWalletAndAccount, rapydWebhook , walletBankTransfer,
    enableRapydWallet, getRapydWalletWithVirtualAccounts, externalBankTransfer

} from '../controller/rapyd.controller.js';
import { isAuth } from '../../../middlewares/auth.middleware.js';
import { imageUpload, imageKitUpload } from '../../../utils/imagekit.js';


const router = Router();

router.use(isAuth);
router.post("/createRapydUserWalletAndAccount", createRapydUserWalletAndAccount);
// router.post("/webhook", express.json({ type: "*/*" }), rapydWebhook);
router.post("/walletBankTransfer/:id", walletBankTransfer);
router.post("/enableRapydWallet", enableRapydWallet);
router.get("/getRapydWalletWithVirtualAccounts", getRapydWalletWithVirtualAccounts);
router.post("/externalBankTransfer", externalBankTransfer);



export default router;
