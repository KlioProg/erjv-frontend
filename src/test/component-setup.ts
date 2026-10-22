import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(cleanup)

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
})
HTMLElement.prototype.scrollIntoView = vi.fn()
window.scrollTo = vi.fn()
HTMLElement.prototype.hasPointerCapture = () => false
HTMLElement.prototype.setPointerCapture = vi.fn()
HTMLElement.prototype.releasePointerCapture = vi.fn()
window.PointerEvent = MouseEvent as typeof PointerEvent
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
