import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPlayer from '../../src/components/VideoPlayer.vue'
import QueuePlayer from '../../src/components/QueuePlayer.vue'
import { mountTrackMediaKeys, clearMediaKeyHistory } from '../../src/utils/mediaSession'

/**
 * Stage 55 (task 7, round 4): the temporary media-key instrument has to be observable on the device.
 *
 * Stage 53-B found why the stage 54 instrument could not be read: it was rendered only in
 * `QueuePlayer.vue` — the "Videos" screen had none at all — and it sat OUTSIDE `div.plyr`, which is the
 * element Plyr puts into real fullscreen. So in fullscreen the line was never painted, and the headset
 * check is normally done in fullscreen.
 *
 * The instrument now belongs to `VideoPlayer.vue` and lives inside the Plyr container: one instance covers
 * both screens, and it is inside the fullscreen subtree, which is exactly where the user presses the
 * headset buttons. Plyr is stubbed here the way the real Plyr builds its DOM: the media element is wrapped
 * in `div.plyr`, and `elements.container` is that wrapper (not the `<video>`).
 */
const plyrWrappers = []

// Stage 57: the reading line is switched OFF unless the user asks for it. Two ways to ask, both read once
// when the player is mounted: the page address `?mediakeys=1`, or the localStorage flag below.
const SHOW_KEY = 'video-media-keys-diag-show'

vi.mock('plyr', () => ({
    __esModule: true,
    default: class MockPlyr {
        constructor(el) {
            const container = document.createElement('div')
            container.className = 'plyr'
            const controls = document.createElement('div')
            controls.className = 'plyr__controls'
            el.parentNode.insertBefore(container, el)
            container.appendChild(el)
            container.appendChild(controls)
            this.elements = { container, controls, buttons: { play: [] } }
            plyrWrappers.push(container)
        }
        on() {}
        play() { return Promise.resolve() }
        pause() {}
        destroy() { this.destroyed = true }
    },
}))

vi.mock('@nextcloud/router', () => ({ generateFilePath: () => '/apps/video/js/plyr.svg' }))
vi.mock('../../src/api/views', () => ({ incrementViewRequest: vi.fn().mockResolvedValue({}) }))
vi.mock('../../src/utils/videoThumbnail', () => ({
    generateVideoThumbnail: vi.fn(() => Promise.resolve('data:image/jpeg;base64,FRAME')),
}))

/** The platform side of the Media Session API: jsdom has no `navigator.mediaSession` at all. */
function installFakeMediaSession() {
    const handlers = {}
    Object.defineProperty(window.navigator, 'mediaSession', {
        configurable: true,
        value: {
            setActionHandler(action, handler) {
                handlers[action] = handler
            },
            setMetadata() {},
            setPositionState() {},
        },
    })
    return handlers
}

function textOf(wrapper) {
    const diag = wrapper.find('.media-keys-diag')
    return diag.exists() ? diag.text().replace(/\s+/g, ' ').trim() : ''
}

async function mountPlayer(extraProps = {}, showDiag = true) {
    if (showDiag) {
        localStorage.setItem(SHOW_KEY, '1')
    } else {
        localStorage.removeItem(SHOW_KEY)
    }
    const wrapper = mount(VideoPlayer, {
        attachTo: document.body,
        props: {
            src: '/files/a.mp4',
            title: 'a.mp4',
            trackKey: 'Movies/a.mp4',
            hasPrevTrack: true,
            hasNextTrack: true,
            ...extraProps,
        },
    })
    await wrapper.vm.$nextTick()
    return wrapper
}

let fakeMediaSession = null

beforeEach(() => {
    localStorage.clear()
    // The instrument keeps its history in the module (and in localStorage); a test must start from an
    // empty reading, otherwise a press from an earlier test is shown as if it had just arrived.
    clearMediaKeyHistory()
    plyrWrappers.length = 0
    fakeMediaSession = installFakeMediaSession()
})

afterEach(() => {
    Object.defineProperty(window.navigator, 'mediaSession', { configurable: true, value: undefined })
})

describe('VideoPlayer.vue — the media-key instrument lives inside the Plyr container', () => {
    it('is rendered inside div.plyr, not next to it', async () => {
        const wrapper = await mountPlayer()
        const container = plyrWrappers[0]

        expect(container).toBeTruthy()
        expect(container.querySelector('.media-keys-diag')).toBeTruthy()
        // The media element and the instrument share the fullscreen subtree: Plyr takes `div.plyr`
        // into real fullscreen, so anything outside it is not painted there.
        expect(container.querySelector('video')).toBeTruthy()
        wrapper.unmount()
    })

    it('is placed inside the container only once and is not a child of the Plyr control row', async () => {
        const wrapper = await mountPlayer()
        const container = plyrWrappers[0]
        const controls = container.querySelector('.plyr__controls')

        expect(container.querySelectorAll('.media-keys-diag').length).toBe(1)
        // The row of Plyr buttons and its width budget (tasks 2 and 3) must stay untouched.
        expect(controls.querySelector('.media-keys-diag')).toBeNull()
        wrapper.unmount()
    })

    it('reports what the screen offers the platform: both directions when there are neighbours', async () => {
        const wrapper = await mountPlayer({ hasPrevTrack: true, hasNextTrack: true })
        const text = textOf(wrapper)

        expect(text).toContain('prev ✓')
        expect(text).toContain('next ✓')
        wrapper.unmount()
    })

    it('follows the neighbour rule of the screen: a missing side is shown as empty', async () => {
        const wrapper = await mountPlayer({ hasPrevTrack: false, hasNextTrack: true })
        const text = textOf(wrapper)

        expect(text).toContain('prev ∅')
        expect(text).toContain('next ✓')
        wrapper.unmount()
    })

    it('shows a press that arrives from the platform, so a device test can read the delivery path', async () => {
        const wrapper = await mountPlayer()
        const moved = vi.fn()
        const owner = mountTrackMediaKeys({ onPrev: moved, onNext: moved })

        // Called the way a headset button calls it: the action handler of the media session.
        fakeMediaSession.nexttrack()
        await wrapper.vm.$nextTick()

        const text = textOf(wrapper)
        expect(text).toContain('nexttrack platform ✓')
        owner.destroy()
        wrapper.unmount()
    })

    it('goes away with the player', async () => {
        const wrapper = await mountPlayer()
        const container = plyrWrappers[0]

        expect(document.querySelector('.media-keys-diag')).toBeTruthy()
        expect(container.querySelector('.media-keys-diag')).toBeTruthy()
        wrapper.unmount()
        expect(document.querySelector('.media-keys-diag')).toBeNull()
    })

    it('is a measurement line, not interface: hidden from assistive technology', async () => {
        const wrapper = await mountPlayer()
        const diag = wrapper.find('.media-keys-diag')

        expect(diag.attributes('aria-hidden')).toBe('true')
        wrapper.unmount()
    })

    // Stage 55 regression (found on the device, measured in Chromium 2026-11-21): an instrument styled by
    // SCOPED rules depends on `js/` and `css/` being from one and the same build. When the browser keeps the
    // old CSS while the JS is new (the trap of plan/Memory.md §4 items 19 and 24), every scoped rule stops matching
    // — and a `<p>` inside `div.plyr` then joins the Plyr flex column as a normal block: measured, the player
    // grew 363x150 -> 363x209 and the line landed below the video. So the instrument carries its own layout.
    it('carries its own layout inline, without depending on the stylesheet', async () => {
        const wrapper = await mountPlayer()
        const diag = wrapper.find('.media-keys-diag')
        const style = diag.attributes('style') || ''

        expect(style).toContain('position: absolute')
        expect(style).toContain('top: 8px')
        expect(style).toContain('left: 8px')
        expect(style).toContain('z-index: 2')
        expect(style).toContain('pointer-events: none')
        wrapper.unmount()
    })

    it('stays out of the Plyr control row even when the page has no stylesheets at all', async () => {
        const wrapper = await mountPlayer()
        const container = plyrWrappers[0]
        const controls = container.querySelector('.plyr__controls')
        const diag = container.querySelector('.media-keys-diag')

        expect(diag.style.position).toBe('absolute')
        expect(controls.contains(diag)).toBe(false)
        wrapper.unmount()
    })
})

describe('the instrument survives a reload of a background tab (Android reloads background tabs)', () => {
    it('writes what it recorded into localStorage', async () => {
        const wrapper = await mountPlayer()
        const owner = mountTrackMediaKeys({ onPrev: vi.fn(), onNext: vi.fn() })

        fakeMediaSession.previoustrack()
        await wrapper.vm.$nextTick()

        const stored = JSON.parse(localStorage.getItem('video-media-keys-diag') || '[]')
        expect(stored.some((event) => event.action === 'previoustrack' && event.path === 'platform')).toBe(true)
        owner.destroy()
        wrapper.unmount()
    })

    it('shows a press that was recorded before this page existed', async () => {
        // The press happened while the tab was in the background; Chromium dropped and reloaded the page.
        localStorage.setItem('video-media-keys-diag', JSON.stringify([
            { action: 'nexttrack', path: 'platform', result: 'ran', at: Date.now() },
        ]))

        const wrapper = await mountPlayer()
        await wrapper.vm.$nextTick()
        const text = textOf(wrapper)

        expect(text).toContain('nexttrack platform ✓')
        wrapper.unmount()
    })

    it('does not invent anything when the stored history is broken', async () => {
        localStorage.setItem('video-media-keys-diag', '{not json}')

        const wrapper = await mountPlayer()
        const text = textOf(wrapper)

        expect(text).toContain('prev ✓')
        expect(text).not.toContain('nexttrack')
        wrapper.unmount()
    })
})

describe('QueuePlayer.vue — one instrument per playing screen', () => {
    it('renders no reading line by default (stage 57: the popup is off)', async () => {
        localStorage.removeItem(SHOW_KEY)
        const wrapper = mount(QueuePlayer, {
            attachTo: document.body,
            props: {
                items: [
                    { path: 'Movies/a.mp4', name: 'a.mp4' },
                    { path: 'Movies/b.mp4', name: 'b.mp4' },
                ],
            },
        })
        await wrapper.vm.$nextTick()

        expect(wrapper.findAll('.media-keys-diag').length).toBe(0)
        expect(document.querySelectorAll('.media-keys-diag').length).toBe(0)
        expect(plyrWrappers[0].querySelector('.media-keys-diag')).toBeNull()
        wrapper.unmount()
    })

    it('renders the instrument through the player, and only one of it, when it is asked for', async () => {
        localStorage.setItem(SHOW_KEY, '1')
        const wrapper = mount(QueuePlayer, {
            attachTo: document.body,
            props: {
                items: [
                    { path: 'Movies/a.mp4', name: 'a.mp4' },
                    { path: 'Movies/b.mp4', name: 'b.mp4' },
                ],
            },
        })
        await wrapper.vm.$nextTick()

        const instruments = wrapper.findAll('.media-keys-diag')
        expect(instruments.length).toBe(1)
        const container = plyrWrappers[0]
        expect(container.querySelector('.media-keys-diag')).toBeTruthy()
        wrapper.unmount()
    })
})

describe('stage 57 — the reading is off unless it is asked for, and the keys stay alive', () => {
    it('renders nothing over the video when nobody asked for the reading', async () => {
        const wrapper = await mountPlayer({}, false)
        const container = plyrWrappers[0]

        expect(wrapper.findAll('.media-keys-diag').length).toBe(0)
        expect(container.querySelector('.media-keys-diag')).toBeNull()
        expect(document.querySelectorAll('.media-keys-diag').length).toBe(0)
        wrapper.unmount()
    })

    // The point of this whole stage: turning the instrument off must not take the headset buttons with it.
    it('keeps both platform actions registered and running while the line is hidden', async () => {
        const wrapper = await mountPlayer({}, false)
        const ran = { prev: 0, next: 0 }
        const owner = mountTrackMediaKeys({
            onPrev: () => { ran.prev += 1 },
            onNext: () => { ran.next += 1 },
        })

        fakeMediaSession.nexttrack()
        fakeMediaSession.previoustrack()
        await wrapper.vm.$nextTick()

        expect(ran.next).toBe(1)
        expect(ran.prev).toBe(1)
        expect(document.querySelectorAll('.media-keys-diag').length).toBe(0)
        owner.destroy()
        wrapper.unmount()
    })

    it('shows the line when the page address asks for it (?mediakeys=1)', async () => {
        localStorage.removeItem(SHOW_KEY)
        window.history.replaceState(null, '', '/?mediakeys=1')
        try {
            const wrapper = await mountPlayer({}, false)

            expect(document.querySelectorAll('.media-keys-diag').length).toBe(1)
            expect(plyrWrappers[0].querySelector('.media-keys-diag')).toBeTruthy()
            wrapper.unmount()
        } finally {
            window.history.replaceState(null, '', '/')
        }
    })

    it('shows the line when localStorage asks for it', async () => {
        localStorage.setItem(SHOW_KEY, '1')
        const wrapper = await mountPlayer({}, true)

        expect(plyrWrappers[0].querySelector('.media-keys-diag')).toBeTruthy()
        wrapper.unmount()
    })
})
