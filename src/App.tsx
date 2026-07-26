import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Galaxy from './components/Galaxy'
import SearchBar from './components/SearchBar'
import InfoPanel from './components/InfoPanel'
import Loader from './components/Loader'
import Settings from './components/Settings'
import { useGalaxy } from './lib/store'
import { searchRepos, trending, CATEGORIES } from './lib/github'

export default function App() {
  const setRepos = useGalaxy((s) => s.setRepos)
  const setLoading = useGalaxy((s) => s.setLoading)
  const setError = useGalaxy((s) => s.setError)
  const setQuery = useGalaxy((s) => s.setQuery)
  const loading = useGalaxy((s) => s.loading)
  const error = useGalaxy((s) => s.error)
  const repos = useGalaxy((s) => s.repos)
  const setShowSettings = useGalaxy((s) => s.setShowSettings)
  const [first, setFirst] = useState(true)

  const run = useCallback(
    async (q: string, fn?: () => Promise<any>) => {
      setLoading(true)
      setError(null)
      setQuery(q)
      try {
        const items = fn ? await fn() : await searchRepos(q)
        setRepos(items)
      } catch (e: any) {
        setError(e?.message || 'Something went wrong')
      } finally {
        setLoading(false)
        setFirst(false)
      }
    },
    [setLoading, setError, setQuery, setRepos],
  )

  const onSearch = useCallback((q: string) => run(q), [run])
  const onSurprise = useCallback(() => {
    const c = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
    run(c.query)
  }, [run])

  useEffect(() => {
    run('Trending', () => trending())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-full w-full">
      <Galaxy />

      {/* overlays are pointer-events-none container; children opt-in */}
      <div className="pointer-events-none">
        <SearchBar onSearch={onSearch} />

        {/* top-right controls */}
        <div className="pointer-events-auto fixed right-5 top-6 z-30 flex gap-2">
          <button
            onClick={onSurprise}
            className="glass-soft flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium text-white/85 transition hover:text-white"
            title="Jump to a random galaxy"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4h4l12 16h-4M20 4h-4L4 20h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M16 4h4v4M16 20h4v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Surprise
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="glass-soft rounded-full p-2.5 text-white/80 transition hover:text-white"
            aria-label="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              <path
                d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5-1.4 1.4M7.9 16.1l-1.4 1.4m0-11.4 1.4 1.4m8.2 8.2 1.4 1.4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <InfoPanel />
        <Settings />
      </div>

      {/* result count badge */}
      {!first && repos.length > 0 && (
        <div className="glass-soft pointer-events-none fixed left-5 top-6 z-20 rounded-full px-4 py-2 text-[13px] text-white/70">
          {repos.length} repositories
        </div>
      )}

      {/* error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="glass pointer-events-auto fixed bottom-24 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 rounded-2xl px-5 py-3 text-[13px] text-white/90"
            onClick={() => setError(null)}
          >
            ⚠ {error}
          </motion.div>
        )}
      </AnimatePresence>

      <Loader show={loading} first={first} />
    </div>
  )
}
