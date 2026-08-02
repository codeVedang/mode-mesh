const HEALTH_CHECK_PATH = "/"

const requireInternalService = (req, res, next) => {
    if (req.method === "GET" && req.path === HEALTH_CHECK_PATH) {
        return next()
    }

    const expectedToken = process.env.INTERNAL_SERVICE_TOKEN

    if (!expectedToken && process.env.NODE_ENV !== "production") {
        return next()
    }

    if (!expectedToken) {
        return res.status(500).json({message:"Internal service authentication is not configured"})
    }

    if (req.get("x-internal-service-token") !== expectedToken) {
        return res.status(403).json({message:"Forbidden"})
    }

    return next()
}

export default requireInternalService
