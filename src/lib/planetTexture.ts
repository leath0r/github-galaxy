import * as THREE from 'three'
import type { Repo } from './github'
import { langColor } from './github'

// Procedural planet surfaces: each repo becomes a unique world, styled by its
// language family. Cached per repo id so we only paint each canvas once.

export type Surface = 'oceanic' | 'metallic' | 'gasgiant' | 'rocky' | 'crystalline' | 'generic'

export interface PlanetSkin {
  texture: THREE.CanvasTexture
  metalness: number
  roughness: number
  emissiveIntensity: number
}

const cache = new Map<number, PlanetSkin>()

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function surfaceOf(lang: string | null): Surface {
  switch (lang) {
    case 'Python':
      return 'oceanic'
    case 'Rust':
    case 'Swift':
    case 'Zig':
      return 'metallic'
    case 'Go':
    case 'Java':
    case 'Kotlin':
      return 'gasgiant'
    case 'C':
    case 'C++':
    case 'Shell':
      return 'rocky'
    case 'TypeScript':
    case 'JavaScript':
    case 'Vue':
    case 'HTML':
    case 'CSS':
      return 'crystalline'
    default:
      return lang ? 'generic' : 'rocky'
  }
}

const W = 256
const H = 128

function shade(hex: string, amt: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)))
  return `#${c.getHexString()}`
}
function hueShift(hex: string, deg: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL((hsl.h + deg / 360 + 1) % 1, hsl.s, hsl.l)
  return `#${c.getHexString()}`
}

export function planetSkin(repo: Repo): PlanetSkin {
  const cached = cache.get(repo.id)
  if (cached) return cached

  const rnd = mulberry32(repo.id || repo.full_name.length)
  const surface = surfaceOf(repo.language)
  const base = hueShift(langColor(repo.language), (rnd() - 0.5) * 24)

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  let metalness = 0.4
  let roughness = 0.6
  let emissiveIntensity = 0.35

  if (surface === 'oceanic') {
    ctx.fillStyle = shade(base, -0.15)
    ctx.fillRect(0, 0, W, H)
    // continents
    const n = 6 + Math.floor(rnd() * 6)
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? '#3f7d4f' : '#8d7b5a'
      ctx.globalAlpha = 0.8
      const x = rnd() * W
      const y = 20 + rnd() * (H - 40)
      blob(ctx, x, y, 14 + rnd() * 26, rnd)
    }
    ctx.globalAlpha = 1
    // ice caps
    ctx.fillStyle = 'rgba(235,246,255,0.9)'
    ctx.fillRect(0, 0, W, 8 + rnd() * 6)
    ctx.fillRect(0, H - (8 + rnd() * 6), W, 12)
    metalness = 0.25
    roughness = 0.55
  } else if (surface === 'metallic') {
    ctx.fillStyle = base
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = rnd() > 0.5 ? shade(base, 0.18) : shade(base, -0.18)
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1 + rnd() * 2
      ctx.beginPath()
      const y = rnd() * H
      ctx.moveTo(0, y)
      ctx.lineTo(W, y + (rnd() - 0.5) * 20)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    metalness = 0.95
    roughness = 0.22
  } else if (surface === 'gasgiant') {
    const bands = 10 + Math.floor(rnd() * 8)
    for (let i = 0; i < bands; i++) {
      const y = (i / bands) * H
      ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.32)
      ctx.fillRect(0, y, W, H / bands + 1)
    }
    // a storm spot
    ctx.fillStyle = shade(base, 0.28)
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.ellipse(rnd() * W, H * (0.3 + rnd() * 0.4), 16, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    metalness = 0.3
    roughness = 0.5
  } else if (surface === 'rocky') {
    ctx.fillStyle = shade(base, -0.05)
    ctx.fillRect(0, 0, W, H)
    // speckle noise
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
      ctx.fillRect(rnd() * W, rnd() * H, 2, 2)
    }
    // craters
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W
      const y = rnd() * H
      const r = 3 + rnd() * 8
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    metalness = 0.15
    roughness = 0.9
  } else if (surface === 'crystalline') {
    ctx.fillStyle = shade(base, -0.1)
    ctx.fillRect(0, 0, W, H)
    // faceted shards
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = shade(base, (rnd() - 0.3) * 0.5)
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      const x = rnd() * W
      const y = rnd() * H
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40)
      ctx.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1
    metalness = 0.6
    roughness = 0.15
    emissiveIntensity = 0.7
  } else {
    // generic: base + soft mottling
    ctx.fillStyle = base
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.3)
      ctx.globalAlpha = 0.5
      blob(ctx, rnd() * W, rnd() * H, 8 + rnd() * 18, rnd)
    }
    ctx.globalAlpha = 1
  }

  const texture = new THREE.CanvasTexture(c)
  texture.colorSpace = THREE.SRGBColorSpace
  const skin: PlanetSkin = { texture, metalness, roughness, emissiveIntensity }
  cache.set(repo.id, skin)
  return skin
}

function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rnd: () => number) {
  ctx.beginPath()
  const pts = 8
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2
    const rr = r * (0.6 + rnd() * 0.6)
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr * 0.7
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}
