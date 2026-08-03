const getRenderServiceUrl = (serviceName) => {
  const suffix = ".onrender.com"
  if (!window.location.hostname.endsWith(suffix)) return ""

  const frontendServiceName = window.location.hostname.slice(0, -suffix.length)
  return `https://${frontendServiceName}-${serviceName}${suffix}`
}

const SERVICE_URLS = {
  agent: import.meta.env.VITE_AGENT_SERVICE_URL || getRenderServiceUrl("agent"),
  auth: import.meta.env.VITE_AUTH_SERVICE_URL || getRenderServiceUrl("auth"),
  billing: import.meta.env.VITE_BILLING_SERVICE_URL || getRenderServiceUrl("billing"),
  chat: import.meta.env.VITE_CHAT_SERVICE_URL || getRenderServiceUrl("chat"),
}

const REQUEST_SERVICE = {
  "/api/agent": "agent",
  "/api/auth": "auth",
  "/api/billing": "billing",
  "/api/chat": "chat",
}

const WARMUP_ATTEMPTS = 4
const WARMUP_RETRY_DELAYS_MS = [0, 1500, 4000, 8000]
const WARMUP_TIMEOUT_MS = 75_000
const SERVICE_READY_TTL_MS = 10 * 60 * 1000
const readyUntilByService = new Map()
const warmupPromises = new Map()

const delay = (milliseconds) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds)
})

const requestServiceHealth = async (serviceUrl) => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS)

  try {
    await fetch(`${serviceUrl.replace(/\/$/, "")}/`, {
      cache: "no-store",
      mode: "no-cors",
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeout)
  }
}

const startService = async (serviceName) => {
  const serviceUrl = SERVICE_URLS[serviceName]
  if (!serviceUrl) return

  let lastError

  for (let attempt = 0; attempt < WARMUP_ATTEMPTS; attempt += 1) {
    await delay(WARMUP_RETRY_DELAYS_MS[attempt])

    try {
      await requestServiceHealth(serviceUrl)
      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error(`${serviceName} service did not become ready`)
}

export const warmService = (serviceName) => {
  if (!SERVICE_URLS[serviceName]) return Promise.resolve()
  if ((readyUntilByService.get(serviceName) || 0) > Date.now()) return Promise.resolve()

  if (!warmupPromises.has(serviceName)) {
    const warmupPromise = startService(serviceName)
      .then(() => {
        readyUntilByService.set(serviceName, Date.now() + SERVICE_READY_TTL_MS)
        warmupPromises.delete(serviceName)
      })
      .catch((error) => {
        warmupPromises.delete(serviceName)
        throw error
      })
    warmupPromises.set(serviceName, warmupPromise)
  }

  return warmupPromises.get(serviceName)
}

export const warmAllServices = () => Promise.allSettled(
  Object.keys(SERVICE_URLS).map((serviceName) => warmService(serviceName)),
)

export const warmServiceForRequest = async (requestUrl = "") => {
  const matchingPrefix = Object.keys(REQUEST_SERVICE)
    .find((prefix) => requestUrl.startsWith(prefix))

  if (matchingPrefix) {
    await warmService(REQUEST_SERVICE[matchingPrefix])
  }
}
