import axios from "axios"
import { graph } from "../graph/graph.js"
import { addMessages } from "../config/memory.js"


export const agent=async (req,res,next) => {
    try {
        const {prompt,conversationId,agent}=req.body
        const file=req.file
        const userId=req.headers["x-user-id"]
        const [result]=await Promise.all([
            graph.invoke({
                prompt,conversationId,agent,userId,file
            }),
            axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
                conversationId,role:"user",content:prompt
            },{
                headers:{"x-internal-service-token":process.env.INTERNAL_SERVICE_TOKEN}
            })
        ])

        await Promise.all([
            addMessages(conversationId,[
                {role:"user",content:prompt},
                {role:"assistant",content:result.aiResponse}
            ]),
            axios.post(`${process.env.CHAT_SERVICE}/save-message`,{
                conversationId,role:"assistant",content:result?.aiResponse,images:result?.images,artifacts:result?.artifacts
            },{
                headers:{"x-internal-service-token":process.env.INTERNAL_SERVICE_TOKEN}
            })
        ])
        return res.status(200).json({
            answer:result?.aiResponse,
            images:result?.images,
            artifacts:result?.artifacts
        })
       
    } catch (error) {
       next(error)
    }
}
