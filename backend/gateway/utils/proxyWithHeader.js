import proxy from "express-http-proxy"

const SERVICE_READY_TTL_MS = 10 * 60 * 1000
const SERVICE_WAKE_ATTEMPTS = 6
const SERVICE_WAKE_DELAY_MS = 3000
const SERVICE_WAKE_TIMEOUT_MS = 15000

const delay = (milliseconds) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
})

export const proxyWithHeader = (serviceUrl) => {
    let readyUntil = 0
    let wakePromise

    const waitForService = async () => {
        if (Date.now() < readyUntil) {
            return
        }

        if (!wakePromise) {
            wakePromise = (async () => {
                let lastError

                for (let attempt = 1; attempt <= SERVICE_WAKE_ATTEMPTS; attempt += 1) {
                    try {
                        const response = await fetch(serviceUrl, {
                            signal: AbortSignal.timeout(SERVICE_WAKE_TIMEOUT_MS)
                        })

                        if (response.ok) {
                            readyUntil = Date.now() + SERVICE_READY_TTL_MS
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
                wakePromise = undefined
            })
        }

        await wakePromise
    }

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
            await waitForService()
            return serviceProxy(req, res, next)
        } catch (error) {
            console.error(`service unavailable ${serviceUrl}`, error.message)
            return res.status(503).json({
                message: "The requested service is still starting. Please try again shortly."
            })
        }
    }
}
