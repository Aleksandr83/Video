import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    supportsMediaSession,
    mountTrackMediaKeys,
    setMediaSessionMetadata,
    setMediaSessionPlaybackState,
    clearMediaSession,
    MEDIA_KEY_DEDUPE_MS,
} from '../../src/utils/mediaSession'
// The helpers of stage 51 do not exist yet. Imported as a namespace on purpose: a missing named export
// would break the whole file, and the tests of the previous stages must stay green while these are red.
import * as mediaSessionApi from '../../src/utils/mediaSession'

/**
 * Task 7. Stage 43 measured in a real Chromium (`/tmp/vc/check23.out.txt`): the tab is already an active
 * media session — Plyr assigns `navigator.mediaSession.metadata` with empty strings — but Plyr registers
 * not a single action handler (`grep -c setActionHandler plyr.js` -> 0), and the browser has no default
 * behaviour for `previoustrack`/`nexttrack`. That is why the headset buttons are silent while `play/pause`
 * works, and why the same headphones work on YouTube: YouTube registers those handlers.
 *
 * This module is the single owner of the "previous track"/"next track" command: the Media Session action
 * (headsets, OS media controls) and the `keydown` media key (keyboards) both go through it, so a press
 * that a browser delivers through both paths cannot skip two videos.
 *
 * jsdom has no `navigator.mediaSession` and no `MediaMetadata`, so the tests install a fake and record
 * what the module asks the platform to do.
 */
let mediaSession

function installFakeMediaSession() {
    mediaSession = {
        handlers: {},
        metadata: null,
        playbackState: null,
        // Stage 50: what the platform was last told about the position of the playing item,
        // and every call it received (a call without arguments means "forget the position").
        positionState: null,
        positionCalls: [],
        setActionHandler(action, handler) {
            this.handlers[action] = handler
        },
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

function pressAction(action) {
    const handler = mediaSession.handlers[action]
    if (typeof handler !== 'function') {
        return false
    }
    handler({ action })
    return true
}

function pressKey(code) {
    document.dispatchEvent(new KeyboardEvent('keydown', { code }))
}

describe('src/utils/mediaSession.js — the media key owner', () => {
    beforeEach(() => {
        installFakeMediaSession()
    })

    afterEach(() => {
        removeFakeMediaSession()
    })

    it('detects a browser that offers the media session API', () => {
        expect(supportsMediaSession()).toBe(true)
        removeFakeMediaSession()
        expect(supportsMediaSession()).toBe(false)
    })

    it('registers the two actions a headset button turns into', () => {
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext: vi.fn() })

        expect(typeof mediaSession.handlers.previoustrack).toBe('function')
        expect(typeof mediaSession.handlers.nexttrack).toBe('function')
        keys.destroy()
    })

    it('an action from the platform runs the screens navigation', () => {
        const onPrev = vi.fn()
        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev, onNext })

        expect(pressAction('previoustrack')).toBe(true)
        expect(pressAction('nexttrack')).toBe(true)

        expect(onPrev).toHaveBeenCalledTimes(1)
        expect(onNext).toHaveBeenCalledTimes(1)
        keys.destroy()
    })

    it('a keyboard media key runs the same navigation', () => {
        const onPrev = vi.fn()
        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev, onNext })

        pressKey('MediaTrackPrevious')
        pressKey('MediaTrackNext')

        expect(onPrev).toHaveBeenCalledTimes(1)
        expect(onNext).toHaveBeenCalledTimes(1)
        keys.destroy()
    })

    it('an ordinary key is not a media command', () => {
        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext })

        pressKey('ArrowRight')
        pressKey('MediaTrackNext') // the legacy spelling some browsers report in `key`
        pressKey('MediaTrackNext')

        expect(onNext).toHaveBeenCalledTimes(2)
        keys.destroy()
    })

    it('a press that arrives as a key AND as an action is one command, not two', () => {
        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext })

        pressKey('MediaTrackNext')
        pressAction('nexttrack')

        expect(onNext).toHaveBeenCalledTimes(1)
        keys.destroy()
    })

    it('the order of the two paths does not matter', () => {
        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext })

        pressAction('nexttrack')
        pressKey('MediaTrackNext')

        expect(onNext).toHaveBeenCalledTimes(1)
        keys.destroy()
    })

    it('a key held down (auto-repeat in one path) keeps repeating', () => {
        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext })

        pressKey('MediaTrackNext')
        pressKey('MediaTrackNext')
        pressKey('MediaTrackNext')

        expect(onNext).toHaveBeenCalledTimes(3)
        keys.destroy()
    })

    it('the dedupe window is short enough not to eat two real presses', () => {
        vi.useFakeTimers()
        vi.setSystemTime(0)

        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext })

        pressKey('MediaTrackNext')
        vi.advanceTimersByTime(MEDIA_KEY_DEDUPE_MS + 1)
        pressAction('nexttrack')

        expect(onNext).toHaveBeenCalledTimes(2)
        keys.destroy()
        vi.useRealTimers()
    })

    /**
     * Stage 54 (task 7): the user's decision of 2026-11-19 08:0x MSK - stop withdrawing the actions.
     *
     * Measured in stage 53-A: at the first track (repeat off) at the last track (repeat off), in a
     * one-video playlist and in a queue that has finished, our page used to tell the browser
     * `setActionHandler(action, null)` — and per the spec (§4.4) a user agent handling a media session
     * action aborts when the session does not carry that action: «If actions does not contain the key
     * action, abort these steps». A removed handler cannot be called, and the platform hides its button.
     * play/pause keeps working because the spec recommends the UA to implement those two defaults itself,
     * which is exactly the asymmetry the user sees. YouTube never removes the two actions.
     *
     * So while a screen owns the media keys, BOTH actions stay registered. The neighbour rule is applied
     * inside the handler: the inert direction changes nothing, it is just no longer taken away from us.
     */
    it('both actions stay registered while this screen owns them', () => {
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext: vi.fn() })

        keys.setAvailability({ prev: false, next: true })

        expect(typeof mediaSession.handlers.previoustrack).toBe('function')
        expect(typeof mediaSession.handlers.nexttrack).toBe('function')

        keys.setAvailability({ prev: false, next: false })
        expect(typeof mediaSession.handlers.previoustrack).toBe('function')
        expect(typeof mediaSession.handlers.nexttrack).toBe('function')

        keys.destroy()
    })

    it('an action the queue cannot serve stays reachable for the platform but changes nothing', () => {
        const onPrev = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev, onNext: vi.fn() })

        keys.setAvailability({ prev: false, next: true })

        // The platform can call us — that is the point of stage 54 — and the neighbour rule refuses inside.
        expect(pressAction('previoustrack')).toBe(true)
        expect(onPrev).not.toHaveBeenCalled()

        keys.destroy()
    })

    it('while this screen plays nothing, the actions are taken away again', () => {
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext: vi.fn() })

        keys.setAvailability({ prev: true, next: true, playing: true })
        expect(typeof mediaSession.handlers.previoustrack).toBe('function')

        keys.setAvailability({ prev: false, next: false, playing: false })
        expect(mediaSession.handlers.previoustrack).toBeNull()
        expect(mediaSession.handlers.nexttrack).toBeNull()

        keys.setAvailability({ prev: true, next: true, playing: true })
        expect(typeof mediaSession.handlers.previoustrack).toBe('function')
        expect(typeof mediaSession.handlers.nexttrack).toBe('function')

        keys.destroy()
    })

    it('the layer says what really arrived and what it did with it (the stage 54 instrument)', () => {
        expect(typeof mediaSessionApi.subscribeMediaKeys).toBe('function')

        const seen = []
        const unsubscribe = mediaSessionApi.subscribeMediaKeys((event) => seen.push(event))
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext: vi.fn() })
        keys.setAvailability({ prev: false, next: true })

        pressKey('MediaTrackNext')
        pressAction('nexttrack') // the same press through the other path
        pressAction('previoustrack') // reachable, but this queue has no neighbour there

        const kinds = seen.map((e) => `${e.action}/${e.path}->${e.result}`)
        expect(kinds).toContain('nexttrack/key->ran')
        expect(kinds).toContain('nexttrack/platform->duplicate')
        expect(kinds).toContain('previoustrack/platform->no-neighbour')

        unsubscribe()
        keys.destroy()
    })

    it('a late subscriber is told the recent history (a screen mounted after the presses)', () => {
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext: vi.fn() })
        pressKey('MediaTrackNext')

        const history = mediaSessionApi.getRecentMediaKeys()
        expect(Array.isArray(history)).toBe(true)
        expect(history.some((e) => e.action === 'nexttrack' && e.path === 'key')).toBe(true)

        const seen = []
        const unsubscribe = mediaSessionApi.subscribeMediaKeys((e) => seen.push(e))
        pressKey('MediaTrackNext')
        expect(seen.some((e) => e.action === 'nexttrack')).toBe(true)
        unsubscribe()
        keys.destroy()
    })

    it('the history is bounded so a long listening session cannot grow without end', () => {
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext: vi.fn() })
        for (let i = 0; i < 40; i += 1) {
            pressKey('MediaTrackNext')
        }
        const history = mediaSessionApi.getRecentMediaKeys()
        expect(history.length).toBeLessThanOrEqual(12)
        expect(history.length).toBeGreaterThan(0)
        keys.destroy()
    })

    it('without a neighbour the keyboard media key is inert as well', () => {
        const onPrev = vi.fn()
        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev, onNext })

        keys.setAvailability({ prev: false, next: false })
        pressKey('MediaTrackPrevious')
        pressKey('MediaTrackNext')

        expect(onPrev).not.toHaveBeenCalled()
        expect(onNext).not.toHaveBeenCalled()

        keys.setAvailability({ prev: true, next: true })
        pressKey('MediaTrackPrevious')
        expect(onPrev).toHaveBeenCalledTimes(1)
        keys.destroy()
    })

    it('destroy takes both paths away (a closed screen must not control a queue)', () => {
        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext })

        keys.destroy()

        expect(mediaSession.handlers.nexttrack).toBeNull()
        expect(mediaSession.handlers.previoustrack).toBeNull()
        pressKey('MediaTrackNext')
        expect(onNext).not.toHaveBeenCalled()
    })

    it('mounting a new owner replaces the previous one', () => {
        const first = vi.fn()
        const second = vi.fn()

        const a = mountTrackMediaKeys({ onPrev: first, onNext: first })
        const b = mountTrackMediaKeys({ onPrev: second, onNext: second })
        a.destroy()

        pressAction('nexttrack')
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
        b.destroy()
    })

    it('works without the media session API: the keyboard path still runs', () => {
        removeFakeMediaSession()

        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext })

        expect(() => pressKey('MediaTrackNext')).not.toThrow()
        expect(onNext).toHaveBeenCalledTimes(1)
        expect(() => keys.setAvailability({ prev: false, next: false })).not.toThrow()
        expect(() => keys.destroy()).not.toThrow()
    })

    it('without the media session API a neighbour rule still applies to the keyboard', () => {
        removeFakeMediaSession()

        const onNext = vi.fn()
        const keys = mountTrackMediaKeys({ onPrev: vi.fn(), onNext })

        keys.setAvailability({ prev: true, next: false })
        pressKey('MediaTrackNext')
        expect(onNext).not.toHaveBeenCalled()
        keys.destroy()
    })

    it('reports the title of the playing item to the platform', () => {
        setMediaSessionMetadata({ title: 'Butterfly.mp4' })

        expect(mediaSession.metadata).not.toBeNull()
        expect(mediaSession.metadata.title).toBe('Butterfly.mp4')
    })

    it('reports the playback state so the platform shows the right control', () => {
        setMediaSessionPlaybackState('playing')
        expect(mediaSession.playbackState).toBe('playing')

        setMediaSessionPlaybackState('paused')
        expect(mediaSession.playbackState).toBe('paused')
    })

    it('clears what the platform was told when nothing plays anymore', () => {
        setMediaSessionMetadata({ title: 'Butterfly.mp4' })
        setMediaSessionPlaybackState('playing')

        clearMediaSession()

        expect(mediaSession.metadata).toBeNull()
        expect(mediaSession.playbackState).toBe('none')
    })

    it('metadata helpers do not throw without the API', () => {
        removeFakeMediaSession()

        expect(() => setMediaSessionMetadata({ title: 'a.mp4' })).not.toThrow()
        expect(() => setMediaSessionPlaybackState('playing')).not.toThrow()
        expect(() => clearMediaSession()).not.toThrow()
    })

    /**
     * Stage 50 — the next round of task 7 (the user's instruction of 2026-11-19 06:26 MSK).
     *
     * Stage 48 was failed on the device: the headset buttons are still silent, while the media keys of the
     * keyboard work as long as the browser is the active application. The remaining difference to YouTube,
     * which the user compares us with, is how complete our session looks to the operating system: YouTube
     * also reports `positionState` (duration, position, playbackRate) and an `artwork` picture, so the OS
     * media controls know what is playing and how far it has got — and offer their own prev/next buttons.
     * These tests describe that half of the contract and are red until stage 51 implements it.
     */
    it('reports the duration, the position and the playback rate to the platform', () => {
        expect(typeof mediaSessionApi.setMediaSessionPositionState).toBe('function')

        mediaSessionApi.setMediaSessionPositionState({ duration: 163.79, positioning: 40, playbackRate: 1.5 })

        expect(mediaSession.positionState).toMatchObject({ duration: 163.79, positioning: 40, playbackRate: 1.5 })
    })

    it('reports a beginning-of-track state when only the duration is known', () => {
        mediaSessionApi.setMediaSessionPositionState({ duration: 163.79 })

        expect(mediaSession.positionState).toMatchObject({ duration: 163.79, positioning: 0, playbackRate: 1 })
    })

    it('reports nothing when the duration is not known', () => {
        // A stream without metadata must not be shown to the OS as a zero-length item.
        mediaSessionApi.setMediaSessionPositionState({ duration: NaN, positioning: 10 })
        mediaSessionApi.setMediaSessionPositionState({ duration: Infinity, positioning: 10 })
        mediaSessionApi.setMediaSessionPositionState({ duration: 0, positioning: 10 })
        mediaSessionApi.setMediaSessionPositionState({ duration: -5, positioning: 10 })

        expect(mediaSession.positionCalls).toHaveLength(0)
        expect(mediaSession.positionState).toBeNull()
    })

    it('clamps a position outside the track so the browser does not reject the whole state', () => {
        // A positioning greater than the duration makes Chromium throw, and then nothing is reported at all.
        mediaSessionApi.setMediaSessionPositionState({ duration: 163.79, positioning: 200 })
        expect(mediaSession.positionState.positioning).toBe(163.79)

        mediaSessionApi.setMediaSessionPositionState({ duration: 163.79, positioning: -5 })
        expect(mediaSession.positionState.positioning).toBe(0)
    })

    it('a missing playbackRate does not become NaN in the platform report', () => {
        mediaSessionApi.setMediaSessionPositionState({ duration: 60, positioning: 10, playbackRate: undefined })
        expect(mediaSession.positionState.playbackRate).toBe(1)

        mediaSessionApi.setMediaSessionPositionState({ duration: 60, positioning: 10, playbackRate: NaN })
        expect(mediaSession.positionState.playbackRate).toBe(1)
    })

    it('does not throw in a browser that has no setPositionState', () => {
        delete mediaSession.setPositionState

        expect(() => mediaSessionApi.setMediaSessionPositionState({ duration: 60 })).not.toThrow()
        expect(() => mediaSessionApi.clearMediaSession()).not.toThrow()
    })

    it('clearing the media session also clears the position the platform was told', () => {
        mediaSessionApi.setMediaSessionPositionState({ duration: 163.79, positioning: 100 })
        expect(mediaSession.positionState).not.toBeNull()

        clearMediaSession()

        expect(mediaSession.positionState).toBeNull()
    })

    it('metadata helpers accept an artwork list (the cover VideoPlayer passes in stage 51)', () => {
        setMediaSessionMetadata({
            title: 'Butterfly.mp4',
            artwork: [{ src: 'data:image/jpeg;base64,FRAME', type: 'image/jpeg' }],
        })

        expect(mediaSession.metadata.artwork).toHaveLength(1)
        expect(mediaSession.metadata.artwork[0].src).toBe('data:image/jpeg;base64,FRAME')
        expect(mediaSession.metadata.artwork[0].type).toBe('image/jpeg')
    })
})
