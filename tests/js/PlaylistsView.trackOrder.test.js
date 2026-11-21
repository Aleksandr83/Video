import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PlaylistsView from '../../src/views/PlaylistsView.vue'

/**
 * The queue under the video is a view of a saved playlist, so moving a track up/down or removing it has to
 * reach the saved playlist: the screen that owns the playlist answers the intent of QueuePlayer with the API
 * calls it already uses for its own list, and hands the new list back to the queue.
 */
vi.mock('../../src/api/playlists', () => ({
    getPlaylists: vi.fn(),
    getPlaylist: vi.fn(),
    createPlaylist: vi.fn(),
    renamePlaylist: vi.fn(),
    deletePlaylist: vi.fn(),
    addPlaylistItem: vi.fn(),
    removePlaylistItem: vi.fn(),
    reorderPlaylistItems: vi.fn(),
}))

// The queue is mocked: this test is about what PlaylistsView does with the intents it reports.
vi.mock('../../src/components/QueuePlayer.vue', () => ({
    default: {
        name: 'QueuePlayer',
        props: ['items'],
        template: `<div class="queue-player-mock"
                        :data-paths="items.map((i) => i.path).join('|')
                                     + '::' + items.map((i) => i.id).join('|')"></div>`,
    },
}))

import {
    getPlaylists,
    getPlaylist,
    removePlaylistItem,
    reorderPlaylistItems,
} from '../../src/api/playlists'
import QueuePlayer from '../../src/components/QueuePlayer.vue'

const savedItems = [
    { id: 11, path: 'Movies/a.mp4' },
    { id: 12, path: 'Movies/b.mp4' },
    { id: 13, path: 'Movies/c.mp4' },
]

function queueOf(wrapper) {
    return wrapper.findComponent(QueuePlayer)
}

async function mountPlayingPlaylist() {
    getPlaylists.mockResolvedValue({ data: { playlists: [{ id: 7, name: 'Evening' }] } })
    getPlaylist.mockResolvedValue({ data: { items: savedItems.map((i) => ({ ...i })) } })

    const wrapper = mount(PlaylistsView)
    await flushPromises()
    await wrapper.find('.playlists__play').trigger('click')
    await flushPromises()
    return wrapper
}

describe('PlaylistsView — the queue menu changes the saved playlist', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    it('the queue keeps the ids of the saved playlist, so its actions can be persisted', async () => {
        const wrapper = await mountPlayingPlaylist()

        expect(queueOf(wrapper).attributes('data-paths'))
            .toBe('Movies/a.mp4|Movies/b.mp4|Movies/c.mp4::11|12|13')
    })

    it('moving a track up reorders the list the queue sees and stores the new order', async () => {
        const wrapper = await mountPlayingPlaylist()

        queueOf(wrapper).vm.$emit('reorder', { from: 2, to: 1 })
        await flushPromises()

        expect(reorderPlaylistItems).toHaveBeenCalledWith(7, [11, 13, 12])
        expect(queueOf(wrapper).attributes('data-paths'))
            .toBe('Movies/a.mp4|Movies/c.mp4|Movies/b.mp4::11|13|12')
    })

    it('moving a track down reorders the other way', async () => {
        const wrapper = await mountPlayingPlaylist()

        queueOf(wrapper).vm.$emit('reorder', { from: 0, to: 1 })
        await flushPromises()

        expect(reorderPlaylistItems).toHaveBeenCalledWith(7, [12, 11, 13])
        expect(queueOf(wrapper).attributes('data-paths'))
            .toBe('Movies/b.mp4|Movies/a.mp4|Movies/c.mp4::12|11|13')
    })

    it('removing a track takes it out of the queue and asks the server to forget it', async () => {
        const wrapper = await mountPlayingPlaylist()

        queueOf(wrapper).vm.$emit('remove', { index: 1, item: { path: 'Movies/b.mp4', name: 'b.mp4', id: 12 } })
        await flushPromises()

        expect(removePlaylistItem).toHaveBeenCalledWith(7, 12)
        expect(queueOf(wrapper).attributes('data-paths'))
            .toBe('Movies/a.mp4|Movies/c.mp4::11|13')
    })

    it('a saved playlist that is also open in the detail list shows the same order', async () => {
        const wrapper = await mountPlayingPlaylist()
        await wrapper.find('.playlists__open').trigger('click')
        await flushPromises()

        queueOf(wrapper).vm.$emit('reorder', { from: 2, to: 1 })
        await flushPromises()

        const paths = wrapper.findAll('.playlists__item-path').map((el) => el.text())
        expect(paths).toEqual(['Movies/a.mp4', 'Movies/c.mp4', 'Movies/b.mp4'])
    })

    it('when the server refuses the new order, the queue is reloaded from the server instead of lying', async () => {
        const wrapper = await mountPlayingPlaylist()
        reorderPlaylistItems.mockRejectedValueOnce(new Error('save failed'))
        // The reload answers with the order the server really has.
        getPlaylist.mockResolvedValue({ data: { items: savedItems.map((i) => ({ ...i })) } })

        queueOf(wrapper).vm.$emit('reorder', { from: 2, to: 1 })
        await flushPromises()

        expect(queueOf(wrapper).attributes('data-paths'))
            .toBe('Movies/a.mp4|Movies/b.mp4|Movies/c.mp4::11|12|13')
    })
})
