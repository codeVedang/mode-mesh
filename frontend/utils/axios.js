import axios from "axios";

const SERVICE_RETRY_DELAYS_MS = [1500, 3500, 7000]

const api=axios.create({
    baseURL:import.meta.env.VITE_SERVER_URL,
    withCredentials:true
})

const delay = (milliseconds) => new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
})

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config
        const responseData = error.response?.data
        const serviceIsStarting = error.response?.status === 503 && (
            responseData?.code === "SERVICE_STARTING"
            || responseData?.message === "The requested service is still starting. Please try again shortly."
        )
        const retryCount = config?.modeMeshServiceRetryCount || 0

        if (
            !config
            || !serviceIsStarting
            || config.signal?.aborted
            || retryCount >= SERVICE_RETRY_DELAYS_MS.length
        ) {
            return Promise.reject(error)
        }

        config.modeMeshServiceRetryCount = retryCount + 1
        await delay(SERVICE_RETRY_DELAYS_MS[retryCount])
        return api.request(config)
    },
)

export default api

