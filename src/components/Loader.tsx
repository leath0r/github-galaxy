import { AnimatePresence, motion } from 'framer-motion'

export default function Loader({ show, first }: { show: boolean; first: boolean }) {
  return (
    <AnimatePresence>
      {show && first && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05060f]"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="relative h-24 w-24"
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 blur-xl opacity-60" />
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-indigo-300 to-violet-600" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-2xl font-semibold tracking-tight text-white"
          >
            GitHub Galaxy
          </motion.h1>
          <p className="mt-2 text-sm text-white/50">Assembling the universe…</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
