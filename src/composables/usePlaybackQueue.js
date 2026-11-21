import { ref, computed, watch } from 'vue'

// Persist the shuffle/repeat toggle state per user (localStorage).
const SHUFFLE_KEY = 'video-queue-shuffle'
const REPEAT_KEY = 'video-queue-repeat'

function readStored(key) {
    try {
        return localStorage.getItem(key) === '1'
    } catch (e) {
        return false
    }
}

function writeStored(key, value) {
    try {
        if (value) {
            localStorage.setItem(key, '1')
        } else {
            localStorage.removeItem(key)
        }
    } catch (e) {
        // Ignore storage errors (e.g. disabled storage).
    }
}

/**
 * Playback queue logic: sequential playback with autoplay-next, shuffle and
 * repeat (once the whole list has been played the queue wraps around — forward
 * to the first track and backwards to the last one).
 *
 * Pure composable over Vue refs — easy to unit test without mounting.
 *
 * @param {Array<{path: string, name?: string}>} items
 */
export function usePlaybackQueue(items) {
    const queue = ref(items || [])
    // Restore the toggles the user last used, so they survive page reloads.
    const shuffle = ref(readStored(SHUFFLE_KEY))
    const repeat = ref(readStored(REPEAT_KEY))
    const order = ref([])
    const cursor = ref(-1)

    // Sync flush so the value is written immediately (before anything reads it).
    watch(shuffle, (value) => writeStored(SHUFFLE_KEY, value), { flush: 'sync' })
    watch(repeat, (value) => writeStored(REPEAT_KEY, value), { flush: 'sync' })

    function naturalOrder() {
        return queue.value.map((_, index) => index)
    }

    function shuffled(arr) {
        const result = [...arr]
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[result[i], result[j]] = [result[j], result[i]]
        }
        return result
    }

    function init() {
        order.value = shuffle.value ? shuffled(naturalOrder()) : naturalOrder()
        cursor.value = queue.value.length ? 0 : -1
    }

    const currentIndex = computed(() => (cursor.value >= 0 ? order.value[cursor.value] : -1))
    const current = computed(() => (currentIndex.value >= 0 ? queue.value[currentIndex.value] : null))

    function play() {
        init()
    }

    function playIndex(index) {
        if (!queue.value.length) {
            cursor.value = -1
            return
        }
        const at = order.value.indexOf(index)
        cursor.value = at >= 0 ? at : 0
    }

    function next() {
        // An ended queue stays ended: only a click in the queue list (playIndex)
        // restarts it, so prev()/next() must not resurrect it on their own.
        if (cursor.value < 0 || !order.value.length) {
            return
        }
        if (cursor.value < order.value.length - 1) {
            cursor.value += 1
        } else if (repeat.value && order.value.length) {
            cursor.value = 0
        } else {
            cursor.value = -1
        }
    }

    // Symmetric counterpart of next(): with repeat on, the first track steps
    // back to the last one of the current order (which is the shuffled order
    // when shuffle is on). Without repeat the first track has no neighbour and
    // the cursor stays where it is.
    function prev() {
        if (cursor.value < 0 || !order.value.length) {
            return
        }
        if (cursor.value > 0) {
            cursor.value -= 1
        } else if (repeat.value) {
            cursor.value = order.value.length - 1
        }
    }

    function toggleShuffle() {
        shuffle.value = !shuffle.value
        const currentAt = currentIndex.value

        if (shuffle.value) {
            const rest = order.value.filter((index) => index !== currentAt)
            const shuffledRest = shuffled(rest)
            order.value = currentAt >= 0 ? [currentAt, ...shuffledRest] : shuffledRest
            cursor.value = currentAt >= 0 ? 0 : -1
        } else {
            order.value = naturalOrder()
            cursor.value = currentAt >= 0 ? order.value.indexOf(currentAt) : -1
        }
    }

    function toggleRepeat() {
        repeat.value = !repeat.value
    }

    function reset() {
        cursor.value = -1
    }

    /**
     * Follow a new list of tracks without interrupting the playback.
     *
     * The list under the video is a view of the saved playlist, and the user can change that order there
     * (move a track up or down, remove one). The queue must adopt the new list while the same track keeps
     * playing, so the identity of the current track is held by its path, not by an index: an index means
     * nothing any more after the list moved.
     *
     * Without shuffle the playback order IS the list order, so the next track to play is whatever the new
     * list puts after the current one. With shuffle on the sequence the user already started playing keeps
     * its shape: tracks that are still there stay in the same slots of that sequence, and tracks the list
     * has just gained are appended to it.
     */
    function syncItems(items) {
        const next = Array.isArray(items) ? [...items] : []
        const currentPath = current.value ? current.value.path : null
        const startedAt = cursor.value
        const sequence = order.value.map((index) => (queue.value[index] ? queue.value[index].path : null))
            .filter(Boolean)

        queue.value = next
        if (!next.length) {
            order.value = []
            cursor.value = -1
            return
        }

        const indexOfPath = (path) => next.findIndex((item) => item.path === path)

        if (shuffle.value) {
            const kept = sequence.map(indexOfPath).filter((index) => index >= 0)
            const claimed = new Set(kept)
            next.forEach((item, index) => {
                if (!claimed.has(index)) {
                    kept.push(index)
                    claimed.add(index)
                }
            })
            order.value = kept
        } else {
            order.value = naturalOrder()
        }

        if (currentPath) {
            const at = order.value.indexOf(indexOfPath(currentPath))
            // The track the user is watching is still in the list: stay on it.
            cursor.value = at >= 0 ? at : Math.min(startedAt, order.value.length - 1)
        } else {
            // It is gone (removed from the playlist): the track that took its place continues the queue.
            cursor.value = Math.min(startedAt, order.value.length - 1)
        }
    }

    // The track that prev() will land on (null when there is no previous one). With repeat on, the first
    // track steps back to the last one of the current order — which is the shuffled order when shuffle is on.
    function previousTrack() {
        if (cursor.value < 0) {
            return null
        }
        if (cursor.value > 0) {
            return queue.value[order.value[cursor.value - 1]] || null
        }
        if (repeat.value && order.value.length) {
            return queue.value[order.value[order.value.length - 1]] || null
        }
        return null
    }

    // The track that next() will land on (null when the queue has nothing left).
    function nextTrack() {
        if (cursor.value < 0) {
            return null
        }
        if (cursor.value < order.value.length - 1) {
            return queue.value[order.value[cursor.value + 1]] || null
        }
        if (repeat.value && order.value.length) {
            return queue.value[order.value[0]] || null
        }
        return null
    }

    const hasPrevTrack = computed(() => previousTrack() !== null)
    const hasNextTrack = computed(() => nextTrack() !== null)

    return {
        queue,
        current,
        currentIndex,
        shuffle,
        repeat,
        order,
        cursor,
        play,
        playIndex,
        next,
        prev,
        toggleShuffle,
        toggleRepeat,
        reset,
        syncItems,
        previousTrack,
        nextTrack,
        hasPrevTrack,
        hasNextTrack,
    }
}
