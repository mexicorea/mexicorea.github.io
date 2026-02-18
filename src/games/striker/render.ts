import type { Enemy, GameState } from './types'

interface StarPoint {
  index: number
  period: number
  phase: number
}

interface RenderCache {
  width: number
  height: number
  frame: string[]
  stars: StarPoint[]
}

let renderCache: RenderCache | null = null

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const toGrid = (value: number): number => Math.round(value)

const getHash = (row: number, col: number): number => {
  let hash = (row * 374761393) ^ (col * 668265263)
  hash = (hash ^ (hash >>> 13)) * 1274126177
  return (hash ^ (hash >>> 16)) >>> 0
}

const ensureRenderCache = (width: number, height: number): RenderCache => {
  if (renderCache && renderCache.width === width && renderCache.height === height) {
    return renderCache
  }

  const stars: StarPoint[] = []
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const hash = getHash(row, col)
      const starKind = hash % 173
      if (starKind <= 1) {
        stars.push({
          index: (row * width) + col,
          period: 24 + (hash % 43),
          phase: hash % 97,
        })
      }
    }
  }

  renderCache = {
    width,
    height,
    frame: new Array(width * height).fill(' '),
    stars,
  }

  return renderCache
}

const getEnemySprite = (enemy: Enemy): string => {
  if (enemy.type === 'zigzag') {
    return '{{MMM}}'
  }

  if (enemy.type === 'tracker') {
    return '[[AAA]]'
  }

  return '<<WWW>>'
}

const getTwinkleChar = (tick: number, star: StarPoint): string => {
  const phase = (tick + star.phase) % star.period
  const ratio = phase / star.period

  if (ratio < 0.12) return '.'
  if (ratio < 0.22) return '+'
  if (ratio < 0.3) return '*'
  if (ratio < 0.36) return '-'
  if (ratio < 0.44) return '*'
  if (ratio < 0.54) return '+'
  return '.'
}

const drawChar = (frame: string[], width: number, height: number, x: number, y: number, char: string): void => {
  if (y < 0 || y >= height || x < 0 || x >= width) {
    return
  }

  frame[(y * width) + x] = char
}

const drawSprite = (frame: string[], width: number, height: number, x: number, y: number, sprite: string): void => {
  const left = Math.round(x - Math.floor(sprite.length / 2))

  for (let i = 0; i < sprite.length; i += 1) {
    drawChar(frame, width, height, left + i, y, sprite[i] ?? ' ')
  }
}

const getExplosionChar = (ttl: number, maxTtl: number): string => {
  const ratio = clamp(ttl / maxTtl, 0, 1)

  if (ratio > 0.65) {
    return '@'
  }

  if (ratio > 0.35) {
    return '*'
  }

  if (ratio > 0.15) {
    return '+'
  }

  return '.'
}

const frameToAscii = (frame: string[], width: number, height: number): string => {
  const lines = new Array<string>(height)

  for (let row = 0; row < height; row += 1) {
    const start = row * width
    lines[row] = frame.slice(start, start + width).join('')
  }

  return lines.join('\n')
}

export const renderAsciiFrame = (state: GameState): string => {
  const cache = ensureRenderCache(state.width, state.height)
  const frame = cache.frame

  frame.fill(' ')

  const tick = Math.floor(state.backgroundOffset * 0.75)
  for (const star of cache.stars) {
    frame[star.index] = getTwinkleChar(tick, star)
  }

  for (const item of state.items) {
    drawChar(frame, state.width, state.height, toGrid(item.x), toGrid(item.y), item.kind === 'pow' ? 'P' : 'B')
  }

  for (const bullet of state.enemyProjectiles) {
    drawChar(frame, state.width, state.height, toGrid(bullet.x), toGrid(bullet.y), bullet.char)
  }

  for (const bullet of state.playerProjectiles) {
    drawChar(frame, state.width, state.height, toGrid(bullet.x), toGrid(bullet.y), bullet.char)
  }

  for (const enemy of state.enemies) {
    drawSprite(frame, state.width, state.height, enemy.x, toGrid(enemy.y), getEnemySprite(enemy))
  }

  const invincibleBlink = state.player.invincibleTimer > 0 && Math.floor(state.player.invincibleTimer * 20) % 2 === 0
  if (!invincibleBlink && state.player.life > 0) {
    drawSprite(frame, state.width, state.height, state.player.x, toGrid(state.player.y), '/^^^^^\\')
  }

  if (state.playerHitEffectTimer > 0) {
    drawSprite(frame, state.width, state.height, state.player.x, toGrid(state.player.y - 1), '.***.')
    drawSprite(frame, state.width, state.height, state.player.x, toGrid(state.player.y), '**@**')
    drawSprite(frame, state.width, state.height, state.player.x, toGrid(state.player.y + 1), '.***.')
  }

  for (const explosion of state.explosions) {
    drawChar(
      frame,
      state.width,
      state.height,
      toGrid(explosion.x),
      toGrid(explosion.y),
      getExplosionChar(explosion.ttl, explosion.maxTtl),
    )
  }

  if (state.bombTimer > 0) {
    const progress = 1 - (state.bombTimer / 0.76)
    const pulseRow = Math.max(1, Math.floor(state.player.y - (state.player.y * progress)))
    for (let col = 0; col < state.width; col += 1) {
      if (col % 2 === 0) {
        drawChar(frame, state.width, state.height, col, pulseRow, '#')
      }
    }
  }

  return frameToAscii(frame, state.width, state.height)
}
