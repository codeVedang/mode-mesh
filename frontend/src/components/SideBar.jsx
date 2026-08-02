import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import {
  TbArrowBackUp,
  TbCoins,
  TbHistory,
  TbLayersIntersect,
  TbLogout,
  TbMenu2,
  TbMessage,
  TbMicrophone,
  TbPlus,
  TbUser,
  TbWriting,
  TbX,
} from "react-icons/tb"
import { getConversations } from "../features/getConversations"
import logOut from "../features/logOut"
import { setConversations, setSelectedConversation } from "../redux/conversationSlice"
import { setMessages } from "../redux/messageSlice"
import { setUserdata } from "../redux/userSlice"
import BillingDrawer from "./BillingDrawer"

function SideBar({ mode, onModeChange, onModeHub }) {
  const dispatch = useDispatch()
  const { conversations, selectedConversation } = useSelector((state) => state.conversation)
  const { userData } = useSelector((state) => state.user)
  const [imageError, setImageError] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showBilling, setShowBilling] = useState(false)

  useEffect(() => {
    const loadConversations = async () => {
      const data = await getConversations()
      dispatch(setConversations(data || []))
    }

    if (userData?._id) {
      loadConversations()
    }
  }, [dispatch, userData?._id])

  const newSession = () => {
    dispatch(setSelectedConversation(null))
    dispatch(setMessages([]))
    setMobileOpen(false)
  }

  const chooseConversation = (conversation) => {
    dispatch(setSelectedConversation(conversation))
    setMobileOpen(false)
  }

  const handleLogout = async () => {
    await logOut()
    dispatch(setUserdata(null))
  }

  return (
    <>
      <button type="button" className="workspace-mobile-menu" onClick={() => setMobileOpen(true)}>
        <TbMenu2 aria-hidden="true" />
        <span>Menu</span>
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="workspace-sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`workspace-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <header className="sidebar-brand-row">
          <button type="button" className="sidebar-brand" onClick={onModeHub}>
            <TbLayersIntersect aria-hidden="true" />
            <span>ModeMesh AI</span>
          </button>
          <button type="button" className="sidebar-close" onClick={() => setMobileOpen(false)}>
            <TbX aria-hidden="true" />
          </button>
        </header>

        <button type="button" className="mode-hub-button" onClick={onModeHub}>
          <TbArrowBackUp aria-hidden="true" />
          Choose voice or text
        </button>

        <div className="workspace-mode-switch" aria-label="Workspace mode">
          <button
            type="button"
            className={mode === "voice" ? "active" : ""}
            onClick={() => onModeChange("voice")}
          >
            <TbMicrophone aria-hidden="true" />
            Voice
          </button>
          <button
            type="button"
            className={mode === "text" ? "active" : ""}
            onClick={() => onModeChange("text")}
          >
            <TbWriting aria-hidden="true" />
            Text
          </button>
        </div>

        <button type="button" className="sidebar-new-session" onClick={newSession}>
          <TbPlus aria-hidden="true" />
          New session
        </button>

        <div className="sidebar-section-label">
          <TbHistory aria-hidden="true" />
          Recent
        </div>

        <div className="sidebar-conversations">
          {conversations.length === 0 ? (
            <p className="sidebar-empty">Your first conversation will appear here.</p>
          ) : (
            conversations.map((conversation) => {
              const active = selectedConversation?._id === conversation?._id
              return (
                <button
                  type="button"
                  key={conversation?._id}
                  className={`conversation-row ${active ? "active" : ""}`}
                  onClick={() => chooseConversation(conversation)}
                >
                  <TbMessage aria-hidden="true" />
                  <span>{conversation?.title || "New conversation"}</span>
                </button>
              )
            })
          )}
        </div>

        <footer className="sidebar-account">
          <button type="button" className="sidebar-profile" onClick={() => setShowBilling(true)}>
            <span className="sidebar-avatar">
              {userData?.avatar && !imageError ? (
                <img
                  src={userData.avatar}
                  alt={userData?.name || "Profile"}
                  onError={() => setImageError(true)}
                />
              ) : (
                <TbUser aria-hidden="true" />
              )}
            </span>
            <span className="sidebar-profile-copy">
              <strong>{userData?.name || "Cortex user"}</strong>
              <small>{userData?.plan || "free"} plan</small>
            </span>
            <TbCoins aria-hidden="true" />
          </button>
          <button type="button" className="sidebar-logout" onClick={handleLogout} aria-label="Log out">
            <TbLogout aria-hidden="true" />
          </button>
        </footer>
      </aside>

      <BillingDrawer open={showBilling} onClose={() => setShowBilling(false)} />
    </>
  )
}

export default SideBar
