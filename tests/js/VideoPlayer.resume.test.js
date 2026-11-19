import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoPlayer from '../../src/components/VideoPlayer.vue'

/**
 * Task 8: the resume position of a track that has finished.
 *
 * Stage 36 measured the defect in Chromium on the user's own MP4 (163.79 s): while a track
 * plays, `onTimeupdate` stores a position every 5 seconds, so the last write lands inside the
 * final 5 seconds (measured value 161.768503). Chromium fires `pause` before `ended` — but
 * `video.ended` is already true then, so the `!video.ended` guard is not the hole. The hole is
 * that nothing ever removes that leftover: reopening the finished track seeks to it
 * (measured 162.078 = 1.72 s before the end) and the track ends again.
 *
 * The tests below use the real resume module and the real localStorage, so they describe the
 * user-visible contract: a track watched through starts from zero, a track left midway does not.
 */
const plyrInstances = []

vi.mock('plyr', () => ({
    __esModule: true,
    default: class MockPlyr {
        constructor(el) {
            const controls = document.createElement('div')
            controls.className = 'plyr__controls'
            const play = document.createElement('button')
            play.setAttribute('data-plyr', 'play')
            controls.append(play)
            this.elements = { container: el, controls, buttons: { play: [play] } }
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

vi.mock('../../src/api/views', () => ({
    incrementViewRequest: vi.fn().mockResolvedValue({}),
}))

const KEY = 'Movies/a.mp4'
const SRC = '/remote.php/dav/files/testuser/Movies/a.mp4'
const STORAGE_KEY = 'video-resume:' + KEY
const DURATION = 163.79

function seedPosition(value) {
    localStorage.setItem(STORAGE_KEY, String(value))
}

function stored() {
    return localStorage.getItem(STORAGE_KEY)
}

function mountPlayer(props = {}) {
    const wrapper = mount(VideoPlayer, { props: { src: SRC, title: 'a.mp4', trackKey: KEY, ...props } })
    return wrapper
}

function media(wrapper) {
    return wrapper.find('video').element
}

/** jsdom does not load media: report the duration the way a browser would. */
function giveDuration(el, value) {
    Object.defineProperty(el, 'duration', { configurable: true, get: () => value })
}

function markEnded(el, value = true) {
    Object.defineProperty(el, 'ended', { configurable: true, get: () => value })
}

function fire(el, name) {
    el.dispatchEvent(new Event(name))
}

describe('VideoPlayer.vue — a finished track must start over (task 8)', () => {
    beforeEach(() => {
        localStorage.clear()
        plyrInstances.length = 0
    })

    it('an ended track leaves no resume position behind', () => {
        seedPosition(161.768503) // what the 5s throttle writes at the end of a track

        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        markEnded(el)
        fire(el, 'ended')

        expect(stored()).toBeNull()
        expect(wrapper.emitted('ended')).toBeTruthy()
        wrapper.unmount()
    })

    it('pausing close to the end stores nothing: the track is considered watched through', () => {
        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        el.currentTime = 161.768503 // 2.02 s before the end

        fire(el, 'pause')

        expect(stored()).toBeNull()
        wrapper.unmount()
    })

    it('a leftover position near the end is not applied on open, and is forgotten', () => {
        seedPosition(161.768503) // written by the version before task 8

        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        fire(el, 'loadedmetadata')

        expect(el.currentTime).toBe(0)
        expect(stored()).toBeNull()
        wrapper.unmount()
    })

    it('a track left midway still resumes from its position (the feature is intact)', () => {
        seedPosition(100) // 63.79 s left

        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        fire(el, 'loadedmetadata')

        expect(el.currentTime).toBe(100)
        wrapper.unmount()
    })

    it('without a known duration the stored position is still used', () => {
        seedPosition(100)

        const wrapper = mountPlayer()
        const el = media(wrapper)
        // No duration override: jsdom reports NaN, like a stream without metadata.
        fire(el, 'loadedmetadata')

        expect(el.currentTime).toBe(100)
        wrapper.unmount()
    })

    it('resume=false (auto-advance to the next track) never seeks to an old position', () => {
        seedPosition(100)

        const wrapper = mountPlayer({ resume: false })
        const el = media(wrapper)
        giveDuration(el, DURATION)
        fire(el, 'loadedmetadata')

        expect(el.currentTime).toBe(0)
        wrapper.unmount()
    })

    it('switching tracks does not store the near-end position of the track being left', async () => {
        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        el.currentTime = 161.768503 // 2.02 s before the end of the current track

        await wrapper.setProps({
            src: '/remote.php/dav/files/testuser/Movies/b.mp4',
            trackKey: 'Movies/b.mp4',
        })

        expect(stored()).toBeNull()
        expect(localStorage.getItem('video-resume:Movies/b.mp4')).toBeNull()
        wrapper.unmount()
    })

    it('a midway position of the track being left is still stored on a track switch', async () => {
        const wrapper = mountPlayer()
        const el = media(wrapper)
        giveDuration(el, DURATION)
        el.currentTime = 100 // 63.79 s left

        await wrapper.setProps({
            src: '/remote.php/dav/files/testuser/Movies/b.mp4',
            trackKey: 'Movies/b.mp4',
        })

        expect(stored()).toBe('100')
        wrapper.unmount()
    })
})
