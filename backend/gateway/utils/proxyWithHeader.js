import proxy from "express-http-proxy"

export const proxyWithHeader = (serviceUrl) => {
    return proxy(serviceUrl, {
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
}
