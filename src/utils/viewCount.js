import { ref } from 'vue'
import { incrementViewRequest } from '../api/views'

/**
 * Per-user video view counters, stored on the server so the popularity order
 * is shared across browsers and devices.
 *
 * The reactive map is fed from the videos API response (setViewCounts) and
 * updated optimistically when a view is counted (incrementView persists it to
 * the server).
 */
const counts = ref({})

/** Reactive map of path -> number of views (shared across the app). */
export function getViewCounts() {
    return counts
}

/** Number of views for a single path. */
export function getViewCount(path) {
    return path ? counts.value[path] || 0 : 0
}

/** Replace the counters, e.g. from the videos API response. */
export function setViewCounts(map) {
    counts.value = map || {}
}

/** Increment the counter for a path and persist it on the server. */
export async function incrementView(path) {
    if (!path) {
        return
    }
    counts.value[path] = (counts.value[path] || 0) + 1
    try {
        await incrementViewRequest(path)
    } catch (e) {
        // The server rejected it — revert the optimistic increment.
        counts.value[path] = Math.max(0, (counts.value[path] || 0) - 1)
    }
}

/** Reset to an empty counter map (used by tests). */
export function resetViewCounts() {
    counts.value = {}
}
