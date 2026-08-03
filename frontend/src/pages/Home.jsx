import { signInWithPopup } from "firebase/auth"
import { lazy, Suspense, useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { FcGoogle } from "react-icons/fc"
import { TbLayersIntersect, TbWaveSine } from "react-icons/tb"
import { auth, googleProvider } from "../../utils/firebase"
import api from "../../utils/axios"
import { warmAllServices } from "../../utils/serviceWarmup"
import BillingDrawer from "../components/BillingDrawer"
import ModeGateway from "../components/ModeGateway"
import { getConversations } from "../features/getConversations"
import { setConversations, setSelectedConversation } from "../redux/conversationSlice"
import { setUserdata } from "../redux/userSlice"

const Artifact = lazy(() => import("../components/Artifact"))
const ChatArea = lazy(() => import("../components/ChatArea"))
const SideBar = lazy(() => import("../components/SideBar"))
const VoiceRoom = lazy(() => import("../components/VoiceRoom"))

function Home({ designPreview = false }) {
  const dispatch = useDispatch()
  const { userData } = useSelector((state) => state.user)
  const [workspaceMode, setWorkspaceMode] = useState(null)
  const [entryPayload, setEntryPayload] = useState({})
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [showBilling, setShowBilling] = useState(false)

  useEffect(() => {
    void warmAllServices()
  }, [])

  useEffect(() => {
    if (!userData?._id) {
      dispatch(setConversations([]))
      dispatch(setSelectedConversation(null))
      return undefined
    }

    let cancelled = false

    const loadConversations = async () => {
      try {
        const conversations = await getConversations()
        if (!cancelled) dispatch(setConversations(conversations || []))
      } catch (error) {
        console.error("Unable to load recent conversations", error)
      }
    }

    void loadConversations()

    return () => {
      cancelled = true
    }
  }, [dispatch, userData?._id])

  const handleLogin = async (token) => {
    const { data } = await api.post("/api/auth/login", { token })
    dispatch(setUserdata(data))
  }

  const googleLogin = async () => {
    setIsSigningIn(true)
    setLoginError("")
    try {
      const data = await signInWithPopup(auth, googleProvider)
      const token = await data.user.getIdToken()
      await handleLogin(token)
    } catch (error) {
      console.error(error)
      setLoginError(error.response?.status === 503
        ? "ModeMesh services are still starting. Please try signing in again in a moment."
        : "Sign-in could not be completed. Please try again.")
    } finally {
      setIsSigningIn(false)
    }
  }

  const enterWorkspace = (mode, payload = {}) => {
    setEntryPayload(payload)
    setWorkspaceMode(mode)
  }

  const returnToGateway = () => {
    setEntryPayload({})
    setWorkspaceMode(null)
  }

  if (!userData) {
    return (
      <main className="login-stage">
        <section className="login-brand-panel">
          <div className="login-brand">
            <TbLayersIntersect aria-hidden="true" />
            <span>ModeMesh AI</span>
          </div>
          <div>
            <div className="login-eyebrow">MULTI-AGENT INTELLIGENCE</div>
            <h1>Speak it.<br />Write it.<br />Build it.</h1>
          </div>
          <div className="login-signal">
            <TbWaveSine aria-hidden="true" />
            Voice and text, routed to the right specialist.
          </div>
        </section>

        <section className="login-action-panel">
          <div className="login-card">
            <div className="login-card-number">01 / ENTER</div>
            <h2>Your workspace is ready.</h2>
            <p>Sign in once, then choose whether you want to think out loud or work in text.</p>
            <button type="button" onClick={googleLogin} disabled={isSigningIn}>
              <FcGoogle aria-hidden="true" />
              {isSigningIn ? "Starting secure workspace..." : "Continue with Google"}
            </button>
            {loginError && <small className="login-error" role="alert">{loginError}</small>}
            {designPreview && <small>Design preview mode</small>}
          </div>
        </section>
      </main>
    )
  }

  if (!workspaceMode) {
    return (
      <>
        <ModeGateway
          onEnterText={(payload) => enterWorkspace("text", payload)}
          onEnterVoice={(payload) => enterWorkspace("voice", payload)}
          onOpenBilling={() => setShowBilling(true)}
        />
        <BillingDrawer open={showBilling} onClose={() => setShowBilling(false)} />
      </>
    )
  }

  return (
    <Suspense fallback={(
      <main className="workspace-loading">
        <TbWaveSine aria-hidden="true" />
        <span>Loading ModeMesh workspace</span>
      </main>
    )}>
      <div className={`workspace-shell workspace-${workspaceMode}`}>
        {workspaceMode === "voice" ? (
          <VoiceRoom initialPrompt={entryPayload.prompt} onBack={returnToGateway} />
        ) : (
          <>
            <SideBar
              mode={workspaceMode}
              onModeChange={(nextMode) => {
                setEntryPayload({})
                setWorkspaceMode(nextMode)
              }}
              onModeHub={returnToGateway}
            />
            <ChatArea
              initialAgent={entryPayload.agent}
              initialFile={entryPayload.file}
              initialPrompt={entryPayload.prompt}
              onBack={returnToGateway}
            />
            <Artifact />
          </>
        )}
      </div>
    </Suspense>
  )
}

export default Home
