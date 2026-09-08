import express from "express"
import { agent } from "../controllers/agent.controller.js"
import multer from "../config/multer.js"
import * as missions from '../missions/controller.js'

const router=express.Router()

router.post("/chat",multer.single("file"),agent)
router.get('/missions', missions.list)
router.post('/missions', missions.create)
router.get('/missions/:id', missions.get)
router.patch('/missions/:id', missions.edit)
router.post('/missions/:id/start', missions.start)
router.post('/missions/:id/cancel', missions.cancel)
router.post('/missions/:id/revise', missions.revise)
router.get('/missions/:id/files/:type', missions.download)

export default router
