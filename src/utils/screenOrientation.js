/**
 * Adapter over the browser Screen Orientation API.
 *
 * Single responsibility: talk to the platform and report what happened. It makes
 * no decisions about which orientation is needed and touches no DOM/CSS — that
 * is the job of fullscreenOrientation.js (SRP, dependency inversion: the
 * coordinator depends on this interface and can be tested with a stub).
 *
 * Browser facts this file exists for:
 *  - the API is `window.screen.orientation` (the *instance*), not `Screen.orientation`
 *    (the interface); reading the latter throws "Illegal invocation" in browsers;
 *  - `lock()` is only allowed in a secure context and only while the document is
 *    in fullscreen, and it rejects (NotAllowedError) otherwise;
 *  - on Android the browser is not allowed to rotate the screen when the user has
 *    turned system auto-rotate off, so a resolved `lock()` is not a guarantee that
 *    the screen actually rotated.
 */

/**
 * @param {object} target window-like object; defaults to the global one.
 * @returns {{supported: () => boolean, lock: (orientation: string) => Promise<boolean>, unlock: () => void}}
 */
export function createScreenOrientationApi(target = globalThis) {
    function orientationOf() {
        return (target.screen && target.screen.orientation) || null
    }

    function supported() {
        const orientation = orientationOf()
        // isSecureContext is only explicitly false in an insecure context; older
        // engines may not define it at all.
        return Boolean(orientation && typeof orientation.lock === 'function' && target.isSecureContext !== false)
    }

    /**
     * Ask the platform for an orientation ('landscape', 'portrait', ...).
     * @returns {Promise<boolean>} true when the browser accepted the request.
     */
    async function lock(orientation) {
        if (!supported()) {
            return false
        }
        try {
            const result = orientationOf().lock(orientation)
            // Some engines return undefined instead of a promise.
            if (result && typeof result.then === 'function') {
                await result
            }
            return true
        } catch (error) {
            // Rejected (NotAllowedError) or thrown synchronously — the caller
            // falls back to the CSS solution, so the error is not interesting.
            return false
        }
    }

    /** Give orientation control back to the system. Never throws. */
    function unlock() {
        const orientation = orientationOf()
        if (!orientation || typeof orientation.unlock !== 'function') {
            return
        }
        try {
            const result = orientation.unlock()
            if (result && typeof result.catch === 'function') {
                result.catch(() => {})
            }
        } catch (error) {
            // Nothing to do: the lock is already gone with the fullscreen exit.
        }
    }

    return { supported, lock, unlock }
}
