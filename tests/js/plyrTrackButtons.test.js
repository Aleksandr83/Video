import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    mountTrackButtons,
    TRACK_BUTTON_CLASS,
    TRACK_BUTTON_PREV_CLASS,
    TRACK_BUTTON_NEXT_CLASS,
} from '../../src/utils/plyrTrackButtons'

/** Plyr-like markup: a controls bar with a play button and a few other items. */
function buildControlsBar() {
    const controls = document.createElement('div')
    controls.className = 'plyr__controls'

    const play = document.createElement('button')
    play.type = 'button'
    play.className = 'plyr__controls__item plyr__control'
    play.setAttribute('data-plyr', 'play')

    const mute = document.createElement('button')
    mute.type = 'button'
    mute.className = 'plyr__controls__item plyr__control'
    mute.setAttribute('data-plyr', 'mute')

    const fullscreen = document.createElement('button')
    fullscreen.type = 'button'
    fullscreen.className = 'plyr__controls__item plyr__control'
    fullscreen.setAttribute('data-plyr', 'fullscreen')

    controls.append(play, mute, fullscreen)
    return { controls, play }
}

const labels = { prev: 'Previous track', next: 'Next track' }

describe('plyrTrackButtons.js', () => {
    let controls
    let play

    beforeEach(() => {
        const bar = buildControlsBar()
        controls = bar.controls
        play = bar.play
    })

    it('inserts prev and next directly after the play button, in one row', () => {
        mountTrackButtons({ controls, after: play, labels, onPrev: vi.fn(), onNext: vi.fn() })

        const items = [...controls.children]
        expect(items.map((el) => el.getAttribute('data-video-track'))).toEqual([
            null,
            'prev',
            'next',
            null,
            null,
        ])
    })

    it('marks the buttons with the class names the stylesheet relies on', () => {
        mountTrackButtons({ controls, after: play, labels, onPrev: vi.fn(), onNext: vi.fn() })

        const prev = controls.querySelector(`.${TRACK_BUTTON_PREV_CLASS}`)
        const next = controls.querySelector(`.${TRACK_BUTTON_NEXT_CLASS}`)

        expect(prev.classList.contains(TRACK_BUTTON_CLASS)).toBe(true)
        expect(next.classList.contains(TRACK_BUTTON_CLASS)).toBe(true)
        // Plyr's own layout hooks, so the buttons size like the other controls.
        expect(prev.classList.contains('plyr__controls__item')).toBe(true)
        expect(prev.classList.contains('plyr__control')).toBe(true)
    })

    it('activates the callbacks on click', () => {
        const onPrev = vi.fn()
        const onNext = vi.fn()
        mountTrackButtons({ controls, after: play, labels, onPrev, onNext })

        controls.querySelector(`.${TRACK_BUTTON_PREV_CLASS}`).click()
        controls.querySelector(`.${TRACK_BUTTON_NEXT_CLASS}`).click()

        expect(onPrev).toHaveBeenCalledTimes(1)
        expect(onNext).toHaveBeenCalledTimes(1)
    })

    it('labels the buttons for screen readers and native tooltips', () => {
        mountTrackButtons({ controls, after: play, labels, onPrev: vi.fn(), onNext: vi.fn() })

        const prev = controls.querySelector(`.${TRACK_BUTTON_PREV_CLASS}`)
        const next = controls.querySelector(`.${TRACK_BUTTON_NEXT_CLASS}`)

        expect(prev.getAttribute('aria-label')).toBe(labels.prev)
        expect(prev.getAttribute('title')).toBe(labels.prev)
        expect(next.getAttribute('aria-label')).toBe(labels.next)
        expect(next.getAttribute('title')).toBe(labels.next)
    })

    it('gives the buttons their own icons instead of borrowing missing sprite symbols', () => {
        mountTrackButtons({ controls, after: play, labels, onPrev: vi.fn(), onNext: vi.fn() })

        const prev = controls.querySelector(`.${TRACK_BUTTON_PREV_CLASS}`)
        expect(prev.querySelector('svg')).not.toBeNull()
        expect(prev.querySelector('use')).toBeNull()
    })

    it('setAvailability() disables and re-enables each button', () => {
        const track = mountTrackButtons({ controls, after: play, labels, onPrev: vi.fn(), onNext: vi.fn() })
        const prev = controls.querySelector(`.${TRACK_BUTTON_PREV_CLASS}`)
        const next = controls.querySelector(`.${TRACK_BUTTON_NEXT_CLASS}`)

        track.setAvailability({ prev: false, next: true })
        expect(prev.disabled).toBe(true)
        expect(prev.getAttribute('aria-disabled')).toBe('true')
        expect(next.disabled).toBe(false)

        track.setAvailability({ prev: true, next: false })
        expect(prev.disabled).toBe(false)
        expect(next.disabled).toBe(true)
    })

    it('a disabled button does not call its callback', () => {
        const onPrev = vi.fn()
        const track = mountTrackButtons({ controls, after: play, labels, onPrev, onNext: vi.fn() })
        track.setAvailability({ prev: false, next: true })

        const prev = controls.querySelector(`.${TRACK_BUTTON_PREV_CLASS}`)
        prev.click()
        expect(onPrev).not.toHaveBeenCalled()

        // A synthetic dispatchEvent bypasses the `disabled` guard of the browser,
        // so the handler must check the availability itself.
        prev.dispatchEvent(new Event('click'))
        expect(onPrev).not.toHaveBeenCalled()
    })

    it('does not register the same click handler twice when mounted twice', () => {
        const onPrev = vi.fn()
        mountTrackButtons({ controls, after: play, labels, onPrev, onNext: vi.fn() })
        mountTrackButtons({ controls, after: play, labels, onPrev, onNext: vi.fn() })

        const prevButtons = controls.querySelectorAll(`.${TRACK_BUTTON_PREV_CLASS}`)
        expect(prevButtons.length).toBe(1)

        prevButtons[0].click()
        expect(onPrev).toHaveBeenCalledTimes(1)
    })

    it('destroy() removes both buttons and leaves the other controls alone', () => {
        const track = mountTrackButtons({ controls, after: play, labels, onPrev: vi.fn(), onNext: vi.fn() })
        track.destroy()

        expect(controls.querySelectorAll(`.${TRACK_BUTTON_CLASS}`).length).toBe(0)
        expect([...controls.children]).toEqual([play, controls.querySelector('[data-plyr="mute"]'), controls.querySelector('[data-plyr="fullscreen"]')])
    })

    it('is a no-op when there is no controls bar (controls disabled in Plyr)', () => {
        const track = mountTrackButtons({ controls: null, after: null, labels, onPrev: vi.fn(), onNext: vi.fn() })

        expect(() => track.setAvailability({ prev: true, next: true })).not.toThrow()
        expect(() => track.destroy()).not.toThrow()
    })

    it('appends the buttons at the end when the play button is missing', () => {
        const withoutPlay = document.createElement('div')
        withoutPlay.className = 'plyr__controls'

        mountTrackButtons({ controls: withoutPlay, after: null, labels, onPrev: vi.fn(), onNext: vi.fn() })

        expect(withoutPlay.children.length).toBe(2)
        expect(withoutPlay.children[0].getAttribute('data-video-track')).toBe('prev')
        expect(withoutPlay.children[1].getAttribute('data-video-track')).toBe('next')
    })
})
