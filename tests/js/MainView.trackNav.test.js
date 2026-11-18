import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MainView from '../../src/views/MainView.vue'

vi.mock('../../src/api/videos', () => ({
    getVideos: vi.fn(),
}))

vi.mock('../../src/utils/videoUrl', () => ({
    davFileUrl: (path) => `/dav${String(path).startsWith('/') ? '' : '/'}${path}`,
}))

// MainView drops the saved position of the clip it navigates to manually, so the
// clip starts from the beginning. The spy below lets a test assert exactly that.
vi.mock('../../src/utils/resume', () => ({
    clearPosition: vi.fn(),
    loadPosition: vi.fn(() => 0),
    savePosition: vi.fn(),
}))

// The player of MainView is a stub that reports the two availability props in its
// markup: those props are what makes prev/next appear in the fullscreen control row.
vi.mock('../../src/components/VideoPlayer.vue', () => ({
    default: {
        name: 'VideoPlayer',
        props: ['src', 'title', 'trackKey', 'resume', 'hasPrevTrack', 'hasNextTrack'],
        template: `<div class="video-player-mock"
                        :data-src="src"
                        :data-has-prev="String(hasPrevTrack)"
                        :data-has-next="String(hasNextTrack)"></div>`,
    },
}))

vi.mock('../../src/components/VideoThumb.vue', () => ({
    default: { name: 'VideoThumb', props: ['path'], template: '<div class="video-thumb-mock"></div>' },
}))

vi.mock('../../src/components/AddToPlaylist.vue', () => ({
    default: { name: 'AddToPlaylist', props: ['path'], template: '<button class="add-to-playlist-mock"></button>' },
}))

import { getVideos } from '../../src/api/videos'
import { clearPosition } from '../../src/utils/resume'
import { resetViewCounts } from '../../src/utils/viewCount'

const videos = [
    { path: '/Movies/a.mp4', name: 'a.mp4', size: 1, mtime: 1 },
    { path: '/Movies/b.mp4', name: 'b.mp4', size: 1, mtime: 1 },
    { path: '/Movies/c.mp4', name: 'c.mp4', size: 1, mtime: 1 },
]

/**
 * On the "Videos" screen there is no queue: the list of cards is the playlist. The
 * fullscreen prev/next buttons are fed by MainView's hasPrevTrack/hasNextTrack, so
 * these tests pin down which neighbour MainView considers reachable.
 */
async function mountWithVideos(list) {
    getVideos.mockResolvedValue({ data: { configured: true, subfolders: [], videos: list } })
    const wrapper = mount(MainView)
    await flushPromises()
    return wrapper
}

function player(wrapper) {
    return wrapper.find('.video-player-mock')
}

function availability(wrapper) {
    const attrs = player(wrapper).attributes()
    return { hasPrevTrack: attrs['data-has-prev'], hasNextTrack: attrs['data-has-next'] }
}

async function playCard(wrapper, index) {
    await wrapper.findAll('.main-view__card-media')[index].trigger('click')
    await flushPromises()
}

function emitFromPlayer(wrapper, event) {
    wrapper.findComponent({ name: 'VideoPlayer' }).vm.$emit(event)
    return flushPromises()
}

describe('MainView.vue — availability of fullscreen prev/next', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetViewCounts()
    })

    it('first clip of the list: prev is unavailable, next is available', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 0)

        expect(availability(wrapper)).toEqual({ hasPrevTrack: 'false', hasNextTrack: 'true' })
    })

    it('middle clip: both prev and next are available', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 1)

        expect(availability(wrapper)).toEqual({ hasPrevTrack: 'true', hasNextTrack: 'true' })
    })

    it('last clip of the list: prev is available, next is unavailable', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 2)

        expect(availability(wrapper)).toEqual({ hasPrevTrack: 'true', hasNextTrack: 'false' })
    })

    it('a single clip in the list has no neighbours at all', async () => {
        const wrapper = await mountWithVideos([videos[0]])
        await playCard(wrapper, 0)

        expect(availability(wrapper)).toEqual({ hasPrevTrack: 'false', hasNextTrack: 'false' })
    })

    it('availability follows the filtered list, not the raw one', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 2)
        expect(availability(wrapper)).toEqual({ hasPrevTrack: 'true', hasNextTrack: 'false' })

        // Filter the list so that only the playing clip is left in it.
        await wrapper.find('.main-view__search').setValue('c.mp4')
        await flushPromises()

        expect(availability(wrapper)).toEqual({ hasPrevTrack: 'false', hasNextTrack: 'false' })
    })

    it('the prev/next events move to the neighbour and drop its saved position', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 1)

        await emitFromPlayer(wrapper, 'next')
        expect(player(wrapper).attributes()['data-src']).toBe('/dav/Movies/c.mp4')
        expect(clearPosition).toHaveBeenCalledWith('/Movies/c.mp4')

        await emitFromPlayer(wrapper, 'prev')
        await emitFromPlayer(wrapper, 'prev')
        expect(player(wrapper).attributes()['data-src']).toBe('/dav/Movies/a.mp4')
        expect(clearPosition).toHaveBeenCalledWith('/Movies/a.mp4')
        // a.mp4 is the first clip now: prev must go away again
        expect(availability(wrapper)).toEqual({ hasPrevTrack: 'false', hasNextTrack: 'true' })
    })

    it('prev at the first clip and next at the last clip change nothing', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 0)

        await emitFromPlayer(wrapper, 'prev')
        expect(player(wrapper).attributes()['data-src']).toBe('/dav/Movies/a.mp4')

        await playCard(wrapper, 2)
        await emitFromPlayer(wrapper, 'next')
        expect(player(wrapper).attributes()['data-src']).toBe('/dav/Movies/c.mp4')
        expect(clearPosition).not.toHaveBeenCalled()
    })
})
