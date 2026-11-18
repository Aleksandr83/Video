import { describe, it, expect, vi } from 'vitest'
import { createScreenOrientationApi } from '../../src/utils/screenOrientation'

/**
 * Fake `window` for the adapter: only `screen.orientation` and `isSecureContext`
 * are read by the module.
 */
function fakeWindow({ orientation, isSecureContext = true } = {}) {
    const screen = {}
    if (orientation) {
        screen.orientation = orientation
    }
    return { screen, isSecureContext }
}

describe('screenOrientation.js', () => {
    it('is supported when the browser exposes Screen.orientation.lock', () => {
        const api = createScreenOrientationApi(
            fakeWindow({ orientation: { lock: vi.fn(), unlock: vi.fn() } }),
        )
        expect(api.supported()).toBe(true)
    })

    it('is not supported when Screen.orientation is absent (jsdom, old browsers)', () => {
        const api = createScreenOrientationApi(fakeWindow({}))
        expect(api.supported()).toBe(false)
    })

    it('is not supported without a secure context (spec requirement)', () => {
        const api = createScreenOrientationApi(
            fakeWindow({ orientation: { lock: vi.fn(), unlock: vi.fn() }, isSecureContext: false }),
        )
        expect(api.supported()).toBe(false)
    })

    it('reports an insecure context as unsupported even when lock is present', async () => {
        const lock = vi.fn()
        const api = createScreenOrientationApi(
            fakeWindow({ orientation: { lock, unlock: vi.fn() }, isSecureContext: false }),
        )
        await expect(api.lock('landscape')).resolves.toBe(false)
        expect(lock).not.toHaveBeenCalled()
    })

    it('lock() resolves true when the browser accepted the request', async () => {
        const lock = vi.fn().mockResolvedValue(undefined)
        const api = createScreenOrientationApi(fakeWindow({ orientation: { lock, unlock: vi.fn() } }))
        await expect(api.lock('landscape')).resolves.toBe(true)
        expect(lock).toHaveBeenCalledWith('landscape')
    })

    it('lock() resolves true for engines whose lock() returns no promise', async () => {
        const lock = vi.fn().mockReturnValue(undefined)
        const api = createScreenOrientationApi(fakeWindow({ orientation: { lock, unlock: vi.fn() } }))
        await expect(api.lock('landscape-primary')).resolves.toBe(true)
    })

    it('lock() resolves false when the browser rejects the request (NotAllowedError)', async () => {
        const lock = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
        const api = createScreenOrientationApi(fakeWindow({ orientation: { lock, unlock: vi.fn() } }))
        await expect(api.lock('landscape')).resolves.toBe(false)
    })

    it('lock() does not throw when the browser throws synchronously', async () => {
        const lock = vi.fn(() => {
            throw new Error('boom')
        })
        const api = createScreenOrientationApi(fakeWindow({ orientation: { lock, unlock: vi.fn() } }))
        await expect(api.lock('landscape')).resolves.toBe(false)
    })

    it('unlock() delegates to the browser', () => {
        const unlock = vi.fn()
        const api = createScreenOrientationApi(fakeWindow({ orientation: { lock: vi.fn(), unlock } }))
        api.unlock()
        expect(unlock).toHaveBeenCalledTimes(1)
    })

    it('unlock() is a silent no-op when the API is missing', () => {
        const api = createScreenOrientationApi(fakeWindow({}))
        expect(() => api.unlock()).not.toThrow()
    })

    it('unlock() swallows a synchronous browser error', () => {
        const unlock = vi.fn(() => {
            throw new Error('boom')
        })
        const api = createScreenOrientationApi(fakeWindow({ orientation: { lock: vi.fn(), unlock } }))
        expect(() => api.unlock()).not.toThrow()
    })
})
