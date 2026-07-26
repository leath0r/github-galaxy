import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useGalaxy } from '../lib/store'
import { getReadme, getContributors, getLanguages, langColor } from '../lib/github'

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k'
  return String(n)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/6 px-3 py-2">
      <span className="text-[15px] font-semibold text-white">{value}</span>
      <span className="text-[11px] uppercase tracking-wide text-white/50">{label}</span>
    </div>
  )
}

export default function InfoPanel() {
  const repo = useGalaxy((s) => s.selected)
  const select = useGalaxy((s) => s.select)
  const favorites = useGalaxy((s) => s.favorites)
  const toggleFavorite = useGalaxy((s) => s.toggleFavorite)

  const { data: readme } = useQuery({
    queryKey: ['readme', repo?.full_name],
    queryFn: () => getReadme(repo!.full_name, repo!.default_branch),
    enabled: !!repo,
  })
  const { data: contributors } = useQuery({
    queryKey: ['contrib', repo?.full_name],
    queryFn: () => getContributors(repo!.full_name),
    enabled: !!repo,
  })
  const { data: languages } = useQuery({
    queryKey: ['langs', repo?.full_name],
    queryFn: () => getLanguages(repo!.full_name),
    enabled: !!repo,
  })

  const fav = repo ? !!favorites[repo.id] : false

  return (
    <AnimatePresence>
      {repo && (
        <motion.div
          key={repo.id}
          initial={{ x: 60, opacity: 0, scale: 0.96 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: 60, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
          className="glass pointer-events-auto fixed right-5 top-1/2 z-40 max-h-[86vh] w-[min(400px,92vw)] -translate-y-1/2 overflow-y-auto rounded-[28px] p-6 thin-scroll"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={repo.owner.avatar_url}
                alt=""
                className="h-11 w-11 rounded-full ring-2 ring-white/20"
              />
              <div>
                <div className="text-[12px] text-white/50">{repo.owner.login}</div>
                <div className="text-[19px] font-semibold leading-tight text-white">
                  {repo.name}
                </div>
              </div>
            </div>
            <button
              onClick={() => select(null)}
              className="rounded-full bg-white/8 p-2 text-white/70 transition hover:bg-white/16"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {repo.description && (
            <p className="mt-4 text-[14px] leading-relaxed text-white/80">{repo.description}</p>
          )}

          {repo.topics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {repo.topics.slice(0, 8).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-indigo-400/15 px-2.5 py-1 text-[11px] font-medium text-indigo-200"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label="Stars" value={fmt(repo.stargazers_count)} />
            <Stat label="Forks" value={fmt(repo.forks_count)} />
            <Stat label="Watchers" value={fmt(repo.watchers_count)} />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/60">
            {repo.language && (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: langColor(repo.language) }}
                />
                {repo.language}
              </span>
            )}
            {repo.license && <span>⚖ {repo.license.spdx_id}</span>}
            <span>↻ {new Date(repo.pushed_at).toLocaleDateString()}</span>
          </div>

          {languages && languages.length > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-white/40">Languages</div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full">
                {languages.map(([name, frac]) => (
                  <div
                    key={name}
                    title={`${name} ${(frac * 100).toFixed(0)}%`}
                    style={{ width: `${frac * 100}%`, background: langColor(name) }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/55">
                {languages.map(([name, frac]) => (
                  <span key={name} className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: langColor(name) }} />
                    {name} {(frac * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {readme && (
            <div className="mt-5">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-white/40">Readme</div>
              <p className="max-h-40 overflow-y-auto whitespace-pre-line rounded-2xl bg-black/20 p-3 text-[12.5px] leading-relaxed text-white/70 thin-scroll">
                {readme}
              </p>
            </div>
          )}

          {contributors && contributors.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-white/40">
                Contributors
              </div>
              <div className="flex -space-x-2">
                {contributors.map((c) => (
                  <a key={c.login} href={c.html_url} target="_blank" rel="noreferrer" title={c.login}>
                    <img
                      src={c.avatar_url}
                      alt={c.login}
                      className="h-8 w-8 rounded-full ring-2 ring-[#0b1030] transition hover:z-10 hover:scale-110"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-3 text-[14px] font-semibold text-white shadow-lg transition hover:brightness-110"
            >
              Open on GitHub
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M7 17 17 7M17 7H9M17 7v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <button
              onClick={() => toggleFavorite(repo)}
              className={`rounded-2xl px-4 py-3 text-[14px] font-semibold transition ${
                fav ? 'bg-amber-400/90 text-black' : 'bg-white/10 text-white hover:bg-white/18'
              }`}
              title="Bookmark"
            >
              {fav ? '★' : '☆'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
