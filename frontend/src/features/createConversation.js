import api from "../../utils/axios"

export const createConversation=async () => {
    const {data}=await api.get("/api/chat/create-conversation")
    return data
}
