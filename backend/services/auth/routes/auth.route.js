import express from "express"
import { deductCredits, login, logOut, updateUserPayment } from "../controllers/auth.controller.js"
import { missionCredits } from '../controllers/missionCredits.js'

const router=express.Router()

router.post("/login",login)
router.get("/logout",logOut)
router.post("/update-plan",updateUserPayment)
router.post("/deduct-credits",deductCredits)
router.post('/mission-credits',missionCredits)
export default router
