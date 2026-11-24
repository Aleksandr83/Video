import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MainView from '../../src/views/MainView.vue'

vi.mock('../../src/api/videos', () => ({
    getVideos: vi.fn(),
}))

vi.mock('../../src/api/categories', () => ({
    getCategories: vi.fn(),
}))

vi.mock('../../src/utils/videoUrl', () => ({
    davFileUrl: (path) => `/dav${String(path).startsWith('/') ? '' : '/'}${path}`,
}))

vi.mock('../../src/utils/resume', () => ({
    clearPosition: vi.fn(),
    loadPosition: vi.fn(() => 0),
    savePosition: vi.fn(),
}))

/**
 * The headset path is captured here instead of being faked through navigator.mediaSession: this file
 * only needs to know which neighbour the media-key handlers were given, and that it is the same
 * neighbour the player buttons use.
 */
let mediaKeysHandlers = null
vi.mock('../../src/utils/mediaSession', () => ({
    mountTrackMediaKeys: vi.fn((handlers) => {
        mediaKeysHandlers = handlers

        return { setAvailability: vi.fn(), destroy: vi.fn() }
    }),
}))

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
import { getCategories } from '../../src/api/categories'
import { resetViewCounts } from '../../src/utils/viewCount'

const CATEGORIES = [
    { id: 1, name: 'Music' },
    { id: 2, name: 'Films' },
    { id: 3, name: 'Animation' },
]

const VIDEOS = [
    { path: '/Concerts/song-1.mp4', name: 'song-1.mp4', size: 1, mtime: 1, categoryId: 1 },
    { path: '/Concerts/2019/song-2.webm', name: 'song-2.webm', size: 1, mtime: 1, categoryId: 1 },
    { path: '/Movies/film-1.mp4', name: 'film-1.mp4', size: 1, mtime: 1, categoryId: 2 },
    { path: '/Movies/film-2.mp4', name: 'film-2.mp4', size: 1, mtime: 1, categoryId: 2 },
    { path: '/Unsorted/loose-1.mkv', name: 'loose-1.mkv', size: 1, mtime: 1, categoryId: 0 },
    { path: '/Unsorted/loose-2.mkv', name: 'loose-2.mkv', size: 1, mtime: 1, categoryId: 0 },
    { path: '/Studio/only.mp4', name: 'only.mp4', size: 1, mtime: 1, categoryId: 3 },
]

async function mountScreen(videos = VIDEOS) {
    getVideos.mockResolvedValue({ data: { configured: true, subfolders: [], videos, views: {} } })
    getCategories.mockResolvedValue({ data: { categories: CATEGORIES } })
    const wrapper = mount(MainView)
    await flushPromises()
    return wrapper
}

function cardTitles(wrapper) {
    return wrapper.findAll('.main-view__card-title').map((el) => el.text())
}

async function playCard(wrapper, index) {
    await wrapper.findAll('.main-view__card-media')[index].trigger('click')
    await flushPromises()
}

function player(wrapper) {
    return wrapper.find('.video-player-mock')
}

function playerSource(wrapper) {
    return player(wrapper).attributes()['data-src']
}

function availability(wrapper) {
    const attributes = player(wrapper).attributes()

    return { hasPrevTrack: attributes['data-has-prev'], hasNextTrack: attributes['data-has-next'] }
}

async function emitFromPlayer(wrapper, event) {
    wrapper.findComponent({ name: 'VideoPlayer' }).vm.$emit(event)
    await flushPromises()
}

/**
 * Chosen by the user before this code: the next clip of a playing clip must belong to the category of
 * the playing clip, not to the state of the toolbar filter; the chain runs as a ring forward (its end
 * wraps to its beginning) and does not wrap backward; clips without a category chain among themselves;
 * a chain of a single clip has no neighbour at all; the visible list and the filter are not touched.
 */
describe('MainView.vue — the neighbour chain follows the category of the playing clip', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetViewCounts()
        mediaKeysHandlers = null
    })

    it('auto-advance from the last clip of its category wraps to the first clip of that category', async () => {
        const wrapper = await mountScreen()
        await playCard(wrapper, 1)
        expect(playerSource(wrapper)).toBe('/dav/Concerts/2019/song-2.webm')

        await emitFromPlayer(wrapper, 'ended')

        expect(playerSource(wrapper)).toBe('/dav/Concerts/song-1.mp4')
    })

    it('auto-advance from the first clip of a category goes to the second clip of that category', async () => {
        const wrapper = await mountScreen()
        await playCard(wrapper, 0)

        await emitFromPlayer(wrapper, 'ended')

        expect(playerSource(wrapper)).toBe('/dav/Concerts/2019/song-2.webm')
    })

    it('clips without a category chain among clips without a category', async () => {
        const wrapper = await mountScreen()
        await playCard(wrapper, 4)

        await emitFromPlayer(wrapper, 'ended')

        expect(playerSource(wrapper)).toBe('/dav/Unsorted/loose-2.mkv')
    })

    it('the chain of clips without a category wraps at its end as well', async () => {
        const wrapper = await mountScreen()
        await playCard(wrapper, 5)

        await emitFromPlayer(wrapper, 'ended')

        expect(playerSource(wrapper)).toBe('/dav/Unsorted/loose-1.mkv')
    })

    it('the only clip of its category has no neighbour: no prev, no next, and its end closes the player', async () => {
        const wrapper = await mountScreen()
        await playCard(wrapper, 6)

        expect(availability(wrapper)).toEqual({ hasPrevTrack: 'false', hasNextTrack: 'false' })

        await emitFromPlayer(wrapper, 'ended')

        expect(player(wrapper).exists()).toBe(false)
    })

    it('next is offered at the last clip of a multi-clip category because the chain is a ring', async () => {
        const wrapper = await mountScreen()
        await playCard(wrapper, 3)

        expect(availability(wrapper)).toEqual({ hasPrevTrack: 'true', hasNextTrack: 'true' })

        await emitFromPlayer(wrapper, 'next')

        expect(playerSource(wrapper)).toBe('/dav/Movies/film-1.mp4')
    })

    it('prev is not offered at the first clip of a category and pressing it there changes nothing', async () => {
        const wrapper = await mountScreen()
        await playCard(wrapper, 0)

        expect(availability(wrapper).hasPrevTrack).toBe('false')

        await emitFromPlayer(wrapper, 'prev')

        expect(playerSource(wrapper)).toBe('/dav/Concerts/song-1.mp4')
    })

    it('a chain jump leaves the visible card list and the filter value untouched', async () => {
        const wrapper = await mountScreen()
        const before = cardTitles(wrapper)

        await playCard(wrapper, 1)
        await emitFromPlayer(wrapper, 'ended')

        expect(cardTitles(wrapper)).toEqual(before)
        expect(wrapper.find('.main-view__filter').element.value).toBe('')
    })

    it('a search query narrows the chain, and the narrowed chain still wraps', async () => {
        const wrapper = await mountScreen()
        await wrapper.find('.main-view__search').setValue('song-')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual(['song-1', 'song-2'])

        await playCard(wrapper, 1)
        await emitFromPlayer(wrapper, 'ended')

        expect(playerSource(wrapper)).toBe('/dav/Concerts/song-1.mp4')
    })

    it('the headset next path is given the same neighbour as the player buttons', async () => {
        const wrapper = await mountScreen()
        await playCard(wrapper, 1)
        expect(mediaKeysHandlers).not.toBeNull()

        mediaKeysHandlers.onNext()
        await flushPromises()

        expect(playerSource(wrapper)).toBe('/dav/Concerts/song-1.mp4')
    })

    it('the headset previous path changes nothing at the first clip of a category', async () => {
        const wrapper = await mountScreen()
        await playCard(wrapper, 0)

        mediaKeysHandlers.onPrev()
        await flushPromises()

        expect(playerSource(wrapper)).toBe('/dav/Concerts/song-1.mp4')
    })
})
