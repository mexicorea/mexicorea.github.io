export type GameStatus = 'ready' | 'running' | 'paused' | 'gameover'

export type EnemyType = 'line' | 'zigzag' | 'tracker'

export type ItemType = 'pow' | 'bomb'

export type SoundEvent = 'enemyDown' | 'pickup' | 'bomb' | 'hit' | 'gameOver'

export interface Player {
  x: number
  y: number
  life: number
  bombs: number
  powerLevel: number
  invincibleTimer: number
  shotCooldown: number
}

export interface Projectile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  char: string
}

export interface Enemy {
  id: number
  type: EnemyType
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  age: number
  shootCooldown: number
  points: number
}

export interface Item {
  id: number
  kind: ItemType
  x: number
  y: number
  vy: number
  ttl: number
}

export interface Explosion {
  id: number
  x: number
  y: number
  ttl: number
  maxTtl: number
}

export interface InputState {
  pointerActive: boolean
  pointerX: number
  pointerY: number
  moveLeft: boolean
  moveRight: boolean
  moveUp: boolean
  moveDown: boolean
  bombRequested: boolean
}

export interface GameState {
  width: number
  height: number
  status: GameStatus
  elapsedTime: number
  score: number
  highScore: number
  wave: number
  themeIndex: number
  backgroundOffset: number
  bombTimer: number
  playerHitEffectTimer: number
  spawnCooldown: number
  player: Player
  playerProjectiles: Projectile[]
  enemyProjectiles: Projectile[]
  enemies: Enemy[]
  items: Item[]
  explosions: Explosion[]
  nextId: number
  sfxQueue: SoundEvent[]
}
