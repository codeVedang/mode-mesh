import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import router from "./routes/auth.route.js"
import requireInternalService from "../../shared/security/requireInternalService.js"
dotenv.config()

const port =process.env.PORT

const app=express()
app.use(express.json())
app.use(requireInternalService)
app.use("/",router)
app.get("/",(req,res)=>{
    res.json({message:"hello from auth"})
})

app.listen(port,()=>{
    console.log(`auth started at ${port}`)
    connectDb()
})
