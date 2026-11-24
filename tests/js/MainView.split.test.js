import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MainView from '../../src/views/MainView.vue'

vi.mock('../../src/api/videos', () => ({
    getVideos: vi.fn(),
}))

// MainView reads the category reference book for its filter select; the screen under test does not
// care about its contents, so the call is answered with an empty list instead of a real request.
vi.mock('../../src/api/categories', () => ({
    getCategories: vi.fn(() => Promise.resolve({ data: { categories: [] } })),
}))

vi.mock('../../src/utils/videoUrl', () => ({
    davFileUrl: (path) => `/dav${String(path).startsWith('/') ? '' : '/'}${path}`,
}))

vi.mock('../../src/utils/resume', () => ({
    clearPosition: vi.fn(),
    loadPosition: vi.fn(() => 0),
    savePosition: vi.fn(),
}))

// The player of MainView is a stub that reports its src in the markup, so a test can tell which clip
// the screen is playing without a real Plyr.
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
    { path: '/Movies/b.mp4', name: 'b.mp4', size: 1, mtime: 1 },
    { path: '/Movies/c.mp4', name: 'c.mp4', size: 1, mtime: 1 },
]

async function mountWithVideos(list, subfolders = []) {
    getVideos.mockResolvedValue({ data: { configured: true, subfolders, videos: list, views: {} } })
    const wrapper = mount(MainView)
    await flushPromises()
    return wrapper
}

function rootClasses(wrapper) {
    return wrapper.find('.main-view').classes()
}

async function playCard(wrapper, index) {
    await wrapper.findAll('.main-view__card-media')[index].trigger('click')
    await flushPromises()
}

function markedCards(wrapper) {
    return wrapper.findAll('.main-view__card')
        .map((card, index) => (card.classes().includes('main-view__card--playing') ? index : -1))
        .filter((index) => index >= 0)
}

function emitFromPlayer(wrapper, event) {
    wrapper.findComponent({ name: 'VideoPlayer' }).vm.$emit(event)
    return flushPromises()
}

function playerSrc(wrapper) {
    return wrapper.find('.video-player-mock').attributes()['data-src']
}

/**
 * Watching one clip on the "Videos" screen of a touch device splits the screen into two bands:
 * the player on top, the clip list scrolling below it. The DOM contract this layout needs:
 * the clip list (folders, cards, hint) lives in its own region, the screen marks the playing state
 * with a root class the stylesheet reacts to, and the card of the playing clip is marked in the list.
 */
describe('MainView.vue — the screen split while a clip plays', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetViewCounts()
    })

    it('the clip list lives in a region of its own, even when nothing plays', async () => {
        const wrapper = await mountWithVideos(videos)
        const listRegion = wrapper.find('.main-view__list')
        expect(listRegion.exists()).toBe(true)
        expect(listRegion.find('.main-view__grid').exists()).toBe(true)
        expect(listRegion.findAll('.main-view__card')).toHaveLength(videos.length)
    })

    it('folder chips are not rendered in the list region, even when the API returns subfolders', async () => {
        const wrapper = await mountWithVideos(videos, ['/Movies/Series'])
        const listRegion = wrapper.find('.main-view__list')
        expect(listRegion.findAll('.main-view__folder-btn')).toHaveLength(0)
        expect(listRegion.findAll('.main-view__folders')).toHaveLength(0)
        expect(wrapper.findAll('.main-view__card')).toHaveLength(videos.length)
    })

    it('there is no folder-navigation button on this screen', async () => {
        const wrapper = await mountWithVideos(videos, ['/Movies/Series'])
        expect(wrapper.find('.main-view__up').exists()).toBe(false)
    })

    it('an empty folder shows the hint even when subfolders exist', async () => {
        const wrapper = await mountWithVideos([], ['/Movies/Series'])
        expect(wrapper.find('.main-view__empty').exists()).toBe(true)
    })

    it('no split mark while nothing plays', async () => {
        const wrapper = await mountWithVideos(videos)
        expect(rootClasses(wrapper)).not.toContain('main-view--playing')
        expect(markedCards(wrapper)).toEqual([])
    })

    it('a picked clip marks the screen as playing', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 1)
        expect(rootClasses(wrapper)).toContain('main-view--playing')
    })

    it('the card of the playing clip carries the playing mark, the others do not', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 2)
        expect(markedCards(wrapper)).toEqual([2])
    })

    it('closing the player clears both marks and the list region stays', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 1)
        await emitFromPlayer(wrapper, 'close')
        expect(rootClasses(wrapper)).not.toContain('main-view--playing')
        expect(markedCards(wrapper)).toEqual([])
        expect(wrapper.find('.main-view__list').exists()).toBe(true)
        expect(wrapper.findAll('.main-view__card')).toHaveLength(videos.length)
    })

    it('a prev/next move carries the mark to the neighbour card', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 1)
        await emitFromPlayer(wrapper, 'next')
        expect(playerSrc(wrapper)).toBe('/dav/Movies/c.mp4')
        expect(markedCards(wrapper)).toEqual([2])
        expect(rootClasses(wrapper)).toContain('main-view--playing')

        await emitFromPlayer(wrapper, 'prev')
        await emitFromPlayer(wrapper, 'prev')
        expect(playerSrc(wrapper)).toBe('/dav/Movies/a.mp4')
        expect(markedCards(wrapper)).toEqual([0])
    })

    it('auto-advance after an ended clip keeps the split mark and marks the next card', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 0)
        await emitFromPlayer(wrapper, 'ended')
        expect(playerSrc(wrapper)).toBe('/dav/Movies/b.mp4')
        expect(markedCards(wrapper)).toEqual([1])
        expect(rootClasses(wrapper)).toContain('main-view--playing')
    })

    it('a card tapped while another clip plays moves the mark, the screen stays split', async () => {
        const wrapper = await mountWithVideos(videos)
        await playCard(wrapper, 0)
        await playCard(wrapper, 2)
        expect(rootClasses(wrapper)).toContain('main-view--playing')
        expect(markedCards(wrapper)).toEqual([2])
        expect(playerSrc(wrapper)).toBe('/dav/Movies/c.mp4')
    })
})
