import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom lacks ResizeObserver, which Radix popovers use for positioning.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.className = ''
})
