import { createGameState, createInputState, startGame, stepGame } from './engine'
import { renderAsciiFrame } from './render'
import type { GameState } from './types'

const TICK = 1 / 60
const RENDER_INTERVAL = 1 / 30
const MAX_SIMULATION_STEPS = 4
const STORAGE_KEY = 'asciiShooterHighScore'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

interface PlayfieldMetrics {
  viewportLeft: number
  viewportTop: number
  left: number
  top: number
  width: number
  height: number
}

const loadHighScore = (): number => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return 0
    }

    const score = Number(raw)
    return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0
  } catch {
    return 0
  }
}

const saveHighScore = (score: number): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.floor(score))))
  } catch {
    // LocalStorage 실패 시에도 게임은 계속 진행한다.
  }
}

const toGameCoordinates = (
  metrics: PlayfieldMetrics,
  clientX: number,
  clientY: number,
  state: GameState,
) => {
  const xRatio = clamp((clientX - metrics.viewportLeft - metrics.left) / metrics.width, 0, 1)
  const yRatio = clamp((clientY - metrics.viewportTop - metrics.top) / metrics.height, 0, 1)

  return {
    x: xRatio * (state.width - 1),
    y: yRatio * (state.height - 1),
  }
}

const setOverlay = (
  overlayTitle: HTMLElement,
  overlaySubtitle: HTMLElement,
  overlayButton: HTMLButtonElement,
  state: GameState,
): void => {
  if (state.status === 'ready') {
    overlayTitle.textContent = 'ASCII STRIKER'
    overlaySubtitle.textContent = '탭/클릭으로 시작. 기본샷 자동 발사, Bomb은 긴급 회피용.'
    overlayButton.textContent = 'START'
    return
  }

  if (state.status === 'paused') {
    overlayTitle.textContent = 'PAUSED'
    overlaySubtitle.textContent = '계속하려면 Resume을 누르세요.'
    overlayButton.textContent = 'RESUME'
    return
  }

  if (state.status === 'gameover') {
    overlayTitle.textContent = 'GAME OVER'
    overlaySubtitle.textContent = `점수 ${state.score} | 최고점 ${state.highScore}`
    overlayButton.textContent = 'RESTART'
  }
}

export const mountAsciiShooter = (): void => {
  const screen = document.getElementById('game-screen') as HTMLPreElement | null
  const viewport = document.getElementById('game-viewport') as HTMLElement | null
  const overlay = document.getElementById('game-overlay') as HTMLElement | null
  const overlayTitle = document.getElementById('overlay-title') as HTMLElement | null
  const overlaySubtitle = document.getElementById('overlay-subtitle') as HTMLElement | null
  const overlayButton = document.getElementById('overlay-action') as HTMLButtonElement | null
  const bombButton = document.getElementById('bomb-button') as HTMLButtonElement | null
  const scoreLabel = document.getElementById('score-value') as HTMLElement | null
  const highScoreLabel = document.getElementById('high-score-value') as HTMLElement | null
  const lifeLabel = document.getElementById('life-value') as HTMLElement | null
  const bombLabel = document.getElementById('bomb-value') as HTMLElement | null
  const powerLabel = document.getElementById('power-value') as HTMLElement | null
  const waveLabel = document.getElementById('wave-value') as HTMLElement | null

  if (
    !screen ||
    !viewport ||
    !overlay ||
    !overlayTitle ||
    !overlaySubtitle ||
    !overlayButton ||
    !bombButton ||
    !scoreLabel ||
    !highScoreLabel ||
    !lifeLabel ||
    !bombLabel ||
    !powerLabel ||
    !waveLabel
  ) {
    return
  }

  if (viewport.dataset.gameMounted === '1') {
    return
  }
  viewport.dataset.gameMounted = '1'

  const state = createGameState(loadHighScore())
  const input = createInputState()
  let playfieldMetrics: PlayfieldMetrics = {
    viewportLeft: 0,
    viewportTop: 0,
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  }
  let charRatio = 0

  const fitAsciiScreen = () => {
    const rect = viewport.getBoundingClientRect()
    if (charRatio === 0) {
      const sample = document.createElement('span')
      sample.textContent = 'MMMMMMMMMM'
      sample.style.position = 'absolute'
      sample.style.visibility = 'hidden'
      sample.style.whiteSpace = 'pre'
      sample.style.fontFamily = getComputedStyle(screen).fontFamily
      sample.style.fontSize = '20px'
      sample.style.lineHeight = '1'
      document.body.append(sample)
      const measured = sample.getBoundingClientRect()
      sample.remove()
      charRatio = measured.width > 0 ? (measured.width / 10) / measured.height : 0.6
    }

    const cellByHeight = rect.height / state.height
    const cellByWidth = rect.width / (state.width * charRatio)
    const fontSize = Math.max(6, Math.floor(Math.min(cellByHeight, cellByWidth)))
    const charWidth = fontSize * charRatio
    const renderWidth = charWidth * state.width
    const renderHeight = fontSize * state.height
    const left = Math.max(0, (rect.width - renderWidth) / 2)
    const top = Math.max(0, (rect.height - renderHeight) / 2)

    screen.style.fontSize = `${fontSize}px`
    screen.style.lineHeight = '1'
    screen.style.width = `${renderWidth}px`
    screen.style.height = `${renderHeight}px`
    screen.style.left = `${left}px`
    screen.style.top = `${top}px`

    playfieldMetrics = {
      viewportLeft: rect.left,
      viewportTop: rect.top,
      left,
      top,
      width: Math.max(1, renderWidth),
      height: Math.max(1, renderHeight),
    }
  }

  const updateHud = () => {
    scoreLabel.textContent = String(state.score)
    highScoreLabel.textContent = String(state.highScore)
    lifeLabel.textContent = '▲'.repeat(Math.max(0, state.player.life)) || '-'
    bombLabel.textContent = '●'.repeat(Math.max(0, state.player.bombs)) || '0'
    powerLabel.textContent = `L${state.player.powerLevel}`
    waveLabel.textContent = String(state.wave)

    bombButton.disabled = state.player.bombs <= 0 || state.status !== 'running'

    setOverlay(overlayTitle, overlaySubtitle, overlayButton, state)
    overlay.classList.toggle('is-hidden', state.status === 'running')
  }

  const render = () => {
    screen.textContent = renderAsciiFrame(state)
    if (state.status === 'gameover') {
      saveHighScore(state.highScore)
    }
    updateHud()
    state.sfxQueue = []
  }

  const handlePointerMove = (clientX: number, clientY: number) => {
    const next = toGameCoordinates(playfieldMetrics, clientX, clientY, state)
    input.pointerX = next.x
    input.pointerY = next.y
    input.pointerActive = true
  }

  viewport.addEventListener('pointerdown', event => {
    const target = event.target as HTMLElement | null
    if (target?.closest('button')) {
      return
    }

    if (event.pointerType === 'mouse') {
      if (state.status === 'running' && event.button === 0) {
        input.bombRequested = true
      }
      return
    }

    viewport.setPointerCapture(event.pointerId)
    handlePointerMove(event.clientX, event.clientY)

    if (state.status === 'ready') {
      startGame(state)
    }
  })

  viewport.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') {
      handlePointerMove(event.clientX, event.clientY)
      return
    }

    if (!input.pointerActive || state.status !== 'running') {
      return
    }
    handlePointerMove(event.clientX, event.clientY)
  })

  viewport.addEventListener('pointerup', () => {
    input.pointerActive = false
  })

  viewport.addEventListener('pointercancel', () => {
    input.pointerActive = false
  })

  viewport.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') {
      input.pointerActive = false
    }
  })

  document.addEventListener('keydown', event => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.moveLeft = true
    if (event.code === 'ArrowRight' || event.code === 'KeyD') input.moveRight = true
    if (event.code === 'ArrowUp' || event.code === 'KeyW') input.moveUp = true
    if (event.code === 'ArrowDown' || event.code === 'KeyS') input.moveDown = true

    if (event.code === 'Space') {
      input.bombRequested = true
      event.preventDefault()
    }

    if (event.code === 'KeyR') {
      startGame(state)
      updateHud()
    }
  })

  document.addEventListener('keyup', event => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') input.moveLeft = false
    if (event.code === 'ArrowRight' || event.code === 'KeyD') input.moveRight = false
    if (event.code === 'ArrowUp' || event.code === 'KeyW') input.moveUp = false
    if (event.code === 'ArrowDown' || event.code === 'KeyS') input.moveDown = false
  })

  bombButton.addEventListener('click', () => {
    input.bombRequested = true
  })

  overlayButton.addEventListener('click', event => {
    event.stopPropagation()
    startGame(state)
    updateHud()
  })

  let lastTimestamp = performance.now()
  let accumulator = 0
  let renderAccumulator = 0
  let rafId = 0
  let hidden = document.hidden

  const loop = (timestamp: number) => {
    const delta = Math.min(0.1, (timestamp - lastTimestamp) / 1000)
    lastTimestamp = timestamp

    if (hidden) {
      rafId = window.requestAnimationFrame(loop)
      return
    }

    accumulator += delta
    let simulationSteps = 0
    while (accumulator >= TICK && simulationSteps < MAX_SIMULATION_STEPS) {
      stepGame(state, input, TICK)
      accumulator -= TICK
      simulationSteps += 1
    }

    if (simulationSteps === MAX_SIMULATION_STEPS) {
      accumulator = 0
    }

    renderAccumulator += delta
    if (renderAccumulator >= RENDER_INTERVAL) {
      renderAccumulator = 0
      render()
    }

    rafId = window.requestAnimationFrame(loop)
  }

  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden
    if (!hidden) {
      lastTimestamp = performance.now()
    }
  })

  fitAsciiScreen()
  window.addEventListener('resize', fitAsciiScreen)
  window.addEventListener('scroll', fitAsciiScreen, { passive: true })
  render()
  rafId = window.requestAnimationFrame(loop)

  window.addEventListener('beforeunload', () => {
    window.cancelAnimationFrame(rafId)
  })
}
