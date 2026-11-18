import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    createFullscreenOrientation,
    LANDSCAPE_FALLBACK_CLASS,
    ORIENTATION_LANDSCAPE,
    ORIENTATION_PORTRAIT,
} from '../../src/utils/fullscreenOrientation'

// jsdom implements neither the Fullscreen API nor Screen.orientation, so the
// fullscreen state is stubbed here once for the whole file (redefining it per
// test is not possible: the property descriptor must exist before use).
let fullscreenElement = null
Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
})

/** A media element stub with controllable intrinsic size. */
function videoStub({ width = 1920, height = 1080 } = {}) {
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { configurable: true, get: () => width })
    Object.defineProperty(video, 'videoHeight', { configurable: true, get: () => height })
    return video
}

/** Fake screenOrientation adapter (the interface the coordinator depends on). */
function apiStub({ supported = true, accepted = true } = {}) {
    return {
        supported: vi.fn(() => supported),
        lock: vi.fn(async () => accepted),
        unlock: vi.fn(),
    }
}

function enterFullscreen(element = document.createElement('div')) {
    fullscreenElement = element
    document.dispatchEvent(new Event('fullscreenchange'))
    return element
}

function exitFullscreen() {
    fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))
}

describe('fullscreenOrientation.js', () => {
    beforeEach(() => {
        fullscreenElement = null
        document.webkitFullscreenElement = null
    })

    it('exposes the CSS class name shared with the stylesheet (single source)', () => {
        expect(typeof LANDSCAPE_FALLBACK_CLASS).toBe('string')
        expect(LANDSCAPE_FALLBACK_CLASS.length).toBeGreaterThan(0)
    })

    it('locks a wide video to landscape when fullscreen starts', () => {
        const api = apiStub()
        const changes = []
        const controller = createFullscreenOrientation({
            video: videoStub({ width: 1920, height: 1080 }),
            api,
            onStateChange: (state) => changes.push(state),
        })

        controller.start()
        const element = enterFullscreen()

        expect(api.lock).toHaveBeenCalledWith(ORIENTATION_LANDSCAPE)
        expect(changes.at(-1)).toMatchObject({
            fullscreen: true,
            landscapeVideo: true,
            requested: ORIENTATION_LANDSCAPE,
        })
        expect(changes.at(-1).element).toBe(element)

        controller.stop()
    })

    it('keeps a tall (vertical) video in portrait', () => {
        const api = apiStub()
        const changes = []
        const controller = createFullscreenOrientation({
            video: videoStub({ width: 720, height: 1280 }),
            api,
            onStateChange: (state) => changes.push(state),
        })

        controller.start()
        enterFullscreen()

        expect(api.lock).toHaveBeenCalledWith(ORIENTATION_PORTRAIT)
        expect(changes.at(-1).landscapeVideo).toBe(false)

        controller.stop()
    })

    it('treats a video with no metadata yet as landscape', () => {
        const api = apiStub()
        const controller = createFullscreenOrientation({
            video: videoStub({ width: 0, height: 0 }),
            api,
        })

        controller.start()
        enterFullscreen()

        expect(api.lock).toHaveBeenCalledWith(ORIENTATION_LANDSCAPE)
        expect(controller.state().landscapeVideo).toBe(true)

        controller.stop()
    })

    it('publishes the state before the lock settles, so the CSS fallback is not delayed', async () => {
        // The lock outcome is irrelevant for the state: the stylesheet decides
        // whether the rotation is needed (it only applies in portrait).
        const api = apiStub({ accepted: false })
        const changes = []
        const controller = createFullscreenOrientation({
            video: videoStub({ width: 1920, height: 1080 }),
            api,
            onStateChange: (state) => changes.push(state),
        })

        controller.start()
        enterFullscreen()

        expect(changes.at(-1).landscapeVideo).toBe(true)
        await Promise.resolve()
        expect(controller.state().landscapeVideo).toBe(true)

        controller.stop()
    })

    it('re-evaluates the orientation when a new track loads during fullscreen', () => {
        const api = apiStub()
        const video = videoStub({ width: 1920, height: 1080 })
        const changes = []
        const controller = createFullscreenOrientation({ video, api, onStateChange: (s) => changes.push(s) })

        controller.start()
        enterFullscreen()

        // QueuePlayer switches to a vertical video while still fullscreen.
        Object.defineProperty(video, 'videoHeight', { configurable: true, get: () => 1280 })
        Object.defineProperty(video, 'videoWidth', { configurable: true, get: () => 720 })
        video.dispatchEvent(new Event('loadedmetadata'))

        expect(api.lock).toHaveBeenCalledTimes(2)
        expect(api.lock).toHaveBeenLastCalledWith(ORIENTATION_PORTRAIT)
        expect(changes.at(-1).landscapeVideo).toBe(false)

        controller.stop()
    })

    it('ignores metadata events while not in fullscreen', () => {
        const api = apiStub()
        const video = videoStub()
        const controller = createFullscreenOrientation({ video, api })

        controller.start()
        video.dispatchEvent(new Event('loadedmetadata'))

        expect(api.lock).not.toHaveBeenCalled()

        controller.stop()
    })

    it('releases the orientation and clears the state on fullscreen exit', () => {
        const api = apiStub()
        const changes = []
        const controller = createFullscreenOrientation({
            video: videoStub(),
            api,
            onStateChange: (s) => changes.push(s),
        })

        controller.start()
        enterFullscreen()
        exitFullscreen()

        expect(api.unlock).toHaveBeenCalledTimes(1)
        expect(changes.at(-1)).toMatchObject({ fullscreen: false, landscapeVideo: false, element: null })
        expect(controller.state().fullscreen).toBe(false)

        controller.stop()
    })

    it('handles the webkit-prefixed fullscreen event (Safari, older Chromium)', () => {
        const api = apiStub()
        const controller = createFullscreenOrientation({ video: videoStub(), api })

        controller.start()
        document.webkitFullscreenElement = document.createElement('div')
        document.dispatchEvent(new Event('webkitfullscreenchange'))

        expect(controller.state().fullscreen).toBe(true)
        expect(api.lock).toHaveBeenCalledTimes(1)

        controller.stop()
    })

    it('applies immediately when the player mounts while already fullscreen', () => {
        const api = apiStub()
        fullscreenElement = document.createElement('div')
        const controller = createFullscreenOrientation({ video: videoStub(), api })

        controller.start()

        expect(api.lock).toHaveBeenCalledTimes(1)
        expect(controller.state().fullscreen).toBe(true)

        controller.stop()
    })

    it('start() twice does not register the listener twice', () => {
        const api = apiStub()
        const video = videoStub()
        const controller = createFullscreenOrientation({ video, api })

        controller.start()
        controller.start()
        enterFullscreen()

        expect(api.lock).toHaveBeenCalledTimes(1)

        controller.stop()
    })

    it('stop() detaches the listeners and releases an active fullscreen lock', () => {
        const api = apiStub()
        const video = videoStub()
        const controller = createFullscreenOrientation({ video, api })

        controller.start()
        enterFullscreen()
        controller.stop()

        expect(api.unlock).toHaveBeenCalledTimes(1)

        // The player component is gone: later fullscreen events must be ignored.
        enterFullscreen()
        expect(api.lock).toHaveBeenCalledTimes(1)

        controller.stop()
        expect(api.unlock).toHaveBeenCalledTimes(1)
    })
})
