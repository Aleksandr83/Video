import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import QueuePlayer from '../../src/components/QueuePlayer.vue'
import VideoPlayer from '../../src/components/VideoPlayer.vue'

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

/**
 * The player only draws prev/next; QueuePlayer decides whether a neighbour
 * exists. These tests pin that decision, because it is what the user sees in
 * the fullscreen control row.
 */
function mountQueue() {
    return mount(QueuePlayer, {
        props: { items },
        shallow: true,
    })
}

function playerProps(wrapper) {
    return wrapper.findComponent(VideoPlayer).props()
}

describe('QueuePlayer.vue — track navigation for the player', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('offers no previous track at the start of the queue', async () => {
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        const props = playerProps(wrapper)
        expect(props.hasPrevTrack).toBe(false)
        expect(props.hasNextTrack).toBe(true)
    })

    it('offers both neighbours in the middle of the queue', async () => {
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        // Buttons under the player drive the same state the player buttons use.
        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.vm.$nextTick()

        const props = playerProps(wrapper)
        expect(props.hasPrevTrack).toBe(true)
        expect(props.hasNextTrack).toBe(true)
    })

    it('offers no next track at the end of the queue (repeat off)', async () => {
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.vm.$nextTick()

        const props = playerProps(wrapper)
        expect(props.hasPrevTrack).toBe(true)
        expect(props.hasNextTrack).toBe(false)
    })

    it('offers a next track at the end when the queue repeats', async () => {
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.find('.queue-player__repeat').trigger('click')
        await wrapper.vm.$nextTick()

        expect(playerProps(wrapper).hasNextTrack).toBe(true)
    })

    // ---- Task 6 (stage 31): the same neighbour rule must drive the row buttons
    // and the media keys, and `prev` has to wrap back when the queue repeats.

    it('offers a previous track at the start when the queue repeats, and it is the last track', async () => {
        localStorage.setItem('video-queue-repeat', '1')
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        expect(playerProps(wrapper).hasPrevTrack).toBe(true)

        await wrapper.find('.queue-player__prev').trigger('click')
        await wrapper.vm.$nextTick()

        expect(playerProps(wrapper).src).toBe('/dav/Movies/c.mp4')
        expect(wrapper.find('.queue-player__current').text()).toBe('c.mp4')
    })

    it('disables the row buttons wherever the player has no neighbour (one rule for both)', async () => {
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        // First track, repeat off: no previous neighbour.
        expect(wrapper.find('.queue-player__prev').element.disabled).toBe(true)
        expect(wrapper.find('.queue-player__next').element.disabled).toBe(false)

        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.queue-player__prev').element.disabled).toBe(false)
        expect(wrapper.find('.queue-player__next').element.disabled).toBe(false)

        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.queue-player__prev').element.disabled).toBe(false)
        expect(wrapper.find('.queue-player__next').element.disabled).toBe(true)
    })

    it('keeps the playing window on the last track when repeat is off', async () => {
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.vm.$nextTick()

        // The button is disabled; even a dispatched click must not end the queue.
        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.vm.$nextTick()

        expect(wrapper.findComponent(VideoPlayer).exists()).toBe(true)
        expect(wrapper.find('.queue-player__current').text()).toBe('c.mp4')
    })

    it('MediaTrackNext does not end the queue when repeat is off', async () => {
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.vm.$nextTick()

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'MediaTrackNext' }))
        await wrapper.vm.$nextTick()

        expect(wrapper.findComponent(VideoPlayer).exists()).toBe(true)
        expect(wrapper.find('.queue-player__current').text()).toBe('c.mp4')

        wrapper.unmount()
    })

    it('MediaTrackNext wraps back to the first track when repeat is on', async () => {
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.find('.queue-player__next').trigger('click')
        await wrapper.find('.queue-player__repeat').trigger('click')
        await wrapper.vm.$nextTick()

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'MediaTrackNext' }))
        await wrapper.vm.$nextTick()

        expect(wrapper.find('.queue-player__current').text()).toBe('a.mp4')

        wrapper.unmount()
    })

    it('MediaTrackPrevious does nothing at the first track when repeat is off', async () => {
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'MediaTrackPrevious' }))
        await wrapper.vm.$nextTick()

        expect(wrapper.find('.queue-player__current').text()).toBe('a.mp4')

        wrapper.unmount()
    })

    it('MediaTrackPrevious wraps to the last track when repeat is on', async () => {
        localStorage.setItem('video-queue-repeat', '1')
        const wrapper = mountQueue()
        await wrapper.vm.$nextTick()

        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'MediaTrackPrevious' }))
        await wrapper.vm.$nextTick()

        expect(wrapper.find('.queue-player__current').text()).toBe('c.mp4')

        wrapper.unmount()
    })
})
