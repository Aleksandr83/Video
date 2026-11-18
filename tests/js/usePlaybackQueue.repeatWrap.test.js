import { describe, it, expect, beforeEach } from 'vitest'
import { usePlaybackQueue } from '../../src/composables/usePlaybackQueue'

/**
 * Queue neighbours at the edges of the list (task 6, stage 31).
 *
 * The rule the user approved (stage 30): a prev/next control is available only
 * when a neighbour track exists, and with `repeat` on that neighbour wraps
 * around the queue — `next` already did, `prev` is what these tests require.
 *
 * Expected after implementation:
 *   prev(): cursor > 0        -> cursor - 1
 *           cursor === 0, repeat on  -> cursor = order.length - 1 (wrap back)
 *           cursor === 0, repeat off -> stay
 *   next(): unchanged (it already wraps).
 *
 * Everything is exercised through `order`, so the wrap follows the shuffled
 * playback order, not the original playlist order.
 */
const items = [
    { path: 'Movies/a.mp4', name: 'a.mp4' },
    { path: 'Movies/b.mp4', name: 'b.mp4' },
    { path: 'Movies/c.mp4', name: 'c.mp4' },
]

function openQueue({ repeat = false, shuffle = false } = {}) {
    if (repeat) localStorage.setItem('video-queue-repeat', '1')
    if (shuffle) localStorage.setItem('video-queue-shuffle', '1')
    const queue = usePlaybackQueue(items)
    queue.play()
    return queue
}

describe('usePlaybackQueue.js — prev/next neighbours at the queue edges', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('prev() wraps back to the last track when repeat is on', () => {
        const queue = openQueue({ repeat: true })
        expect(queue.cursor.value).toBe(0)

        queue.prev()

        expect(queue.cursor.value).toBe(queue.order.value.length - 1)
        expect(queue.current.value).toEqual(items[2])
    })

    it('the wrap back keeps the shuffled order: prev() lands on the last position of order', () => {
        const queue = openQueue({ repeat: true, shuffle: true })
        const firstInOrder = queue.currentIndex.value
        const lastPosition = queue.order.value[queue.order.value.length - 1]

        queue.prev()

        expect(queue.currentIndex.value).toBe(lastPosition)
        expect(queue.currentIndex.value).not.toBe(firstInOrder)
    })

    it('prev() at the first track leaves the cursor alone when repeat is off', () => {
        const queue = openQueue({ repeat: false })

        queue.prev()

        expect(queue.cursor.value).toBe(0)
        expect(queue.current.value).toEqual(items[0])
    })

    it('next() still wraps to the first track when repeat is on', () => {
        const queue = openQueue({ repeat: true })
        queue.next()
        queue.next()
        expect(queue.cursor.value).toBe(2)

        queue.next()

        expect(queue.cursor.value).toBe(0)
    })

    it('next() ends the queue when repeat is off (documented, unchanged behaviour)', () => {
        const queue = openQueue({ repeat: false })
        queue.next()
        queue.next()

        queue.next()

        expect(queue.cursor.value).toBe(-1)
        expect(queue.current.value).toBeNull()
    })

    it('a wrapped queue returns to the same track it left (round trip)', () => {
        const queue = openQueue({ repeat: true })

        queue.prev()
        const landedOn = queue.current.value
        queue.next()

        expect(landedOn).toEqual(items[2])
        expect(queue.current.value).toEqual(items[0])
    })

    it('one-track playlist with repeat on: prev() stays on that track instead of going nowhere', () => {
        localStorage.setItem('video-queue-repeat', '1')
        const queue = usePlaybackQueue([items[0]])
        queue.play()

        queue.prev()

        expect(queue.cursor.value).toBe(0)
        expect(queue.current.value).toEqual(items[0])
    })

    it('one-track playlist without repeat: prev() keeps the track and the queue alive', () => {
        const queue = usePlaybackQueue([items[0]])
        queue.play()

        queue.prev()

        expect(queue.cursor.value).toBe(0)
        expect(queue.current.value).toEqual(items[0])
    })

    it('once the queue has ended, prev() does not resurrect it', () => {
        const queue = openQueue({ repeat: false })
        queue.next()
        queue.next()
        queue.next()
        expect(queue.cursor.value).toBe(-1)

        queue.prev()

        expect(queue.cursor.value).toBe(-1)
        expect(queue.current.value).toBeNull()
    })

    it('once the queue has ended, next() does not jump back to the first track', () => {
        const queue = openQueue({ repeat: false })
        queue.next()
        queue.next()
        queue.next()
        expect(queue.cursor.value).toBe(-1)

        queue.next()

        expect(queue.cursor.value).toBe(-1)
    })
})
