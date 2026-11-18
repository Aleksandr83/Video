import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import QueuePlayer from '../../src/components/QueuePlayer.vue'

const plyrInstances = []

/**
 * Plyr stub: the close button lives in the VideoPlayer template, not in Plyr's
 * control bar, so an empty bar is enough here.
 */
vi.mock('plyr', () => ({
    __esModule: true,
    default: class MockPlyr {
        constructor(el) {
            const controls = document.createElement('div')
            controls.className = 'plyr__controls'
            this.elements = { container: el, controls, buttons: { play: [] } }
            plyrInstances.push(this)
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

vi.mock('../../src/utils/viewCount', () => ({
    incrementView: vi.fn(),
}))

const items = [
    { path: 'Movies/a.mp4', name: 'a.mp4' },
    { path: 'Movies/b.mp4', name: 'b.mp4' },
]

/**
 * QueuePlayer renders VideoPlayer, so the close button that VideoPlayer draws over
 * the video is only useful if QueuePlayer forwards its `close` event: PlaylistsView
 * listens for `@close` on QueuePlayer. Without the forward the button is dead on
 * the "Playlists" screen (measured in stage 23: emitted was {click} only, no close).
 *
 * The shape tests pin what the user asked for in task 5: an inline SVG icon with an
 * accessible name — not a bare text glyph — while the hit area stays 28x28.
 */
async function mountQueue() {
    const wrapper = mount(QueuePlayer, { props: { items } })
    await wrapper.vm.$nextTick()
    return wrapper
}

describe('QueuePlayer.vue — closing the player', () => {
    beforeEach(() => {
        localStorage.clear()
        plyrInstances.length = 0
    })

    it('the close button over the video is forwarded: QueuePlayer emits close', async () => {
        const wrapper = await mountQueue()

        expect(wrapper.find('.video-player__close').exists()).toBe(true)
        await wrapper.find('.video-player__close').trigger('click')

        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('the close button in the queue row still closes the player', async () => {
        const wrapper = await mountQueue()

        await wrapper.find('.queue-player__close').trigger('click')

        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('both close buttons are icon buttons with an accessible name', async () => {
        const wrapper = await mountQueue()

        for (const selector of ['.video-player__close', '.queue-player__close']) {
            const button = wrapper.find(selector)
            expect(button.exists()).toBe(true)
            expect(button.attributes('aria-label')).toBeTruthy()
            expect(button.attributes('title')).toBeTruthy()
            expect(button.attributes('type')).toBe('button')
            expect(button.find('svg').exists()).toBe(true)
            expect(button.text().trim()).toBe('')
        }
    })

    it('close is emitted once per click (no duplicate close calls)', async () => {
        const wrapper = await mountQueue()

        await wrapper.find('.video-player__close').trigger('click')

        expect(wrapper.emitted('close')).toHaveLength(1)
    })

    /**
     * Nextcloud's core CSS styles every plain `button:not(.button-vue,[class^=vs__])`
     * (min-height 44px, margin 3px, white background on :active, outline: none on
     * :hover/:focus) and wins wherever our rules are less specific. Measured in stage 27.1:
     * the row buttons came out 36x44 shifted by 3px and turned white on mouse press.
     * Those selectors skip `.button-vue`, so every icon button carries it — this test is the
     * guard against losing the exemption by accident.
     */
    it('icon buttons opt out of the Nextcloud core button styles', async () => {
        const wrapper = await mountQueue()

        const rowButtons = wrapper.findAll('.queue-player__icon-btn')
        expect(rowButtons).toHaveLength(5)
        for (const button of [...rowButtons, wrapper.find('.video-player__close')]) {
            expect(button.classes()).toContain('button-vue')
            expect(button.attributes('type')).toBe('button')
        }
    })
})
