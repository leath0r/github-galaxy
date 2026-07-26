import { create } from 'zustand'
import type { Repo } from './github'

interface GalaxyState {
  repos: Repo[]
  selected: Repo | null
  hovered: number | null
  query: string
  loading: boolean
  error: string | null
  favorites: Record<number, Repo>
  showSettings: boolean

  setRepos: (r: Repo[]) => void
  select: (r: Repo | null) => void
  hover: (id: number | null) => void
  setQuery: (q: string) => void
  setLoading: (b: boolean) => void
  setError: (e: string | null) => void
  toggleFavorite: (r: Repo) => void
  setShowSettings: (b: boolean) => void
}

const loadFavs = (): Record<number, Repo> => {
  try {
    return JSON.parse(localStorage.getItem('gg_favs') || '{}')
  } catch {
    return {}
  }
}

export const useGalaxy = create<GalaxyState>((set, get) => ({
  repos: [],
  selected: null,
  hovered: null,
  query: '',
  loading: false,
  error: null,
  favorites: loadFavs(),
  showSettings: false,

  setRepos: (repos) => set({ repos }),
  select: (selected) => set({ selected }),
  hover: (hovered) => set({ hovered }),
  setQuery: (query) => set({ query }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setShowSettings: (showSettings) => set({ showSettings }),
  toggleFavorite: (r) => {
    const favs = { ...get().favorites }
    if (favs[r.id]) delete favs[r.id]
    else favs[r.id] = r
    localStorage.setItem('gg_favs', JSON.stringify(favs))
    set({ favorites: favs })
  },
}))
