import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useGalaxy } from '../lib/store'

interface Props {
  onSearch: (q: string) => void
}

const SUGGESTIONS = [
  'language:rust',
  'topic:llm',
  'stars:>50000',
  'topic:kubernetes',
  'language:go cli',
  'topic:self-hosted',
]

export default function SearchBar({ onSearch }: Props) {
  const query = useGalaxy((s) => s.query)
  const setQuery = useGalaxy((s) => s.setQuery)
  const loading = useGalaxy((s) => s.loading)
  const [focus, setFocus] = useState(false)
  const [val, setVal] = useState(query)
  const t = useRef<number>()

  // debounced instant search
  useEffect(() => {
    window.clearTimeout(t.current)
    t.current = window.setTimeout(() => {
      if (val.trim() && val !== query) onSearch(val)
    }, 550)
    return () => window.clearTimeout(t.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [val])

  return (
    <motion.div
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 18 }}
      className="pointer-events-auto fixed left-1/2 top-6 z-30 w-[min(680px,92vw)] -translate-x-1/2"
    >
      <div
        className={`glass flex items-center gap-3 rounded-full px-5 py-3 transition-all ${
          focus ? 'ring-2 ring-indigo-400/50' : ''
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 opacity-70">
          <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
          <path d="m20 20-3-3" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch(val)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          placeholder="Search the galaxy — repos, language:rust, topic:llm, stars:>10000…"
          className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
        />
        {loading && (
          <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
      </div>

      {focus && !val && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-soft mt-2 flex flex-wrap gap-2 rounded-2xl p-3"
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onMouseDown={() => {
                setVal(s)
                onSearch(s)
              }}
              className="rounded-full bg-white/8 px-3 py-1.5 text-[13px] text-white/80 transition hover:bg-white/16"
            >
              {s}
            </button>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
