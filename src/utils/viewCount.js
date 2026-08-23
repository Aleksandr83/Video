import { ref } from 'vue'

/**
 * Per-user view counters for videos, persisted in localStorage.
 *
 * A "view" is counted once per track when playback actually starts. The
 * counters are used on the Videos page to sort cards by popularity (most
 * watched first).
 */
const KEY = 'video-views'
const counts = ref(load())

function load() {
    try {
        const raw = localStorage.getItem(KEY)
        return raw ? JSON.parse(raw) : {}
    } catch (e) {
        return {}
    }
}

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(counts.value))
    } catch (e) {
        // Ignore storage errors (e.g. disabled storage).
    }
}

/** Reactive map of path -> number of views (shared across the app). */
export function getViewCounts() {
    return counts
}

/** Number of views for a single path. */
export function getViewCount(path) {
    return path ? counts.value[path] || 0 : 0
}

/** Increment the view counter for a path. */
export function incrementView(path) {
    if (!path) {
        return
    }
    counts.value[path] = (counts.value[path] || 0) + 1
    save()
}

/** Reload the counters from storage (used by tests). */
export function resetViewCounts() {
    counts.value = load()
}
