import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VideoPlayer from '../../src/components/VideoPlayer.vue'

/**
 * Task 7, part two: the platform UI must know WHAT is playing and WHETHER it is playing.
 *
 * Stage 43 measured (`/tmp/vc/check23.out.txt`): Plyr writes `navigator.mediaSession.metadata` once with
 * empty strings (`setMediaMetadata()` in plyr.js:2922, defaults in plyr.js:3749-3754), and after playback
 * starts `playbackState` is still `undefined` — Plyr never reports it. So the Android notification /
 * Windows media flyout shows an unnamed item in an unknown state, while YouTube shows the video name.
 * VideoPlayer owns the `<video>`, so it owns the metadata and the playback state; the track actions belong
 * to the screen that owns the queue (see QueuePlayer.mediaKeys.test.js / MainView.mediaKeys.test.js).
 */
const plyrConfigs = []

vi.mock('plyr', () => ({
    __esModule: true,
    default: class MockPlyr {
        constructor(el, config) {
            const controls = document.createElement('div')
            controls.className = 'plyr__controls'
            plyrConfigs.push(config)
            this.elements = { container: el, controls, buttons: { play: [] } }
        }
        on() {}
        play() { return Promise.resolve() }
        pause() {}
        destroy() { this.destroyed = true }
    },
}))

vi.mock('@nextcloud/router', () => ({ generateFilePath: () => '/apps/video/js/plyr.svg' }))
vi.mock('../../src/api/views', () => ({ incrementViewRequest: vi.fn().mockResolvedValue({}) }))

/**
 * Stage 50: the cover of the playing video.
 *
 * `src/utils/videoThumbnail.js` captures a frame with a real `<video>` element and a canvas, which jsdom
 * cannot do, so the util is stubbed here. The tests below check the observable promise instead: the frame
 * the player asked for ends up in `mediaSession.metadata.artwork`, it belongs to the track that is playing,
 * and a capture that fails or arrives late must not leave the platform with the wrong picture.
 */
const thumb = vi.hoisted(() => ({
    mode: 'auto', // 'auto' | 'gate' (resolve by hand) | 'reject'
    frame: 'data:image/jpeg;base64,FRAME1',
    calls: [],
    gates: [],
}))

vi.mock('../../src/utils/videoThumbnail', () => ({
    generateVideoThumbnail: vi.fn((url) => {
        thumb.calls.push(url)
        if (thumb.mode === 'reject') {
            return Promise.reject(new Error('frame capture failed'))
        }
        if (thumb.mode === 'gate') {
            return new Promise((resolve) => thumb.gates.push({ url, frame: thumb.frame, resolve }))
        }
        return Promise.resolve(thumb.frame)
    }),
}))

let mediaSession

function installFakeMediaSession() {
    mediaSession = {
        handlers: {},
        metadata: null,
        playbackState: null,
        positionState: null,
        positionCalls: [],
        setActionHandler(action, handler) { this.handlers[action] = handler },
        setPositionState(state) {
            const reported = arguments.length > 0 ? state : null
            this.positionCalls.push(reported)
            this.positionState = reported
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

const DURATION = 163.79 // the duration of the user's own MP4 (measured in stage 36)

/** jsdom does not load media: report the duration the way a browser would. */
function giveDuration(el, value) {
    Object.defineProperty(el, 'duration', { configurable: true, get: () => value })
}

const SRC1 = '/remote.php/dav/files/testuser/Movies/Butterfly.mp4'
const SRC2 = '/remote.php/dav/files/testuser/Movies/Next.mp4'
const FRAME1 = 'data:image/jpeg;base64,FRAME1'
const FRAME2 = 'data:image/jpeg;base64,FRAME2'

function mountPlayer(props = {}) {
    return mount(VideoPlayer, {
        props: {
            src: SRC1,
            title: 'Butterfly.mp4',
            trackKey: 'Movies/Butterfly.mp4',
            ...props,
        },
    })
}

function media(wrapper) {
    return wrapper.find('video').element
}

function fire(wrapper, name) {
    media(wrapper).dispatchEvent(new Event(name))
}

describe('VideoPlayer.vue — what the platform is told about the playing video', () => {
    beforeEach(() => {
        localStorage.clear()
        plyrConfigs.length = 0
        thumb.mode = 'auto'
        thumb.frame = FRAME1
        thumb.calls.length = 0
        thumb.gates.length = 0
        installFakeMediaSession()
    })

    afterEach(() => {
        removeFakeMediaSession()
    })

    it('gives Plyr the title of the video so the metadata it writes is not empty', () => {
        const wrapper = mountPlayer()

        expect(plyrConfigs[0].mediaMetadata).toBeDefined()
        expect(plyrConfigs[0].mediaMetadata.title).toBe('Butterfly.mp4')
        wrapper.unmount()
    })

    it('reports the playback state when playback starts and when it stops', () => {
        const wrapper = mountPlayer()

        fire(wrapper, 'playing')
        expect(mediaSession.playbackState).toBe('playing')

        fire(wrapper, 'pause')
        expect(mediaSession.playbackState).toBe('paused')
        wrapper.unmount()
    })

    it('follows the title when the queue switches to another video', async () => {
        const wrapper = mountPlayer()

        await wrapper.setProps({
            src: '/remote.php/dav/files/testuser/Movies/Next.mp4',
            title: 'Next.mp4',
            trackKey: 'Movies/Next.mp4',
        })

        expect(mediaSession.metadata.title).toBe('Next.mp4')
        wrapper.unmount()
    })

    it('reports a paused state when a video ends and leaves nothing set when the player closes', () => {
        const wrapper = mountPlayer()
        fire(wrapper, 'playing')

        fire(wrapper, 'ended')
        wrapper.unmount()

        expect(mediaSession.metadata).toBeNull()
        expect(mediaSession.playbackState).toBe('none')
    })

    it('does not register the track actions: the screen that owns the queue does', () => {
        const wrapper = mountPlayer({ hasPrevTrack: true, hasNextTrack: true })

        expect(mediaSession.handlers.previoustrack ?? null).toBeNull()
        expect(mediaSession.handlers.nexttrack ?? null).toBeNull()
        wrapper.unmount()
    })

    it('does not break the player in a browser without the media session API', () => {
        removeFakeMediaSession()

        expect(() => mountPlayer()).not.toThrow()
    })

    /**
     * Stage 50 — the next round of task 7 (the user's instruction of 2026-11-19 06:26 MSK).
     *
     * Stage 48 failed on the device: the headset buttons are still silent. What the OS is told today is
     * only a name and play/pause — no duration, no position, no picture. YouTube, which the user compares
     * us to and which works with the same headphones in the same browser, reports all of it, so the OS
     * media controls show the item with a progress bar and its own prev/next buttons. VideoPlayer owns the
     * `<video>`, so it is the only place that can report this: the duration and the rate come from the
     * media element, the cover comes from `src/utils/videoThumbnail.js` (already used for the cards).
     */
    it('reports the duration and the playback rate as soon as the media knows them', () => {
        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)

        fire(wrapper, 'loadedmetadata')

        expect(mediaSession.positionState).toMatchObject({ duration: DURATION, positioning: 0, playbackRate: 1 })
        wrapper.unmount()
    })

    it('says nothing about the position while the duration is still unknown', () => {
        const wrapper = mountPlayer()

        fire(wrapper, 'loadedmetadata')
        fire(wrapper, 'timeupdate')

        // A call without arguments is the deliberate clearing of a stale state (prepareTrack), not a report;
        // what must not happen is a report built on an unknown length.
        expect(mediaSession.positionCalls.filter((state) => state !== null)).toHaveLength(0)
        expect(mediaSession.positionState).toBeNull()
        wrapper.unmount()
    })

    it('the position the platform sees follows the playback', () => {
        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        fire(wrapper, 'loadedmetadata')

        el.currentTime = 40
        fire(wrapper, 'timeupdate')

        expect(mediaSession.positionState.positioning).toBe(40)
        wrapper.unmount()
    })

    it('a change of the playback speed is reported to the platform', () => {
        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        fire(wrapper, 'loadedmetadata')

        // Plyr's settings menu changes `speed`, which the media element reports as `ratechange`.
        el.playbackRate = 1.5
        fire(wrapper, 'ratechange')

        expect(mediaSession.positionState.playbackRate).toBe(1.5)
        wrapper.unmount()
    })

    it('a track switch drops the state of the track being left and reports the new one', async () => {
        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        fire(wrapper, 'loadedmetadata')
        expect(mediaSession.positionState.duration).toBe(DURATION)

        await wrapper.setProps({ src: SRC2, title: 'Next.mp4', trackKey: 'Movies/Next.mp4' })

        // The old duration must not stay attached to a file whose length is not known yet.
        expect(mediaSession.positionState).toBeNull()

        giveDuration(el, 60)
        fire(wrapper, 'loadedmetadata')
        expect(mediaSession.positionState).toMatchObject({ duration: 60, positioning: 0 })
        wrapper.unmount()
    })

    it('gives the platform a cover picture for the playing video', async () => {
        const wrapper = mountPlayer()
        await flushPromises()

        expect(mediaSession.metadata.artwork).toHaveLength(1)
        expect(mediaSession.metadata.artwork[0].src).toBe(FRAME1)
        expect(mediaSession.metadata.artwork[0].type).toBe('image/jpeg')
        // The frame is captured from the file that is actually playing.
        expect(thumb.calls).toContain(SRC1)
        wrapper.unmount()
    })

    it('the cover follows the queue, not the video that opened the player', async () => {
        const wrapper = mountPlayer()
        await flushPromises()

        thumb.frame = FRAME2
        await wrapper.setProps({ src: SRC2, title: 'Next.mp4', trackKey: 'Movies/Next.mp4' })
        await flushPromises()

        expect(thumb.calls[thumb.calls.length - 1]).toBe(SRC2)
        expect(mediaSession.metadata.title).toBe('Next.mp4')
        expect(mediaSession.metadata.artwork[0].src).toBe(FRAME2)
        wrapper.unmount()
    })

    it('a cover that arrives late does not repaint the track that is playing now', async () => {
        thumb.mode = 'gate'

        const wrapper = mountPlayer()
        thumb.frame = FRAME2
        await wrapper.setProps({ src: SRC2, title: 'Next.mp4', trackKey: 'Movies/Next.mp4' })

        expect(thumb.gates).toHaveLength(2)
        const [butterfly, next] = thumb.gates

        next.resolve(FRAME2)
        await flushPromises()
        // The previous track answers last: its picture must be dropped, not written over the new one.
        butterfly.resolve(FRAME1)
        await flushPromises()

        expect(mediaSession.metadata.title).toBe('Next.mp4')
        expect(mediaSession.metadata.artwork[0].src).toBe(FRAME2)
        wrapper.unmount()
    })

    it('a cover that cannot be captured leaves the title and no artwork', async () => {
        thumb.mode = 'reject'

        const wrapper = mountPlayer()
        await flushPromises()

        expect(mediaSession.metadata.title).toBe('Butterfly.mp4')
        expect(mediaSession.metadata.artwork).toHaveLength(0)
        wrapper.unmount()
    })

    it('captures one cover per track, not one per tick of the playback', async () => {
        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        fire(wrapper, 'loadedmetadata')
        fire(wrapper, 'timeupdate')
        fire(wrapper, 'timeupdate')
        await flushPromises()

        expect(thumb.calls).toHaveLength(1)
        wrapper.unmount()
    })

    it('loads the file a second time for a cover only when the browser can show one', async () => {
        removeFakeMediaSession()

        const wrapper = mountPlayer()
        await flushPromises()

        expect(thumb.calls).toHaveLength(0)
        wrapper.unmount()
    })

    it('a cover that arrives after the player closed does not bring the session back to life', async () => {
        thumb.mode = 'gate'

        const wrapper = mountPlayer()
        wrapper.unmount()

        expect(thumb.gates).toHaveLength(1)
        thumb.gates[0].resolve(FRAME1)
        await flushPromises()

        expect(mediaSession.metadata).toBeNull()
        expect(mediaSession.playbackState).toBe('none')
    })

    it('closing the player also leaves no position behind for the platform', () => {
        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        fire(wrapper, 'loadedmetadata')
        expect(mediaSession.positionState).not.toBeNull()

        wrapper.unmount()

        expect(mediaSession.positionState).toBeNull()
    })
})
