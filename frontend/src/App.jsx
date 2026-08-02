import { useEffect } from "react"
import { useDispatch } from "react-redux"
import Home from "./pages/Home"
import getCurrentUser from "./features/getCurrentUser"
import { setUserdata } from "./redux/userSlice"

function App() {
  const dispatch = useDispatch()
  const designPreview = import.meta.env.DEV
    && new URLSearchParams(window.location.search).has("design-preview")

  useEffect(() => {
    const getUser = async () => {
      if (designPreview) {
        dispatch(setUserdata({
          _id: "design-preview",
          avatar: "",
          credits: 12450,
          name: "Alex Morgan",
          plan: "pro",
          totalCredits: 20000,
        }))
        return
      }

      const data = await getCurrentUser()
      dispatch(setUserdata(data))
    }

    getUser()
  }, [designPreview, dispatch])

  return (
    <Home designPreview={designPreview} />
  )
}

export default App
