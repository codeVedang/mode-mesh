import { AnimatePresence, motion } from "motion/react"
import { useSelector } from "react-redux"
import { TbCrown, TbX } from "react-icons/tb"
import { createOrder } from "../features/createOrder"
import { verifyPayment } from "../features/verifyPayment"

const plans = [
  { credits: 500, id: "starter", name: "Starter", price: 199 },
  { credits: 1000, id: "pro", name: "Pro", price: 499 },
]

function BillingDrawer({ open, onClose }) {
  const { userData } = useSelector((state) => state.user)

  const handleUpgrade = async (plan) => {
    try {
      const data = await createOrder(plan)
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data?.order?.amount,
        currency: data?.order?.currency,
        name: "ModeMesh AI",
        description: `${data?.plan?.name} Plan`,
        order_id: data?.order?.id,
        handler: async (response) => {
          try {
            await verifyPayment(response)
          } catch (error) {
            console.error(error)
          }
        },
        theme: { color: "#1238e5" },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (error) {
      console.error(error)
    }
  }

  const creditPercent = Math.min(
    100,
    ((userData?.credits || 0) / (userData?.totalCredits || 1)) * 100,
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close billing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="billing-scrim"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.24 }}
            className="billing-drawer"
          >
            <header className="billing-header">
              <div>
                <span>ACCOUNT / CREDITS</span>
                <h2>Plans &amp; billing</h2>
              </div>
              <button type="button" onClick={onClose} aria-label="Close billing">
                <TbX aria-hidden="true" />
              </button>
            </header>

            <section className="current-plan">
              <div>
                <span>Current plan</span>
                <strong>{userData?.plan || "free"}</strong>
              </div>
              <TbCrown aria-hidden="true" />
              <div className="credit-progress-copy">
                <span>Credits available</span>
                <strong>{userData?.credits || 0} / {userData?.totalCredits || 100}</strong>
              </div>
              <div className="credit-progress">
                <span style={{ width: `${creditPercent}%` }} />
              </div>
            </section>

            <div className="billing-plan-list">
              {plans.map((plan) => (
                <section key={plan.id} className="billing-plan">
                  <div className="billing-plan-index">0{plans.indexOf(plan) + 1}</div>
                  <div>
                    <h3>{plan.name}</h3>
                    <p>{plan.credits} credits</p>
                  </div>
                  <strong>₹{plan.price}</strong>
                  <button type="button" onClick={() => handleUpgrade(plan.id)}>Choose plan</button>
                </section>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export default BillingDrawer
