import { motion } from 'framer-motion'
import { CATEGORIES } from '../lib/github'

interface Props {
  onPick: (query: string) => void
  onSurprise: () => void
}

export default function Explore({ onPick, onSurprise }: Props) {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.35, type: 'spring', stiffness: 120, damping: 20 }}
      className="pointer-events-auto fixed bottom-5 left-1/2 z-30 -translate-x-1/2"
    >
      <div className="glass flex max-w-[94vw] items-center gap-2 overflow-x-auto rounded-full px-3 py-2 thin-scroll">
        <button
          onClick={onSurprise}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg transition hover:brightness-110"
        >
          ✨ Surprise me
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.label}
            onClick={() => onPick(c.query)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-3.5 py-2 text-[13px] font-medium text-white/85 transition hover:bg-white/16"
          >
            <span>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>
    </motion.div>
  )
}
