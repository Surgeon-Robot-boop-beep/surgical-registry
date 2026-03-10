import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.jsx"

if (!window.storage) {
  window.storage = {
    get: async (key) => {
      const value = localStorage.getItem(key)
      if (value === null) throw new Error("Key not found")
      return { key, value }
    },
    set: async (key, value) => {
      localStorage.setItem(key, value)
      return { key, value }
    },
    delete: async (key) => {
      localStorage.removeItem(key)
      return { key, deleted: true }
    },
    list: async (prefix) => {
      const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix))
      return { keys }
    }
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
)