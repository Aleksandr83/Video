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
 * repeat (loop from the start once the whole list has been played).
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
        if (cursor.value < order.value.length - 1) {
            cursor.value += 1
        } else if (repeat.value && order.value.length) {
            cursor.value = 0
        } else {
            cursor.value = -1
        }
    }

    function prev() {
        if (cursor.value > 0) {
            cursor.value -= 1
        } else {
            cursor.value = order.value.length ? 0 : -1
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
    }
}
