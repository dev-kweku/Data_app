import express from "express"
import { TppQrController } from "../controllers/tppQrController"

const router=express.Router();

router.post("/qr/create",TppQrController.createQr)
router.post("/qr/scan",TppQrController.scanQr)
router.get("/qr/status/:trxn",TppQrController.checkStatus)

export default router;