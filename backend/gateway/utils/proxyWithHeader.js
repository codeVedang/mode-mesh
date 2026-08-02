import proxy from "express-http-proxy"

const SERVICE_READY_TTL_MS = 10 * 60 * 1000
const SERVICE_WAKE_ATTEMPTS = 6
const SERVICE_WAKE_DELAY_MS = 3000
const SERVICE_WAKE_TIMEOUT_MS = 15000
const serviceStateByUrl = new Map()

const delay = (milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
})

const getServiceState = (serviceUrl) => {
    if (!serviceUrl) {
        throw new Error("service URL is not configured")
    }

    if (!serviceStateByUrl.has(serviceUrl)) {
        serviceStateByUrl.set(serviceUrl, {
            readyUntil: 0,
            wakePromise: undefined
        })
    }

    return serviceStateByUrl.get(serviceUrl)
}

export const waitForService = async (serviceUrl) => {
    const state = getServiceState(serviceUrl)

    if (Date.now() < state.readyUntil) {
        return
    }

    if (!state.wakePromise) {
        state.wakePromise = (async () => {
            let lastError

            for (let attempt = 1; attempt <= SERVICE_WAKE_ATTEMPTS; attempt += 1) {
                try {
                    const response = await fetch(serviceUrl, {
                        signal: AbortSignal.timeout(SERVICE_WAKE_TIMEOUT_MS)
                    })

                    if (response.ok) {
                        state.readyUntil = Date.now() + SERVICE_READY_TTL_MS
                        return
                    }

                    lastError = new Error(`health check returned ${response.status}`)
                } catch (error) {
                    lastError = error
                }

                if (attempt < SERVICE_WAKE_ATTEMPTS) {
                    await delay(SERVICE_WAKE_DELAY_MS)
                }
            }

            throw lastError || new Error("service did not become ready")
        })().finally(() => {
            state.wakePromise = undefined
        })
    }

    await state.wakePromise
}

export const warmServices = (serviceUrls = []) => Promise.allSettled(
    [...new Set(serviceUrls.filter(Boolean))].map((serviceUrl) => waitForService(serviceUrl))
)

export const proxyWithHeader = (serviceUrl) => {

    const serviceProxy = proxy(serviceUrl, {
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            if (process.env.INTERNAL_SERVICE_TOKEN) {
                proxyReqOpts.headers["x-internal-service-token"] = process.env.INTERNAL_SERVICE_TOKEN
            }
            if (srcReq.user) {
                proxyReqOpts.headers["x-user-id"] = srcReq.user.userId
            }
            return proxyReqOpts
        }
    })

    return async (req, res, next) => {
        try {
            await waitForService(serviceUrl)
            return serviceProxy(req, res, next)
        } catch (error) {
            console.error(`service unavailable ${serviceUrl}`, error.message)
            res.set("Retry-After", "5")
            return res.status(503).json({
                code: "SERVICE_STARTING",
                message: "The requested service is still starting. Please try again shortly."
            })
        }
    }
}
