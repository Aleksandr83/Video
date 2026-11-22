import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MainView from '../../src/views/MainView.vue'

vi.mock('../../src/api/videos', () => ({
    getVideos: vi.fn(),
}))

vi.mock('../../src/utils/videoUrl', () => ({
    davFileUrl: (path) => `/dav${String(path).startsWith('/') ? '' : '/'}${path}`,
}))

vi.mock('../../src/utils/resume', () => ({
    clearPosition: vi.fn(),
    loadPosition: vi.fn(() => 0),
    savePosition: vi.fn(),
}))

vi.mock('../../src/components/VideoPlayer.vue', () => ({
    default: {
        name: 'VideoPlayer',
        props: ['src', 'title', 'trackKey', 'resume', 'hasPrevTrack', 'hasNextTrack'],
        template: '<div class="video-player-mock" :data-src="src"></div>',
    },
}))

vi.mock('../../src/components/VideoThumb.vue', () => ({
    default: { name: 'VideoThumb', props: ['path'], template: '<div class="video-thumb-mock"></div>' },
}))

vi.mock('../../src/components/AddToPlaylist.vue', () => ({
    default: { name: 'AddToPlaylist', props: ['path'], template: '<button class="add-to-playlist-mock"></button>' },
}))

import { getVideos } from '../../src/api/videos'
import { resetViewCounts } from '../../src/utils/viewCount'

const videos = [
    { path: '/Movies/a.mp4', name: 'a.mp4', size: 1, mtime: 1 },
    { path: '/Movies/b.webm', name: 'b.webm', size: 1, mtime: 1 },
    { path: '/Movies/c.mkv', name: 'c.mkv', size: 1, mtime: 1 },
]

async function mountWithVideos(list, subfolders = []) {
    getVideos.mockResolvedValue({ data: { configured: true, subfolders, videos: list, views: {} } })
    const wrapper = mount(MainView)
    await flushPromises()
    return wrapper
}

function cardTitles(wrapper) {
    return wrapper.findAll('.main-view__card-title').map((el) => el.text())
}

/**
 * The format filter STAYS on the Videos screen (its content will be replaced later, when the new
 * filter feature is ready; the current one is kept until then). These tests are the insurance for
 * the moment when the toolbar is rearranged for phones: the filter element, its options and its
 * filtering effect must survive the layout change.
 */
describe('MainView.vue — the format filter stays (insurance for the toolbar rearrangement)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetViewCounts()
    })

    it('the filter select is rendered in the toolbar with the extension options', async () => {
        const wrapper = await mountWithVideos(videos)
        const filter = wrapper.find('.main-view__filter')
        expect(filter.exists()).toBe(true)
        expect(filter.element.tagName).toBe('SELECT')
        expect(filter.findAll('option').map((o) => o.attributes('value'))).toEqual(['', 'mkv', 'mp4', 'webm'])
    })

    it('choosing an extension leaves only its clips in the list', async () => {
        const wrapper = await mountWithVideos(videos)
        await wrapper.find('.main-view__filter').setValue('webm')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual(['b'])
    })

    it('the empty option ("all formats") brings the whole list back', async () => {
        const wrapper = await mountWithVideos(videos)
        await wrapper.find('.main-view__filter').setValue('mkv')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual(['c'])
        await wrapper.find('.main-view__filter').setValue('')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual(['a', 'b', 'c'])
    })

    it('search and the filter combine (a clip must pass both)', async () => {
        const wrapper = await mountWithVideos(videos)
        await wrapper.find('.main-view__search').setValue('a')
        await wrapper.find('.main-view__filter').setValue('webm')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual([])
        await wrapper.find('.main-view__filter').setValue('mp4')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual(['a'])
    })
})
