import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MainView from '../../src/views/MainView.vue'
import { t } from '../../src/i18n'

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
    { id: 3, name: 'Documentaries' },
]

const VIDEOS = [
    { path: '/Concerts/live.mp4', name: 'live.mp4', size: 1, mtime: 1, categoryId: 1 },
    { path: '/Concerts/2019/studio.webm', name: 'studio.webm', size: 1, mtime: 1, categoryId: 1 },
    { path: '/Movies/a.mp4', name: 'a.mp4', size: 1, mtime: 1, categoryId: 2 },
    { path: '/Movies/b.mp4', name: 'b.mp4', size: 1, mtime: 1, categoryId: 2 },
    { path: '/Unsorted/x.mkv', name: 'x.mkv', size: 1, mtime: 1, categoryId: 0 },
    { path: '/Ghost/gone.mp4', name: 'gone.mp4', size: 1, mtime: 1, categoryId: 99 },
]

async function mountScreen(videos = VIDEOS, categories = CATEGORIES, categoriesFail = false) {
    getVideos.mockResolvedValue({ data: { configured: true, subfolders: [], videos, views: {} } })
    if (categoriesFail) {
        getCategories.mockRejectedValue(new Error('the categories table is not there yet'))
    } else {
        getCategories.mockResolvedValue({ data: { categories } })
    }
    const wrapper = mount(MainView)
    await flushPromises()
    return wrapper
}

function filterOptions(wrapper) {
    return wrapper.findAll('.main-view__filter option')
}

function cardTitles(wrapper) {
    return wrapper.findAll('.main-view__card-title').map((el) => el.text())
}

async function playCard(wrapper, index) {
    await wrapper.findAll('.main-view__card-media')[index].trigger('click')
    await flushPromises()
}

function playerSource(wrapper) {
    return wrapper.find('.video-player-mock').attributes()['data-src']
}

/**
 * The Videos screen filter now selects a video category instead of a file extension. A clip belongs
 * to a category through the search folder it was found in (the backend puts that id on every clip),
 * so this screen only needs the id it already received.
 */
describe('MainView.vue — the filter picks a category', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        resetViewCounts()
    })

    it('the toolbar filter is a category select: its options are the reference book, not file formats', async () => {
        const wrapper = await mountScreen()
        const select = wrapper.find('.main-view__filter')

        expect(select.exists()).toBe(true)
        expect(select.element.tagName).toBe('SELECT')
        expect(select.findAll('option').map((o) => o.attributes('value'))).toEqual(['', '1', '2'])
        expect(select.findAll('option').map((o) => o.text())).toEqual([t('allCategories'), 'Music', 'Films'])
        // The old format content is gone: no extension appears among the values.
        expect(select.findAll('option').map((o) => o.attributes('value'))).not.toContain('mp4')
    })

    it('only categories that have clips in the loaded list are offered', async () => {
        const wrapper = await mountScreen()

        // 'Documentaries' exists in the reference book but no loaded clip carries its id.
        expect(filterOptions(wrapper).map((o) => o.text())).toEqual([t('allCategories'), 'Music', 'Films'])
    })

    it('the options follow the order of the reference book, not the order the clips arrived in', async () => {
        const shuffled = [VIDEOS[2], VIDEOS[0], VIDEOS[3], VIDEOS[1]]
        const wrapper = await mountScreen(shuffled)

        expect(filterOptions(wrapper).map((o) => o.text())).toEqual([t('allCategories'), 'Music', 'Films'])
    })

    it('choosing a category leaves only its clips in the list', async () => {
        const wrapper = await mountScreen()
        await wrapper.find('.main-view__filter').setValue('1')
        await flushPromises()

        expect(cardTitles(wrapper)).toEqual(['live', 'studio'])
    })

    it('the empty option ("all categories") brings the whole list back', async () => {
        const wrapper = await mountScreen()
        await wrapper.find('.main-view__filter').setValue('2')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual(['a', 'b'])

        await wrapper.find('.main-view__filter').setValue('')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual(['live', 'studio', 'a', 'b', 'x', 'gone'])
    })

    it('search and the category filter combine (a clip must pass both)', async () => {
        const wrapper = await mountScreen()
        await wrapper.find('.main-view__filter').setValue('2')
        await wrapper.find('.main-view__search').setValue('live')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual([])

        await wrapper.find('.main-view__search').setValue('a')
        await flushPromises()
        expect(cardTitles(wrapper)).toEqual(['a'])
    })

    it('a clip whose folder has no category stays in "all categories" and is never its own option', async () => {
        const wrapper = await mountScreen()

        expect(filterOptions(wrapper).map((o) => o.attributes('value'))).not.toContain('0')
        expect(cardTitles(wrapper)).toContain('x')
    })

    it('a category id that is no longer in the reference book offers nothing and hides nothing', async () => {
        const wrapper = await mountScreen()

        expect(filterOptions(wrapper).map((o) => o.attributes('value'))).not.toContain('99')
        expect(cardTitles(wrapper)).toContain('gone')
    })

    it('a failing category request does not break the list: only "all categories" is offered', async () => {
        const wrapper = await mountScreen(VIDEOS, CATEGORIES, true)

        expect(wrapper.findAll('.main-view__card')).toHaveLength(VIDEOS.length)
        expect(filterOptions(wrapper).map((o) => o.attributes('value'))).toEqual([''])
    })

    it('the neighbour of the playing clip is a neighbour inside its own category', async () => {
        const wrapper = await mountScreen()
        await wrapper.find('.main-view__filter').setValue('2')
        await flushPromises()

        await playCard(wrapper, 0)
        expect(playerSource(wrapper)).toBe('/dav/Movies/a.mp4')
        expect(wrapper.find('.video-player-mock').attributes()['data-has-next']).toBe('true')

        wrapper.findComponent({ name: 'VideoPlayer' }).vm.$emit('next')
        await flushPromises()
        expect(playerSource(wrapper)).toBe('/dav/Movies/b.mp4')

        // The chain of this category is a ring: 'b' is its last clip, and next goes back to its first.
        expect(wrapper.find('.video-player-mock').attributes()['data-has-next']).toBe('true')

        wrapper.findComponent({ name: 'VideoPlayer' }).vm.$emit('next')
        await flushPromises()
        expect(playerSource(wrapper)).toBe('/dav/Movies/a.mp4')
    })
})
