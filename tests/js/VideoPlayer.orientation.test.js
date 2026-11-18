import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPlayer from '../../src/components/VideoPlayer.vue'
import { LANDSCAPE_FALLBACK_CLASS } from '../../src/utils/fullscreenOrientation'

const plyrInstances = []

vi.mock('plyr', () => ({
    __esModule: true,
    default: class MockPlyr {
        constructor(el, config) {
            this.el = el
            this.config = config
            plyrInstances.push(this)
        }

        on() {}

        play() {
            return Promise.resolve()
        }

        pause() {}

        destroy() {
            this.destroyed = true
        }
    },
}))

vi.mock('@nextcloud/router', () => ({
    generateFilePath: () => '/apps/video/js/plyr.svg',
}))

vi.mock('../../src/api/views', () => ({
    incrementViewRequest: vi.fn().mockResolvedValue({}),
}))

// jsdom has no Fullscreen API: stub the fullscreen element (the element the
// browser puts into fullscreen — in production this is Plyr's container).
let fullscreenElement = null
Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
})

function enterFullscreen() {
    fullscreenElement = document.createElement('div')
    fullscreenElement.className = 'plyr'
    document.dispatchEvent(new Event('fullscreenchange'))
    return fullscreenElement
}

function exitFullscreen() {
    fullscreenElement = null
    document.dispatchEvent(new Event('fullscreenchange'))
}

describe('VideoPlayer.vue — fullscreen orientation', () => {
    beforeEach(() => {
        localStorage.clear()
        plyrInstances.length = 0
        fullscreenElement = null
    })

    function mountPlayer() {
        return mount(VideoPlayer, {
            props: { src: '/remote.php/dav/files/testuser/Movies/a.mp4', title: 'a.mp4' },
        })
    }

    it('asks for landscape in fullscreen even when the browser has no orientation API', () => {
        // jsdom exposes no Screen.orientation: this is the case of a browser (or
        // a phone with system auto-rotate off) that cannot rotate the screen.
        // The component must still mark the fullscreen element for the CSS fallback.
        const wrapper = mountPlayer()

        const element = enterFullscreen()
        expect(element.classList.contains(LANDSCAPE_FALLBACK_CLASS)).toBe(true)

        wrapper.unmount()
    })

    it('does not rotate a vertical video', () => {
        const wrapper = mountPlayer()
        const video = wrapper.find('video').element
        Object.defineProperty(video, 'videoWidth', { configurable: true, get: () => 720 })
        Object.defineProperty(video, 'videoHeight', { configurable: true, get: () => 1280 })

        const element = enterFullscreen()
        expect(element.classList.contains(LANDSCAPE_FALLBACK_CLASS)).toBe(false)

        wrapper.unmount()
    })

    it('removes the rotation class when fullscreen is left', () => {
        const wrapper = mountPlayer()

        const element = enterFullscreen()
        exitFullscreen()

        // Plyr keeps its container element, so the class must be removed explicitly.
        expect(element.classList.contains(LANDSCAPE_FALLBACK_CLASS)).toBe(false)

        wrapper.unmount()
    })

    it('stops reacting to fullscreen events after the player is unmounted', () => {
        const wrapper = mountPlayer()
        enterFullscreen()
        wrapper.unmount()

        const element = enterFullscreen()
        expect(element.classList.contains(LANDSCAPE_FALLBACK_CLASS)).toBe(false)
    })
})
