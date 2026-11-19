/**
 * Remember the playback position per video (localStorage).
 *
 * The key is derived from the video path (trackKey). Positions above 0 seconds are saved;
 * positions at 0 clear the stored value.
 *
 * Task 8 (the user's rule, 2026-11-18): a track that is RESUME_MIN_REMAINING seconds from
 * its end counts as watched through, so it must start from the beginning next time — not one
 * second before its end. Stage 36 measured why: while a track plays, the player stores a
 * position every 5 seconds, so the last write lands inside the final seconds (measured on a
 * real 163.79 s track: stored 161.768503, reopened at 162.078). A finished track therefore
 * leaves a value that has to be dropped, and a position that close to the end is never written.
 *
 * `duration` is optional everywhere: when the media never reports one (a stream without
 * metadata) the remaining time cannot be judged, and the value is kept exactly as before.
 */
const PREFIX = 'video-resume:'

// How close to the end of a track still counts as "worth resuming". Below this, the track
// is treated as finished and the next playback starts from zero.
export const RESUME_MIN_REMAINING = 30

/**
 * Is this position close enough to the end to mean "already watched through"?
 * An unknown duration (NaN, Infinity, 0) is never treated as finished.
 */
function isWatchedThrough(time, duration) {
    if (!Number.isFinite(duration) || duration <= 0) {
        return false
    }
    return duration - time < RESUME_MIN_REMAINING
}

export function loadPosition(trackKey, duration) {
    try {
        const raw = localStorage.getItem(PREFIX + trackKey)
        const value = Number(raw)
        if (!Number.isFinite(value) || value <= 0) {
            return 0
        }
        if (isWatchedThrough(value, duration)) {
            // A leftover from a track that has finished: forget it so the video starts over.
            localStorage.removeItem(PREFIX + trackKey)
            return 0
        }
        return value
    } catch (e) {
        return 0
    }
}

export function savePosition(trackKey, time, duration) {
    try {
        if (time > 0 && !isWatchedThrough(time, duration)) {
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
        // Ignore storage errors.
    }
}
