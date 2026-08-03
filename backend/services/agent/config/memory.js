import redis from "../../../shared/redis/redis.js"
import { getMessages } from "../utils/getMessages.js"
export const getMemory=async (conversationId)=>{
    const key=`messages-${conversationId}`
    const cached=await redis.get(key)
    if(cached){
        return JSON.parse(cached)
    }
    
    const messages=await getMessages(conversationId)
    await redis.set(key,JSON.stringify(messages),"EX",24*60*60)
    
    return messages
}

export const addMessages=async (conversationId,newMessages)=>{
     const key=`messages-${conversationId}`
     const rawMessages=await redis.get(key)
     const messages=rawMessages?JSON.parse(rawMessages):[]
     messages.push(...newMessages)

     const recentMessages=messages.slice(-20)

     await redis.set(key,JSON.stringify(recentMessages),"EX",24*60*60)
}

export const addMessage=async (conversationId,role,content)=>addMessages(
    conversationId,
    [{role,content}]
)

