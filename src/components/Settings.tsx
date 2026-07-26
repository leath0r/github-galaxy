import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGalaxy } from '../lib/store'
import { getToken, setToken } from '../lib/github'

export default function Settings() {
  const show = useGalaxy((s) => s.showSettings)
  const setShow = useGalaxy((s) => s.setShowSettings)
  const [val, setVal] = useState(getToken())

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShow(false)}
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.94, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-[min(440px,92vw)] rounded-3xl p-6"
          >
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/60">
              Unauthenticated GitHub search is limited to ~10 requests/min. Paste a personal
              access token (no scopes needed) to raise the limit to 30/min. Stored only in your
              browser.
            </p>
            <input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              type="password"
              placeholder="ghp_…"
              className="glass-soft mt-4 w-full rounded-xl px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/30"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setToken(val.trim())
                  setShow(false)
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110"
              >
                Save
              </button>
              <a
                href="https://github.com/settings/tokens/new?description=GitHub%20Galaxy"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-white/10 px-4 py-2.5 text-[14px] font-medium text-white/80 transition hover:bg-white/16"
              >
                Get token
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
