
import api from '../../utils/axios'

async function getMessages(id, { signal } = {}) {
try {
    const {data}=await api.get(`/api/chat/get-messages/${id}`, { signal })
    return data
} catch (error) {
    if (signal?.aborted) return []
    console.log(error)
    return []
}
}

export default getMessages
