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
  updated_at: string
  pushed_at: string
  default_branch: string
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
