import { describe, it, expect, beforeEach } from 'vitest'
import { usePlaybackQueue } from '../../src/composables/usePlaybackQueue'

/**
 * The list of tracks under the video is the saved playlist order, and the user can now change that order
 * from that very list. The queue must therefore follow a new `items` array instead of keeping the array it
 * was built from, and it must keep playing the SAME track while the list around it moves.
 *
 * These tests pin down the queue half of that contract.
 */
const three = [
    { path: 'Movies/a.mp4', name: 'a.mp4', id: 1 },
    { path: 'Movies/b.mp4', name: 'b.mp4', id: 2 },
    { path: 'Movies/c.mp4', name: 'c.mp4', id: 3 },
]

function paths(list) {
    return list.map((item) => item.path)
}

describe('usePlaybackQueue — the queue follows the playlist it is given', () => {
    let queue

    beforeEach(() => {
        localStorage.clear()
        queue = usePlaybackQueue(three)
        queue.play()
    })

    it('starts from the playlist order and plays the first track', () => {
        expect(paths(queue.queue.value)).toEqual(['Movies/a.mp4', 'Movies/b.mp4', 'Movies/c.mp4'])
        expect(queue.current.value.path).toBe('Movies/a.mp4')
    })

    it('adopts a reordered list and keeps playing the same track', () => {
        // The first track plays, and the user moves the last track one step up: [a, b, c] -> [a, c, b].
        queue.playIndex(0)
        expect(queue.current.value.path).toBe('Movies/a.mp4')

        queue.syncItems([three[0], three[2], three[1]])

        expect(paths(queue.queue.value)).toEqual(['Movies/a.mp4', 'Movies/c.mp4', 'Movies/b.mp4'])
        expect(queue.current.value.path).toBe('Movies/a.mp4')
        // Without shuffle the playback order IS the playlist order, so what plays next is what the user
        // has just put after the current track.
        expect(queue.nextTrack().path).toBe('Movies/c.mp4')
        expect(queue.order.value.map((i) => queue.queue.value[i].path))
            .toEqual(['Movies/a.mp4', 'Movies/c.mp4', 'Movies/b.mp4'])
    })

    it('adopts a shorter list: the track after the removed one takes its place', () => {
        queue.playIndex(1)
        expect(queue.current.value.path).toBe('Movies/b.mp4')

        // 'b' was removed from the playlist by the menu action.
        queue.syncItems([three[0], three[2]])

        expect(paths(queue.queue.value)).toEqual(['Movies/a.mp4', 'Movies/c.mp4'])
        // The playback continues where the removed track was: Movies/c.mp4 is what plays now.
        expect(queue.current.value.path).toBe('Movies/c.mp4')
    })

    it('an empty list ends the queue instead of pointing at a ghost track', () => {
        queue.syncItems([])

        expect(queue.queue.value).toEqual([])
        expect(queue.current.value).toBeNull()
        expect(queue.currentIndex.value).toBe(-1)
        expect(queue.hasNextTrack.value).toBe(false)
        expect(queue.hasPrevTrack.value).toBe(false)
    })

    it('with shuffle on, the already chosen sequence survives the reordering of the playlist', () => {
        queue.toggleShuffle()
        const sequence = queue.order.value.map((index) => queue.queue.value[index].path)
        // playIndex() is addressed by the position in the LIST, not by the position in the shuffled
        // sequence: which index shuffles picked is random and must not be hardcoded by a test.
        queue.playIndex(queue.queue.value.findIndex((item) => item.path === 'Movies/b.mp4'))

        queue.syncItems([three[2], three[1], three[0]])

        const reshaped = queue.order.value.map((index) => queue.queue.value[index].path)
        expect(reshaped).toEqual(sequence)
        expect(queue.current.value.path).toBe('Movies/b.mp4')
    })

    it('a track that is new to the queue is appended to the playback order', () => {
        const extra = { path: 'Movies/d.mp4', name: 'd.mp4', id: 4 }

        queue.syncItems([...three, extra])

        expect(paths(queue.queue.value)).toContain('Movies/d.mp4')
        expect(queue.order.value.map((i) => queue.queue.value[i].path)).toContain('Movies/d.mp4')
        expect(queue.order.value).toHaveLength(4)
        expect(new Set(queue.order.value).size).toBe(4)
    })
})
