import {
  AUTO_FIRE_INTERVAL,
  BACKGROUND_SCROLL_SPEED,
  BASE_SPAWN_INTERVAL,
  BOMB_DAMAGE_PER_SECOND,
  BOMB_DURATION,
  DIFFICULTY_GROWTH_PER_SECOND,
  ENEMY_HIT_RADIUS,
  GAME_HEIGHT,
  GAME_WIDTH,
  ITEM_DROP_BOMB_CHANCE,
  ITEM_DROP_POW_CHANCE,
  ITEM_PICKUP_RADIUS,
  MAX_ENEMIES,
  MAX_DIFFICULTY_MULTIPLIER,
  MAX_POWER_LEVEL,
  PLAYER_HIT_RADIUS,
  PLAYER_INVINCIBLE_SECONDS,
  PLAYER_MAX_BOMBS,
  PLAYER_SPEED,
  PLAYER_START_BOMBS,
  PLAYER_START_LIFE,
  POINTER_FOLLOW_FACTOR,
  SCORE_PER_BOMB_KILL,
  SCORE_PER_ENEMY,
} from './constants'
import type { Enemy, EnemyType, GameState, InputState, ItemType, Projectile } from './types'

const MIN_PLAYER_Y_RATIO = 0.55

export {
  GAME_WIDTH,
  GAME_HEIGHT,
  MAX_POWER_LEVEL,
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const distanceSquared = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx
  const dy = ay - by
  return (dx * dx) + (dy * dy)
}

const enemyHitRadiusSquared = ENEMY_HIT_RADIUS * ENEMY_HIT_RADIUS
const playerHitRadiusSquared = PLAYER_HIT_RADIUS * PLAYER_HIT_RADIUS
const itemPickupRadiusSquared = ITEM_PICKUP_RADIUS * ITEM_PICKUP_RADIUS

const compactInPlace = <T>(array: T[], keep: (item: T) => boolean): void => {
  let writeIndex = 0

  for (let readIndex = 0; readIndex < array.length; readIndex += 1) {
    const item = array[readIndex]
    if (!item || !keep(item)) {
      continue
    }

    array[writeIndex] = item
    writeIndex += 1
  }

  array.length = writeIndex
}

const consumeSfx = (state: GameState, event: GameState['sfxQueue'][number]) => {
  state.sfxQueue.push(event)
}

const makePlayer = () => ({
  x: GAME_WIDTH / 2,
  y: GAME_HEIGHT - 6,
  life: PLAYER_START_LIFE,
  bombs: PLAYER_START_BOMBS,
  powerLevel: 1,
  invincibleTimer: 0,
  shotCooldown: 0,
})

export const createInputState = (): InputState => ({
  pointerActive: false,
  pointerX: GAME_WIDTH / 2,
  pointerY: GAME_HEIGHT - 6,
  moveLeft: false,
  moveRight: false,
  moveUp: false,
  moveDown: false,
  bombRequested: false,
})

export const createGameState = (highScore = 0): GameState => ({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  status: 'ready',
  elapsedTime: 0,
  score: 0,
  highScore,
  wave: 1,
  themeIndex: 0,
  backgroundOffset: 0,
  bombTimer: 0,
  playerHitEffectTimer: 0,
  spawnCooldown: 0.8,
  player: makePlayer(),
  playerProjectiles: [],
  enemyProjectiles: [],
  enemies: [],
  items: [],
  explosions: [],
  nextId: 1,
  sfxQueue: [],
})

const issueId = (state: GameState): number => {
  const id = state.nextId
  state.nextId += 1
  return id
}

export const resetGameState = (state: GameState): void => {
  const highScore = state.highScore
  const nextId = state.nextId
  Object.assign(state, createGameState(highScore))
  state.nextId = nextId
}

export const startGame = (state: GameState): void => {
  if (state.status === 'running') {
    return
  }

  if (state.status === 'gameover') {
    resetGameState(state)
  }

  state.status = 'running'
}

export const togglePause = (state: GameState): void => {
  if (state.status === 'running') {
    state.status = 'paused'
    return
  }

  if (state.status === 'paused') {
    state.status = 'running'
  }
}

export const getDifficultyMultiplier = (elapsedSeconds: number): number => {
  const scaled = 1 + (elapsedSeconds * DIFFICULTY_GROWTH_PER_SECOND)
  return clamp(scaled, 1, MAX_DIFFICULTY_MULTIPLIER)
}

export const applyItemPickup = (state: GameState, kind: ItemType): void => {
  if (kind === 'pow') {
    state.player.powerLevel = clamp(state.player.powerLevel + 1, 1, MAX_POWER_LEVEL)
  }

  if (kind === 'bomb') {
    state.player.bombs = clamp(state.player.bombs + 1, 0, PLAYER_MAX_BOMBS)
  }

  consumeSfx(state, 'pickup')
}

const createPlayerBullet = (state: GameState, vx: number, vy: number, damage: number): Projectile => ({
  id: issueId(state),
  x: state.player.x,
  y: state.player.y - 1,
  vx,
  vy,
  damage,
  char: '|',
})

const createEnemyBullet = (
  state: GameState,
  enemyX: number,
  enemyY: number,
  targetX: number,
  speedScale: number,
  vxOffset = 0,
): Projectile => {
  const directionX = clamp(targetX - enemyX, -4, 4)
  const vx = (directionX * 1.2) + vxOffset

  return {
    id: issueId(state),
    x: enemyX,
    y: enemyY + 1,
    vx,
    vy: 13 + (speedScale * 2),
    damage: 1,
    char: '!',
  }
}

const createEnemyBulletPattern = (
  state: GameState,
  enemy: Enemy,
  speedScale: number,
): Projectile[] => {
  const burstCount = speedScale >= 1.65 ? 3 : 2

  if (burstCount === 2) {
    return [
      createEnemyBullet(state, enemy.x, enemy.y, state.player.x, speedScale, -1.25),
      createEnemyBullet(state, enemy.x, enemy.y, state.player.x, speedScale, 1.25),
    ]
  }

  return [
    createEnemyBullet(state, enemy.x, enemy.y, state.player.x, speedScale, -1.8),
    createEnemyBullet(state, enemy.x, enemy.y, state.player.x, speedScale, 0),
    createEnemyBullet(state, enemy.x, enemy.y, state.player.x, speedScale, 1.8),
  ]
}

const getShotPattern = (powerLevel: number): Array<{ vx: number; vy: number; damage: number }> => {
  if (powerLevel <= 1) {
    return [{ vx: 0, vy: -30, damage: 1 }]
  }

  if (powerLevel === 2) {
    return [
      { vx: -1.8, vy: -30, damage: 1 },
      { vx: 1.8, vy: -30, damage: 1 },
    ]
  }

  if (powerLevel === 3) {
    return [
      { vx: -2.6, vy: -28, damage: 1 },
      { vx: 0, vy: -31, damage: 1 },
      { vx: 2.6, vy: -28, damage: 1 },
    ]
  }

  return [
    { vx: -2.6, vy: -28, damage: 1 },
    { vx: 0, vy: -31, damage: 1 },
    { vx: 2.6, vy: -28, damage: 1 },
  ]
}

export const updateAutoFire = (state: GameState, dt: number): void => {
  state.player.shotCooldown -= dt

  if (state.player.shotCooldown > 0) {
    return
  }

  const pattern = getShotPattern(state.player.powerLevel)
  for (const shot of pattern) {
    state.playerProjectiles.push(createPlayerBullet(state, shot.vx, shot.vy, shot.damage))
  }

  state.player.shotCooldown = AUTO_FIRE_INTERVAL[state.player.powerLevel] ?? AUTO_FIRE_INTERVAL[1]
}

const spawnEnemy = (state: GameState, random: () => number): void => {
  const r = random()
  let type: EnemyType = 'line'

  if (r > 0.66) {
    type = 'zigzag'
  } else if (r > 0.33) {
    type = 'tracker'
  }

  const difficulty = getDifficultyMultiplier(state.elapsedTime)
  const x = 2 + (random() * (state.width - 4))
  const hp = Math.max(1, Math.round(1 + ((difficulty - 1) * 1.7)))

  const enemy: Enemy = {
    id: issueId(state),
    type,
    x,
    y: -1,
    vx: (random() - 0.5) * 3,
    vy: 6.5 + (difficulty * 1.1),
    hp,
    age: 0,
    shootCooldown: 0.9 + (random() * 0.8),
    points: SCORE_PER_ENEMY,
  }

  state.enemies.push(enemy)
}

const maybeDropItem = (state: GameState, x: number, y: number, random: () => number): void => {
  const roll = random()

  if (roll < ITEM_DROP_POW_CHANCE) {
    state.items.push({
      id: issueId(state),
      kind: 'pow',
      x,
      y,
      vy: 6,
      ttl: 10,
    })
    return
  }

  if (roll < ITEM_DROP_POW_CHANCE + ITEM_DROP_BOMB_CHANCE) {
    state.items.push({
      id: issueId(state),
      kind: 'bomb',
      x,
      y,
      vy: 6,
      ttl: 10,
    })
  }
}

const addExplosion = (state: GameState, x: number, y: number, ttl = 0.35): void => {
  state.explosions.push({
    id: issueId(state),
    x,
    y,
    ttl,
    maxTtl: ttl,
  })
}

const updatePlayerMovement = (state: GameState, input: InputState, dt: number): void => {
  const minX = 1
  const maxX = state.width - 2
  const minY = Math.round(state.height * MIN_PLAYER_Y_RATIO)
  const maxY = state.height - 2

  if (input.pointerActive) {
    const nextX = state.player.x + ((input.pointerX - state.player.x) * POINTER_FOLLOW_FACTOR)
    const nextY = state.player.y + ((input.pointerY - state.player.y) * POINTER_FOLLOW_FACTOR)
    state.player.x = clamp(nextX, minX, maxX)
    state.player.y = clamp(nextY, minY, maxY)
    return
  }

  let x = state.player.x
  let y = state.player.y

  if (input.moveLeft) {
    x -= PLAYER_SPEED * dt
  }

  if (input.moveRight) {
    x += PLAYER_SPEED * dt
  }

  if (input.moveUp) {
    y -= PLAYER_SPEED * dt
  }

  if (input.moveDown) {
    y += PLAYER_SPEED * dt
  }

  state.player.x = clamp(x, minX, maxX)
  state.player.y = clamp(y, minY, maxY)
}

export const handlePlayerHit = (state: GameState): boolean => {
  if (state.player.invincibleTimer > 0 || state.status !== 'running') {
    return false
  }

  state.player.life -= 1
  state.player.powerLevel = clamp(state.player.powerLevel - 1, 1, MAX_POWER_LEVEL)
  state.player.invincibleTimer = PLAYER_INVINCIBLE_SECONDS
  state.playerHitEffectTimer = 0.34

  const burstOffsets: Array<[number, number]> = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-2, 0],
    [2, 0],
    [-1, -1],
    [1, -1],
    [0, -2],
  ]

  for (const [offsetX, offsetY] of burstOffsets) {
    addExplosion(state, state.player.x + offsetX, state.player.y + offsetY, 0.42)
  }

  consumeSfx(state, 'hit')

  if (state.player.life <= 0) {
    state.status = 'gameover'
    consumeSfx(state, 'gameOver')
  }

  return true
}

export const tryUseBomb = (state: GameState): boolean => {
  if (state.status !== 'running') {
    return false
  }

  if (state.player.bombs <= 0 || state.bombTimer > 0) {
    return false
  }

  state.player.bombs -= 1
  state.bombTimer = BOMB_DURATION
  consumeSfx(state, 'bomb')

  for (const enemy of state.enemies) {
    addExplosion(state, enemy.x, enemy.y, 0.25)
  }

  return true
}

const updateEnemyBehaviors = (state: GameState, dt: number, random: () => number): void => {
  const difficulty = getDifficultyMultiplier(state.elapsedTime)
  const spawnedEnemyBullets: Projectile[] = []

  for (const enemy of state.enemies) {
    enemy.age += dt
    enemy.y += enemy.vy * dt

    if (enemy.type === 'line') {
      enemy.x += enemy.vx * dt
    }

    if (enemy.type === 'zigzag') {
      enemy.x += Math.sin(enemy.age * 5) * 8 * dt
    }

    if (enemy.type === 'tracker') {
      const trackerVelocity = clamp((state.player.x - enemy.x) * 0.5, -5, 5)
      enemy.x += trackerVelocity * dt
    }

    enemy.x = clamp(enemy.x, 1, state.width - 2)

    enemy.shootCooldown -= dt
    if (enemy.shootCooldown <= 0) {
      spawnedEnemyBullets.push(...createEnemyBulletPattern(state, enemy, difficulty))
      enemy.shootCooldown = (1.3 / difficulty) + (random() * 0.65)
    }
  }

  state.enemyProjectiles.push(...spawnedEnemyBullets)
}

const updateProjectiles = (state: GameState, dt: number): void => {
  for (const bullet of state.playerProjectiles) {
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
  }

  for (const bullet of state.enemyProjectiles) {
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
  }

  compactInPlace(state.playerProjectiles, bullet => (
    bullet.y >= -2 && bullet.y <= state.height + 2 && bullet.x >= -1 && bullet.x <= state.width + 1
  ))

  compactInPlace(state.enemyProjectiles, bullet => (
    bullet.y >= -2 && bullet.y <= state.height + 2 && bullet.x >= -1 && bullet.x <= state.width + 1
  ))
}

const updateItems = (state: GameState, dt: number): void => {
  for (const item of state.items) {
    item.y += item.vy * dt
    item.ttl -= dt
  }

  compactInPlace(state.items, item => item.ttl > 0 && item.y <= state.height + 2)
}

const updateExplosions = (state: GameState, dt: number): void => {
  for (const explosion of state.explosions) {
    explosion.ttl -= dt
  }

  compactInPlace(state.explosions, explosion => explosion.ttl > 0)
}

const processBombDamage = (state: GameState, dt: number, random: () => number): void => {
  if (state.bombTimer <= 0) {
    return
  }

  state.bombTimer -= dt
  state.enemyProjectiles.length = 0

  const destroyedEnemyIds = new Set<number>()
  for (const enemy of state.enemies) {
    enemy.hp -= BOMB_DAMAGE_PER_SECOND * dt

    if (enemy.hp <= 0) {
      destroyedEnemyIds.add(enemy.id)
      state.score += SCORE_PER_BOMB_KILL
      addExplosion(state, enemy.x, enemy.y, 0.35)
      maybeDropItem(state, enemy.x, enemy.y, random)
      consumeSfx(state, 'enemyDown')
    }
  }

  if (destroyedEnemyIds.size > 0) {
    compactInPlace(state.enemies, enemy => !destroyedEnemyIds.has(enemy.id))
  }

  if (state.bombTimer < 0) {
    state.bombTimer = 0
  }
}

const processCollisions = (state: GameState, random: () => number): void => {
  const removedPlayerBullets = new Set<number>()
  const removedEnemyBullets = new Set<number>()
  const removedEnemyIds = new Set<number>()
  const removedItemIds = new Set<number>()

  for (const bullet of state.playerProjectiles) {
    for (const enemy of state.enemies) {
      if (removedEnemyIds.has(enemy.id)) {
        continue
      }

      if (distanceSquared(bullet.x, bullet.y, enemy.x, enemy.y) > enemyHitRadiusSquared) {
        continue
      }

      enemy.hp -= bullet.damage
      removedPlayerBullets.add(bullet.id)

      if (enemy.hp <= 0) {
        removedEnemyIds.add(enemy.id)
        state.score += enemy.points
        addExplosion(state, enemy.x, enemy.y)
        maybeDropItem(state, enemy.x, enemy.y, random)
        consumeSfx(state, 'enemyDown')
      }

      break
    }
  }

  for (const bullet of state.enemyProjectiles) {
    if (distanceSquared(bullet.x, bullet.y, state.player.x, state.player.y) <= playerHitRadiusSquared) {
      removedEnemyBullets.add(bullet.id)
      handlePlayerHit(state)
    }
  }

  for (const enemy of state.enemies) {
    if (distanceSquared(enemy.x, enemy.y, state.player.x, state.player.y) <= playerHitRadiusSquared) {
      removedEnemyIds.add(enemy.id)
      addExplosion(state, enemy.x, enemy.y)
      handlePlayerHit(state)
    }
  }

  for (const item of state.items) {
    if (distanceSquared(item.x, item.y, state.player.x, state.player.y) <= itemPickupRadiusSquared) {
      removedItemIds.add(item.id)
      applyItemPickup(state, item.kind)
    }
  }

  compactInPlace(state.playerProjectiles, bullet => !removedPlayerBullets.has(bullet.id))
  compactInPlace(state.enemyProjectiles, bullet => !removedEnemyBullets.has(bullet.id))
  compactInPlace(state.enemies, enemy => !removedEnemyIds.has(enemy.id) && enemy.y <= state.height + 2)
  compactInPlace(state.items, item => !removedItemIds.has(item.id))

  state.score = Math.max(0, state.score)
  state.highScore = Math.max(state.highScore, state.score)
}

export const stepGame = (state: GameState, input: InputState, dt: number, random: () => number = Math.random): void => {
  if (state.status !== 'running') {
    return
  }

  const tick = Math.min(dt, 0.05)

  state.elapsedTime += tick
  state.wave = Math.max(1, Math.floor(state.elapsedTime / 20) + 1)
  state.themeIndex = Math.floor(state.elapsedTime / 45) % 3
  state.backgroundOffset += BACKGROUND_SCROLL_SPEED * tick

  if (state.player.invincibleTimer > 0) {
    state.player.invincibleTimer = Math.max(0, state.player.invincibleTimer - tick)
  }
  state.playerHitEffectTimer = Math.max(0, state.playerHitEffectTimer - tick)

  updatePlayerMovement(state, input, tick)
  updateAutoFire(state, tick)

  if (input.bombRequested) {
    tryUseBomb(state)
    input.bombRequested = false
  }

  state.spawnCooldown -= tick
  if (state.spawnCooldown <= 0) {
    if (state.enemies.length < MAX_ENEMIES) {
      spawnEnemy(state, random)
      const difficulty = getDifficultyMultiplier(state.elapsedTime)
      state.spawnCooldown = (BASE_SPAWN_INTERVAL / difficulty) + (random() * 0.35)
    } else {
      state.spawnCooldown = 0.22
    }
  }

  updateEnemyBehaviors(state, tick, random)
  updateProjectiles(state, tick)
  updateItems(state, tick)
  processBombDamage(state, tick, random)
  processCollisions(state, random)
  updateExplosions(state, tick)

  if (state.status === 'gameover') {
    state.highScore = Math.max(state.highScore, state.score)
  }
}
