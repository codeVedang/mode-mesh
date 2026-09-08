import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import router from "./routes/agent.route.js"
import requireInternalService from "../../shared/security/requireInternalService.js"
import mongoose from 'mongoose'
import { recoverMissions } from './missions/service.js'
dotenv.config()

const port =process.env.PORT

const app=express()

app.use(express.json())
app.use(requireInternalService)
app.use("/",router)

app.use((err,req,res,next)=>{
  console.log(err)

  if(err.status){
    return res.status(err.status).json(err.data)
  }

  return res.status(500).json({message:`agent error ${err.message}`})
})


app.get("/",(req,res)=>{
    res.json({message:"hello from agent"})
})

app.listen(port,()=>{
    console.log(`agent started at ${port}`)
    connectDb()
})

let recovering = false
setInterval(async () => {
  if (recovering || mongoose.connection.readyState !== 1) return
  recovering = true
  try { await recoverMissions() }
  catch (error) { console.error('Mission recovery scan failed', error.message) }
  finally { recovering = false }
}, 30000).unref()
