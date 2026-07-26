# GitHub Galaxy 🪐

Explore the open-source universe as a living 3D galaxy. Every GitHub repository
is a glowing planet — search, hover to see connections, click to fly in.

Built with **Vite · React · TypeScript · React Three Fiber · drei · postprocessing ·
Tailwind v4 · Zustand · TanStack Query · Framer Motion**. Fully client-side —
talks to the GitHub REST API directly, deploys as static files to GitHub Pages.

## Dev

```bash
npm install
npm run dev
```

## Build & deploy (GitHub Pages)

```bash
npm run build      # -> dist/
npm run deploy     # pushes dist/ to the gh-pages branch
```

`vite.config.ts` sets `base: '/github-galaxy/'` — change it if the repo name changes.

## Notes / roadmap

- Unauthenticated GitHub search is limited to ~10 req/min; add a token in Settings
  to raise it. Nothing leaves the browser.
- Planned: semantic "AI" search, per-category galaxies with distinct layouts,
  Recently Viewed, Collections, shareable deep links, LOD/instancing for very
  large result sets, light mode.
