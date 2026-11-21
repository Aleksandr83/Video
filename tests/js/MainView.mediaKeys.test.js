import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MainView from '../../src/views/MainView.vue'
import { mount, flushPromises } from '@vue/test-utils'

/**
 * Task 7 on the "Videos" screen: here the card list is the playlist, and the media keys of a headset
 * must walk it the same way the fullscreen prev/next buttons do (stage 43: no action handlers exist, so
 * the headset is silent; YouTube registers them, which is why it works there).
 */
vi.mock('../../src/api/videos', () => ({ getVideos: vi.fn() }))
vi.mock('../../src/utils/videoUrl', () => ({ davFileUrl: (p) => `/dav${p}` }))
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
    default: { name: 'VideoThumb', props: ['path'], template: '<div></div>' },
}))
vi.mock('../../src/components/AddToPlaylist.vue', () => ({
    default: { name: 'AddToPlaylist', props: ['path'], template: '<button></button>' },
}))

import { getVideos } from '../../src/api/videos'

const videos = [
    { path: '/Movies/a.mp4', name: 'a.mp4', size: 1, mtime: 1 },
    { path: '/Movies/b.mp4', name: 'b.mp4', size: 1, mtime: 1 },
    { path: '/Movies/c.mp4', name: 'c.mp4', size: 1, mtime: 1 },
]

let mediaSession

function installFakeMediaSession() {
    mediaSession = {
        handlers: {},
        metadata: null,
        playbackState: null,
        setActionHandler(action, handler) { this.handlers[action] = handler },
    }
    Object.defineProperty(window.navigator, 'mediaSession', { configurable: true, value: mediaSession })
    class FakeMediaMetadata {
        constructor({ title = '', artist = '', album = '', artwork = [] } = {}) {
            Object.assign(this, { title, artist, album, artwork })
        }
    }
    Object.defineProperty(window, 'MediaMetadata', { configurable: true, value: FakeMediaMetadata })
}

function removeFakeMediaSession() {
    delete window.navigator.mediaSession
    delete window.MediaMetadata
}

async function openVideos() {
    getVideos.mockResolvedValue({ data: { configured: true, subfolders: [], videos } })
    const wrapper = mount(MainView)
    await flushPromises()
    return wrapper
}

function playingSrc(wrapper) {
    const player = wrapper.find('.video-player-mock')
    return player.exists() ? player.attributes('data-src') : null
}

async function playFirst(wrapper) {
    await wrapper.findAll('.main-view__card-media')[0].trigger('click')
    await wrapper.vm.$nextTick()
}

async function pressAction(wrapper, action) {
    const handler = mediaSession.handlers[action]
    expect(handler).toBeInstanceOf(Function)
    handler({ action })
    await wrapper.vm.$nextTick()
}

describe('MainView.vue — headset media keys on the "Videos" screen', () => {
    beforeEach(() => {
        localStorage.clear()
        installFakeMediaSession()
    })

    afterEach(() => {
        removeFakeMediaSession()
    })

    it('registers the track actions while a video is playing', async () => {
        const wrapper = await openVideos()
        await playFirst(wrapper)

        expect(mediaSession.handlers.nexttrack).toBeInstanceOf(Function)
        // Stage 54: the first clip has no previous one on this screen (no repeat here), yet the action is
        // registered so the platform can reach us; inside the handler the neighbour rule refuses.
        expect(mediaSession.handlers.previoustrack).toBeInstanceOf(Function)

        mediaSession.handlers.previoustrack({ action: 'previoustrack' })
        await wrapper.vm.$nextTick()
        expect(playingSrc(wrapper)).toBe('/dav/Movies/a.mp4')
        wrapper.unmount()
    })

    it('nexttrack walks the card list forward', async () => {
        const wrapper = await openVideos()
        await playFirst(wrapper)

        await pressAction(wrapper, 'nexttrack')
        expect(playingSrc(wrapper)).toBe('/dav/Movies/b.mp4')

        await pressAction(wrapper, 'nexttrack')
        expect(playingSrc(wrapper)).toBe('/dav/Movies/c.mp4')
        wrapper.unmount()
    })

    it('the last clip has no next action registered (the list ends there)', async () => {
        const wrapper = await openVideos()
        await playFirst(wrapper)
        await pressAction(wrapper, 'nexttrack')
        await pressAction(wrapper, 'nexttrack')

        expect(playingSrc(wrapper)).toBe('/dav/Movies/c.mp4')
        expect(mediaSession.handlers.nexttrack).toBeInstanceOf(Function)
        mediaSession.handlers.nexttrack({ action: 'nexttrack' })
        await wrapper.vm.$nextTick()
        expect(playingSrc(wrapper)).toBe('/dav/Movies/c.mp4')
        wrapper.unmount()
    })

    it('closing the player takes the actions away again', async () => {
        const wrapper = await openVideos()
        await playFirst(wrapper)

        expect(mediaSession.handlers.nexttrack).toBeInstanceOf(Function)

        await wrapper.find('.video-player-mock').trigger('close')
        await wrapper.vm.$nextTick()

        expect(mediaSession.handlers.nexttrack).toBeNull()
        expect(mediaSession.handlers.previoustrack).toBeNull()
        wrapper.unmount()
    })
})
