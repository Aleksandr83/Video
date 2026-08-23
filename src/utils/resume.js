/**
 * Remember the playback position per video (localStorage).
 *
 * The key is derived from the video path (trackKey). Positions above 0 seconds
 * are saved; positions at 0 clear the stored value.
 */
const PREFIX = 'video-resume:'

export function loadPosition(trackKey) {
    try {
        const raw = localStorage.getItem(PREFIX + trackKey)
        const value = Number(raw)
        return Number.isFinite(value) && value > 0 ? value : 0
    } catch (e) {
        return 0
    }
}

export function savePosition(trackKey, time) {
    try {
        if (time > 0) {
            localStorage.setItem(PREFIX + trackKey, String(time))
        } else {
            localStorage.removeItem(PREFIX + trackKey)
        }
    } catch (e) {
        // Ignore storage errors (e.g. disabled storage).
    }
}

/** Remove the remembered position for a track (e.g. when it has ended). */
export function clearPosition(trackKey) {
    try {
        localStorage.removeItem(PREFIX + trackKey)
    } catch (e) {
        // Ignore storage errors (e.g. disabled storage).
    }
}
