// Lightweight GitHub REST client (client-side, no backend).
// Unauthenticated search is limited to ~10 req/min. Users can paste a
// personal access token (stored locally) to raise limits.

export interface Repo {
  id: number
  name: string
  full_name: string
  owner: { login: string; avatar_url: string }
  html_url: string
  description: string | null
  language: string | null
  topics: string[]
  stargazers_count: number
  forks_count: number
  watchers_count: number
  open_issues_count: number
  license: { spdx_id: string; name: string } | null
  created_at: string
  updated_at: string
  pushed_at: string
  default_branch: string
  archived?: boolean
  fork?: boolean
}

const TOKEN_KEY = 'gg_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''
export const setToken = (t: string) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' }
  const t = getToken()
  if (t) h.Authorization = `Bearer ${t}`
  return h
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, { headers: headers() })
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset')
    const wait = reset ? Math.max(0, +reset * 1000 - Date.now()) : 0
    throw new Error(
      `GitHub rate limit hit${wait ? ` — try again in ~${Math.ceil(wait / 1000)}s` : ''}. Add a token in settings to raise the limit.`,
    )
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function searchRepos(q: string, sort = 'stars', per = 80): Promise<Repo[]> {
  const query = q.trim() || 'stars:>10000'
  const data = await gh<{ items: Repo[] }>(
    `/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=${per}`,
  )
  return data.items.map((r) => ({ ...r, topics: r.topics ?? [] }))
}

export async function trending(days = 14, per = 80): Promise<Repo[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
  return searchRepos(`created:>${since} stars:>100`, 'stars', per)
}

export async function getReadme(full: string, branch: string): Promise<string> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${full}/${branch}/README.md`,
    )
    if (!res.ok) return ''
    const text = await res.text()
    // strip images/badges + html + markdown noise for a clean preview
    return text
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/^#+\s?/gm, '')
      .replace(/[*`_>|-]{1,}/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim()
      .slice(0, 900)
  } catch {
    return ''
  }
}

export async function getContributors(full: string): Promise<
  { login: string; avatar_url: string; html_url: string }[]
> {
  try {
    return await gh(`/repos/${full}/contributors?per_page=8`)
  } catch {
    return []
  }
}

export async function getLanguages(full: string): Promise<[string, number][]> {
  try {
    const data = await gh<Record<string, number>>(`/repos/${full}/languages`)
    const total = Object.values(data).reduce((a, b) => a + b, 0) || 1
    return Object.entries(data)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => [k, v / total] as [string, number])
  } catch {
    return []
  }
}

// Curated explore categories -> GitHub search queries
export const CATEGORIES: { label: string; icon: string; query: string }[] = [
  { label: 'AI & ML', icon: '🧠', query: 'topic:machine-learning stars:>2000' },
  { label: 'UI Libraries', icon: '🎨', query: 'topic:ui stars:>3000' },
  { label: 'Android', icon: '🤖', query: 'topic:android stars:>2000' },
  { label: 'Self-Hosted', icon: '🏠', query: 'topic:self-hosted stars:>2000' },
  { label: 'Cybersecurity', icon: '🛡️', query: 'topic:security stars:>2000' },
  { label: 'Rust', icon: '🦀', query: 'language:rust stars:>5000' },
  { label: 'Go', icon: '🐹', query: 'language:go stars:>5000' },
  { label: 'Python', icon: '🐍', query: 'language:python stars:>10000' },
  { label: 'DevOps', icon: '⚙️', query: 'topic:devops stars:>2000' },
  { label: 'Game Dev', icon: '🎮', query: 'topic:game stars:>3000' },
  { label: 'Kotlin', icon: '🟣', query: 'language:kotlin stars:>2000' },
  { label: 'Swift', icon: '🍎', query: 'language:swift stars:>3000' },
]

// GitHub language colours (subset) — used to tint planets
export const LANG_COLOR: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Dart: '#00B4AB',
  Zig: '#ec915c',
  Lua: '#000080',
}

export const langColor = (lang: string | null) => LANG_COLOR[lang ?? ''] ?? '#8b95ff'

// ---- Planet archetypes: each category looks unique at a glance ----
export type StyleKey =
  | 'ai'
  | 'android'
  | 'rust'
  | 'linux'
  | 'security'
  | 'kotlin'
  | 'swift'
  | 'web'
  | 'go'
  | 'game'
  | 'default'

export interface PlanetStyle {
  color: string
  emissive: string
  emissiveIntensity: number
  metalness: number
  roughness: number
  ring?: boolean // Saturn-like ring
  ringColor?: string
  energy?: boolean // pulsing energy shells
}

export const STYLE: Record<StyleKey, PlanetStyle> = {
  ai: { color: '#b06bff', emissive: '#a855f7', emissiveIntensity: 2.3, metalness: 0.3, roughness: 0.35 },
  android: { color: '#3ddc84', emissive: '#2fbf6f', emissiveIntensity: 1.0, metalness: 0.45, roughness: 0.4, ring: true, ringColor: '#7CFFB0' },
  rust: { color: '#c1743a', emissive: '#5c2c0f', emissiveIntensity: 0.5, metalness: 0.95, roughness: 0.25 },
  linux: { color: '#1e40af', emissive: '#172554', emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.4 },
  security: { color: '#ef4444', emissive: '#ff2020', emissiveIntensity: 2.1, metalness: 0.4, roughness: 0.4, energy: true },
  kotlin: { color: '#A97BFF', emissive: '#f97316', emissiveIntensity: 1.5, metalness: 0.5, roughness: 0.35 },
  swift: { color: '#e5e7eb', emissive: '#9ca3af', emissiveIntensity: 0.6, metalness: 1.0, roughness: 0.15 },
  web: { color: '#22d3ee', emissive: '#06b6d4', emissiveIntensity: 1.5, metalness: 0.55, roughness: 0.22, ring: true, ringColor: '#a5f3fc' },
  go: { color: '#00ADD8', emissive: '#0891b2', emissiveIntensity: 1.3, metalness: 0.5, roughness: 0.3 },
  game: { color: '#f472b6', emissive: '#db2777', emissiveIntensity: 1.6, metalness: 0.5, roughness: 0.3 },
  default: { color: '#8b95ff', emissive: '#6366f1', emissiveIntensity: 1.3, metalness: 0.55, roughness: 0.35 },
}

const AI_KW = ['machine-learning', 'deep-learning', 'ai', 'llm', 'neural', 'gpt', 'artificial-intelligence', 'transformer', 'nlp', 'ml']
const SEC_KW = ['security', 'hacking', 'pentest', 'pentesting', 'cybersecurity', 'infosec', 'exploit', 'malware', 'ctf', 'reverse-engineering']
const WEB_KW = ['react', 'vue', 'frontend', 'web', 'nextjs', 'svelte', 'css', 'tailwind', 'angular', 'webapp']
const GAME_KW = ['game', 'gamedev', 'game-engine', 'gaming']

const hit = (arr: string[], kw: string[]) => arr.some((t) => kw.includes(t))

export function categoryOf(repo: Repo): StyleKey {
  const topics = repo.topics.map((t) => t.toLowerCase())
  const lang = repo.language
  if (hit(topics, SEC_KW)) return 'security'
  if (hit(topics, AI_KW)) return 'ai'
  if (topics.includes('android') || (lang === 'Java' && topics.includes('android'))) return 'android'
  if (lang === 'Rust') return 'rust'
  if (lang === 'Swift') return 'swift'
  if (lang === 'Kotlin') return 'kotlin'
  if (lang === 'Go') return 'go'
  if (hit(topics, GAME_KW)) return 'game'
  if (hit(topics, WEB_KW) || ['JavaScript', 'TypeScript', 'Vue', 'HTML', 'CSS'].includes(lang ?? '')) return 'web'
  if (topics.includes('linux') || topics.includes('kernel') || lang === 'C') return 'linux'
  return 'default'
}
