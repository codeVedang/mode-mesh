import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import router from "./routes/chat.routes.js"
import requireInternalService from "../../shared/security/requireInternalService.js"

dotenv.config()

const port =process.env.PORT

const app=express()
app.use(express.json())
app.use(requireInternalService)
app.use("/",router)
app.get("/",(req,res)=>{
    res.json({message:"hello from chat"})
})

app.listen(port,()=>{
    console.log(`chat started at ${port}`)
    connectDb()
})
