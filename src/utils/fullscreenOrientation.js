import { createScreenOrientationApi } from './screenOrientation'

/**
 * Fullscreen orientation coordinator.
 *
 * Responsibility (SRP): while a player is in fullscreen, make the screen match
 * the shape of the video — ask the platform to rotate (via the injected
 * orientation adapter) and tell the caller what the situation is, so the
 * stylesheet can cover the browsers/systems that refuse to rotate.
 *
 * Why the state does not depend on the result of `lock()`:
 *  - Android Chrome rotates the *media element* only, but Plyr fullscreens its
 *    wrapper `div.plyr`, so the automatic rotation never happens for us;
 *  - `screen.orientation.lock()` is ignored when the user turned system
 *    auto-rotate off, and it is missing entirely in some browsers;
 *  - therefore we always report the desired shape, and the CSS fallback
 *    (LANDSCAPE_FALLBACK_CLASS, applied only by a portrait media query) rotates
 *    the fullscreen element itself. If the browser did rotate the screen, the
 *    viewport is no longer portrait and the fallback stops applying by itself.
 */

export const ORIENTATION_LANDSCAPE = 'landscape'
export const ORIENTATION_PORTRAIT = 'portrait'

/**
 * Class the caller puts on the fullscreen element to request the CSS fallback.
 * Kept here so the JS and the stylesheet share one name (DRY).
 * @see src/assets/app.css
 */
export const LANDSCAPE_FALLBACK_CLASS = 'video-fullscreen--rotate'

// A video whose metadata is not known yet is assumed landscape: most video
// files are, and the assumption is corrected on the `loadedmetadata` event.
const UNKNOWN_SHAPE_IS_LANDSCAPE = true

/**
 * @param {object} options
 * @param {HTMLVideoElement|null} options.video media element whose shape decides the orientation
 * @param {{supported: Function, lock: Function, unlock: Function}} [options.api] screen-orientation adapter (injected in tests)
 * @param {(state: object) => void} [options.onStateChange] called on every change of the fullscreen/orientation state
 * @returns {{start: () => void, stop: () => void, state: () => object}}
 */
export function createFullscreenOrientation({ video, api = createScreenOrientationApi(), onStateChange = () => {} }) {
    let state = { fullscreen: false, landscapeVideo: false, requested: null, element: null }
    let started = false

    function fullscreenElementOf() {
        // The prefixed variant covers Safari and older WebKit-based browsers.
        return document.fullscreenElement || document.webkitFullscreenElement || null
    }

    function isLandscapeVideo() {
        const width = (video && video.videoWidth) || 0
        const height = (video && video.videoHeight) || 0
        if (!width || !height) {
            return UNKNOWN_SHAPE_IS_LANDSCAPE
        }
        return width >= height
    }

    function publish(next) {
        state = { ...state, ...next }
        onStateChange(state)
    }

    function releaseLock() {
        // Only release what we actually locked.
        if (state.fullscreen) {
            api.unlock()
        }
    }

    function apply() {
        const element = fullscreenElementOf()

        if (!element) {
            releaseLock()
            publish({ fullscreen: false, landscapeVideo: false, requested: null, element: null })
            return
        }

        const landscapeVideo = isLandscapeVideo()
        const requested = landscapeVideo ? ORIENTATION_LANDSCAPE : ORIENTATION_PORTRAIT

        // Publish before the platform call: the CSS fallback must not wait for
        // the (possibly slow or rejected) orientation request.
        publish({ fullscreen: true, landscapeVideo, requested, element })

        // The adapter never rejects; the outcome does not change the state.
        api.lock(requested)
    }

    function onFullscreenChange() {
        apply()
    }

    // QueuePlayer/playlist switches tracks without leaving fullscreen: the new
    // file may have the opposite shape, so re-evaluate when its metadata arrives.
    function onLoadedMetadata() {
        if (state.fullscreen) {
            apply()
        }
    }

    function start() {
        if (started) {
            return
        }
        started = true
        document.addEventListener('fullscreenchange', onFullscreenChange, { passive: true })
        document.addEventListener('webkitfullscreenchange', onFullscreenChange, { passive: true })
        if (video && typeof video.addEventListener === 'function') {
            video.addEventListener('loadedmetadata', onLoadedMetadata)
        }
        // The player may be mounted while already in fullscreen.
        apply()
    }

    function stop() {
        if (!started) {
            return
        }
        started = false
        document.removeEventListener('fullscreenchange', onFullscreenChange)
        document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
        if (video && typeof video.removeEventListener === 'function') {
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
        }
        releaseLock()
        state = { fullscreen: false, landscapeVideo: false, requested: null, element: null }
    }

    function current() {
        return state
    }

    return { start, stop, state: current }
}
