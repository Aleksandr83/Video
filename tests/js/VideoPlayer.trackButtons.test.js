import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPlayer from '../../src/components/VideoPlayer.vue'
import { TRACK_BUTTON_PREV_CLASS, TRACK_BUTTON_NEXT_CLASS } from '../../src/utils/plyrTrackButtons'

const plyrInstances = []

/**
 * Plyr stub with a real controls bar, so the track buttons can be inserted where
 * Plyr would insert them: `player.elements.controls` + `player.elements.buttons.play`.
 */
vi.mock('plyr', () => ({
    __esModule: true,
    default: class MockPlyr {
        constructor(el) {
            this.el = el
            const controls = document.createElement('div')
            controls.className = 'plyr__controls'

            const play = document.createElement('button')
            play.type = 'button'
            play.className = 'plyr__controls__item plyr__control'
            play.setAttribute('data-plyr', 'play')

            const fullscreen = document.createElement('button')
            fullscreen.className = 'plyr__controls__item plyr__control'
            fullscreen.setAttribute('data-plyr', 'fullscreen')

            controls.append(play, fullscreen)
            this.elements = { container: el, controls, buttons: { play: [play] } }
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

function mountPlayer(props = {}) {
    return mount(VideoPlayer, {
        props: { src: '/remote.php/dav/files/testuser/Movies/a.mp4', title: 'a.mp4', ...props },
    })
}

function bar() {
    return plyrInstances[0].elements.controls
}

describe('VideoPlayer.vue — prev/next in the Plyr control row', () => {
    beforeEach(() => {
        localStorage.clear()
        plyrInstances.length = 0
    })

    it('inserts prev and next right after the play button when navigation is available', () => {
        mountPlayer({ hasPrevTrack: true, hasNextTrack: true })

        const items = [...bar().children].map((el) => el.getAttribute('data-video-track'))
        expect(items).toEqual([null, 'prev', 'next', null])
    })

    it('renders nothing when the parent cannot switch tracks', () => {
        mountPlayer()

        expect(bar().querySelectorAll('.plyr__controls__item').length).toBe(2)
        expect(bar().querySelector(`.${TRACK_BUTTON_PREV_CLASS}`)).toBeNull()
    })

    it('renders even one-sided navigation (first track of a queue)', () => {
        mountPlayer({ hasPrevTrack: false, hasNextTrack: true })

        const items = [...bar().children].map((el) => el.getAttribute('data-video-track'))
        expect(items).toEqual([null, 'prev', 'next', null])

        const prev = bar().querySelector(`.${TRACK_BUTTON_PREV_CLASS}`)
        const next = bar().querySelector(`.${TRACK_BUTTON_NEXT_CLASS}`)
        expect(prev.disabled).toBe(true)
        expect(next.disabled).toBe(false)
    })

    it('emits prev and next when the buttons are pressed', async () => {
        const wrapper = mountPlayer({ hasPrevTrack: true, hasNextTrack: true })

        bar().querySelector(`.${TRACK_BUTTON_PREV_CLASS}`).click()
        bar().querySelector(`.${TRACK_BUTTON_NEXT_CLASS}`).click()
        await wrapper.vm.$nextTick()

        const events = wrapper.emitted()
        expect(events.prev).toHaveLength(1)
        expect(events.next).toHaveLength(1)
    })

    it('follows availability when the parent state changes (moving through a queue)', async () => {
        const wrapper = mountPlayer({ hasPrevTrack: false, hasNextTrack: true })
        const prev = bar().querySelector(`.${TRACK_BUTTON_PREV_CLASS}`)

        await wrapper.setProps({ hasPrevTrack: true, hasNextTrack: false })

        expect(prev.disabled).toBe(false)
        expect(bar().querySelector(`.${TRACK_BUTTON_NEXT_CLASS}`).disabled).toBe(true)
    })

    it('removes the buttons when the player is unmounted', () => {
        const wrapper = mountPlayer({ hasPrevTrack: true, hasNextTrack: true })
        expect(bar().querySelectorAll(`.${TRACK_BUTTON_PREV_CLASS}`).length).toBe(1)

        wrapper.unmount()

        expect(bar().querySelectorAll(`.${TRACK_BUTTON_PREV_CLASS}`).length).toBe(0)
        expect(bar().querySelectorAll(`.${TRACK_BUTTON_NEXT_CLASS}`).length).toBe(0)
    })
})
