import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import QueuePlayer from '../../src/components/QueuePlayer.vue'

/**
 * Task 7: the "Playlists" screen has to answer the media keys of Bluetooth headsets.
 *
 * Stage 43 measured in real Chromium: the tab is already an active media session (Plyr writes
 * `navigator.mediaSession.metadata`), but nobody registers `previoustrack`/`nexttrack` handlers, and the
 * browser has no default behaviour for them — so the headset buttons are silent. YouTube works because it
 * registers them. These tests mount QueuePlayer with the real VideoPlayer (Plyr stubbed) and a fake
 * `navigator.mediaSession`, then press the actions the platform would press.
 */
vi.mock('plyr', () => ({
    __esModule: true,
    default: class MockPlyr {
        constructor(el) {
            // Real Plyr wraps the media element in `div.plyr`, and `elements.container` is that wrapper.
            // The stub copies that shape: stage 55 depends on it — the media-key instrument has to live
            // inside `div.plyr`, because `div.plyr` is what Plyr takes into real fullscreen.
            const container = document.createElement('div')
            container.className = 'plyr'
            const controls = document.createElement('div')
            controls.className = 'plyr__controls'
            el.parentNode.insertBefore(container, el)
            container.appendChild(el)
            container.appendChild(controls)
            this.elements = { container, controls, buttons: { play: [] } }
        }
        on() {}
        play() { return Promise.resolve() }
        pause() {}
        destroy() { this.destroyed = true }
    },
}))

vi.mock('@nextcloud/router', () => ({
    generateFilePath: () => '/apps/video/js/plyr.svg',
}))

vi.mock('../../src/utils/videoUrl', () => ({
    davFileUrl: (path) => `/dav/${path}`,
}))

vi.mock('../../src/utils/viewCount', () => ({
    incrementView: vi.fn(),
}))

const items = [
    { path: 'Movies/a.mp4', name: 'a.mp4' },
    { path: 'Movies/b.mp4', name: 'b.mp4' },
    { path: 'Movies/c.mp4', name: 'c.mp4' },
]

let mediaSession

function installFakeMediaSession() {
    mediaSession = {
        handlers: {},
        metadata: null,
        playbackState: null,
        setActionHandler(action, handler) {
            this.handlers[action] = handler
        },
    }
    Object.defineProperty(window.navigator, 'mediaSession', { configurable: true, value: mediaSession })
    class FakeMediaMetadata {
        constructor({ title = '', artist = '', album = '', artwork = [] } = {}) {
            Object.assign(this, { title, artist, album, artwork })
        }
    }
    Object.defineProperty(window, 'MediaMetadata', { configurable: true, value: FakeMediaMetadata })
}

function removeFakeMediaSession() {
    delete window.navigator.mediaSession
    delete window.MediaMetadata
}

async function mountQueue() {
    const wrapper = mount(QueuePlayer, { props: { items } })
    await wrapper.vm.$nextTick()
    return wrapper
}

function currentTitle(wrapper) {
    return wrapper.find('.queue-player__current').text()
}

/** The press of a headset button: the platform calls the action handler we registered. */
async function pressAction(wrapper, action) {
    const handler = mediaSession.handlers[action]
    expect(handler).toBeInstanceOf(Function)
    handler({ action })
    await wrapper.vm.$nextTick()
}

describe('QueuePlayer.vue — headset media keys switch tracks (task 7)', () => {
    beforeEach(() => {
        localStorage.clear()
        installFakeMediaSession()
    })

    afterEach(() => {
        removeFakeMediaSession()
    })

    it('mounting the queue keeps both directions registered, inert where there is no neighbour', async () => {
        const wrapper = await mountQueue()

        // Stage 54: the first track of a queue with repeat off has no previous neighbour, but the action is
        // no longer taken away from the platform — taking it away made the headset button unreachable and
        // hid it from the OS media controls (stage 53-A). The neighbour rule now only refuses inside.
        expect(typeof mediaSession.handlers.previoustrack).toBe('function')
        expect(typeof mediaSession.handlers.nexttrack).toBe('function')

        mediaSession.handlers.previoustrack({ action: 'previoustrack' })
        await wrapper.vm.$nextTick()
        expect(currentTitle(wrapper)).toBe('a.mp4')

        wrapper.unmount()
    })

    it('nexttrack on the headset advances to the next video', async () => {
        const wrapper = await mountQueue()

        expect(currentTitle(wrapper)).toBe('a.mp4')
        await pressAction(wrapper, 'nexttrack')

        expect(currentTitle(wrapper)).toBe('b.mp4')
        wrapper.unmount()
    })

    it('previoustrack on the headset goes back to the previous video', async () => {
        const wrapper = await mountQueue()

        await pressAction(wrapper, 'nexttrack')
        await pressAction(wrapper, 'previoustrack')

        expect(currentTitle(wrapper)).toBe('a.mp4')
        wrapper.unmount()
    })

    it('with repeat off the first track the previous action stays offered but changes nothing', async () => {
        const wrapper = await mountQueue()

        // Stage 54: the first track has no neighbour, so nothing may happen — but the action stays offered,
        // because an action we withdrew was unreachable for the headset and hidden from the OS controls.
        expect(typeof mediaSession.handlers.previoustrack).toBe('function')
        expect(typeof mediaSession.handlers.nexttrack).toBe('function')

        await pressAction(wrapper, 'previoustrack')
        expect(currentTitle(wrapper)).toBe('a.mp4')
        wrapper.unmount()
    })

    it('with repeat off the last track stays registered, does nothing, and the queue keeps playing', async () => {
        const wrapper = await mountQueue()

        await pressAction(wrapper, 'nexttrack')
        await pressAction(wrapper, 'nexttrack')

        expect(currentTitle(wrapper)).toBe('c.mp4')
        // Registered but inert: the neighbour rule refuses inside (task 6), the window is not dropped.
        expect(typeof mediaSession.handlers.nexttrack).toBe('function')
        mediaSession.handlers.nexttrack({ action: 'nexttrack' })
        await wrapper.vm.$nextTick()
        expect(currentTitle(wrapper)).toBe('c.mp4')

        await wrapper.vm.$nextTick()
        expect(wrapper.find('.queue-player__current').exists()).toBe(true)
        wrapper.unmount()
    })

    it('a queue that has finished offers nothing: the player is closed and nothing plays', async () => {
        const wrapper = await mountQueue()

        await pressAction(wrapper, 'nexttrack')
        await pressAction(wrapper, 'nexttrack')
        expect(currentTitle(wrapper)).toBe('c.mp4')
        expect(typeof mediaSession.handlers.nexttrack).toBe('function')

        // The last video reaches its end with repeat off: the queue is finished, the window closes.
        wrapper.find('video').element.dispatchEvent(new Event('ended'))
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.queue-player__current').exists()).toBe(false)
        expect(mediaSession.handlers.previoustrack).toBeNull()
        expect(mediaSession.handlers.nexttrack).toBeNull()

        wrapper.unmount()
    })

    it('the player reports what arrived from the platform when the reading is asked for', async () => {
        // Stage 57: the line is off by default; the page address `?mediakeys=1` or this localStorage flag
        // turns it on. The reading itself is unchanged, only its visibility became opt-in.
        localStorage.setItem('video-media-keys-diag-show', '1')
        const wrapper = await mountQueue()

        await pressAction(wrapper, 'nexttrack')
        mediaSession.handlers.previoustrack({ action: 'previoustrack' })
        await pressAction(wrapper, 'previoustrack')

        // Stage 55: the instrument is no longer a line under the player (class `queue-player__media-keys`,
        // outside `div.plyr`, invisible in real fullscreen — finding ① of stage 53-B). It is rendered by
        // VideoPlayer and lives inside the Plyr container, i.e. inside the fullscreen subtree.
        const diag = wrapper.find('.media-keys-diag')
        expect(diag.exists()).toBe(true)
        expect(diag.element.closest('.plyr')).toBeTruthy()
        const text = diag.text()
        expect(text).toContain('nexttrack')
        expect(text).toContain('previoustrack')

        wrapper.unmount()
    })

    it('with repeat on the first track wraps back to the last one (the rule accepted in task 6)', async () => {
        localStorage.setItem('video-queue-repeat', '1')
        const wrapper = await mountQueue()

        await pressAction(wrapper, 'previoustrack')

        expect(currentTitle(wrapper)).toBe('c.mp4')
        wrapper.unmount()
    })

    it('with repeat on the last track still wraps forward to the first one', async () => {
        const wrapper = await mountQueue()

        await pressAction(wrapper, 'nexttrack')
        await pressAction(wrapper, 'nexttrack')
        localStorage.setItem('video-queue-repeat', '1')
        await wrapper.find('.queue-player__repeat').trigger('click')
        await wrapper.vm.$nextTick()

        await pressAction(wrapper, 'nexttrack')

        expect(currentTitle(wrapper)).toBe('a.mp4')
        wrapper.unmount()
    })

    it('a press that arrives both as a key and as an action advances by one track only', async () => {
        const wrapper = await mountQueue()

        // Stage 43 could not determine which path a real headset uses; some platforms send both, and
        // that must not skip two videos.
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'MediaTrackNext' }))
        mediaSession.handlers.nexttrack({ action: 'nexttrack' })
        await wrapper.vm.$nextTick()

        expect(currentTitle(wrapper)).toBe('b.mp4')
        wrapper.unmount()
    })

    it('leaving the screen unregisters the actions so a stale handler cannot control a dead queue', async () => {
        const wrapper = await mountQueue()

        wrapper.unmount()

        expect(mediaSession.handlers.previoustrack).toBeNull()
        expect(mediaSession.handlers.nexttrack).toBeNull()
    })
})
