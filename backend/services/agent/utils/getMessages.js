import axios from "axios"

export const getMessages=async (conversationId)=>{
    try {
       const {data}=await axios.get(`${process.env.CHAT_SERVICE}/get-messages/${conversationId}`,{
        headers:{"x-internal-service-token":process.env.INTERNAL_SERVICE_TOKEN}
       })
       return data
    } catch (error) {
        console.log(error)
        return null
    }
}
