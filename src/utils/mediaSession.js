/**
 * Media keys and the Media Session API: who answers a "previous track" / "next track" command.
 *
 * Task 7 (Bluetooth headphones). Measured in stage 43 (real Chromium, real Plyr,
 * /tmp/vc/check23.out.txt): the tab is already an active media session — Plyr assigns
 * `navigator.mediaSession.metadata` with empty strings — but Plyr registers not a single action handler
 * (`grep -c setActionHandler node_modules/plyr/dist/plyr.js` -> 0) and never reports a `playbackState`.
 * A browser has a default behaviour for play/pause (which is why those keys work in this app) and no
 * default for previoustrack/nexttrack, so the headset buttons are silent. YouTube works with the same
 * headphones because it registers those two handlers.
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
 *            https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler
 *
 * A command can reach the page through two paths, and which one a device uses is not knowable locally
 * (stage 30.5 proved that synthetic media keys only produce `keydown` in headless Chromium):
 *   - a `keydown` with code/key MediaTrackNext / MediaTrackPrevious (keyboards, some browsers),
 *   - a Media Session action handler for `nexttrack` / `previoustrack` (headsets, OS media controls).
 * Both are wired here. A press that arrives through both paths must remain ONE command, otherwise one
 * click on the headset skips two videos — that is what the dedupe below is for. It compares the paths
 * only: auto-repeat of a held key inside one path keeps repeating, and two deliberate presses stay two
 * commands.
 *
 * The neighbour rule is passed in, not decided here: a screen that has no neighbour on one side removes
 * that action from the platform (setActionHandler(..., null)) so the OS hides or disables its button, and
 * the same rule makes the keyboard media key inert. This is the rule accepted for the on-screen buttons
 * and the Plyr row in task 6 (one rule for every place).
 *
 * Only the most recently mounted owner answers: the Media Session API is global, so when a screen is
 * replaced by another one, the stale owner must not keep control of the new queue and must not unregister
 * what the new owner has just registered.
 *
 * Stage 51 (the next round of task 7, after stage 48 failed on the device) added the other half of what an
 * operating system needs before it treats a tab as the media it is showing: the position state — duration,
 * position, playback rate — and the `artwork` picture that `setMediaSessionMetadata` accepts. Those belong
 * to whoever owns the media element, which is VideoPlayer, not to the owner of the track actions.
 */

// How long the same physical press may take to arrive through the other path. Real duplicate delivery is
// milliseconds apart; 250 ms is still far below two deliberate presses of a media key.
export const MEDIA_KEY_DEDUPE_MS = 250

// Stage 54 (task 7): the media keys are no longer taken away from the platform.
//
// Measured in stage 53-A: at the first track with repeat off, at the last track with repeat off, in a
// one-video playlist and in a queue that has already finished, our page called setActionHandler(action, null).
// The Media Session spec then drops the press: "If actions does not contain the key action, abort these
// steps" (https://www.w3.org/TR/mediasession/#actions-model), and the platform hides the button from its own
// media controls. play/pause kept working in exactly those states because the same spec recommends the user
// agent to provide those two defaults itself. That is the asymmetry the user reported, and it is the reason
// YouTube — which never removes the two actions — answers the headset in the background while we did not.
//
// While a screen owns the media keys, both actions are therefore registered. The neighbour rule stayed where
// it was already enforced: inside the screen's own prevManual/nextManual and in the availability recorded
// here, so a direction this queue cannot serve changes nothing (task 6 behaviour is intact).

const ACTION_PREVIOUS = 'previoustrack'
const ACTION_NEXT = 'nexttrack'

// The owner that currently owns the platform's media keys.
let activeOwner = null

/**
 * Stage 54 instrument: a short history of what actually arrived and what the layer did with it.
 *
 * The device is the only place where the delivery path of a headset button is observable (stages 30.5 and 43
 * proved that synthetic media keys never reach the media session in a headless browser), so the app itself
 * has to report it: whether a press arrived at all, through which path, and whether it ran, was refused by
 * the neighbour rule, or was swallowed as a duplicate of the other path. This is temporary diagnostic
 * surface for stage 54 and is removed with it.
 */
export const MEDIA_KEY_HISTORY_LIMIT = 12

// Stage 55: the reading also has to survive a reload. On Android a background tab is the tab most likely to
// be dropped and reloaded by the browser, and the measurement we care about is a press made exactly then.
// The history is therefore mirrored into localStorage and read back when this page has no history of its own.
export const MEDIA_KEY_HISTORY_STORAGE_KEY = 'video-media-keys-diag'

const mediaKeyHistory = []
const mediaKeySubscribers = new Set()
let historyLoaded = false

function loadStoredHistory() {
    if (typeof localStorage === 'undefined') {
        return []
    }
    try {
        const stored = JSON.parse(localStorage.getItem(MEDIA_KEY_HISTORY_STORAGE_KEY) || '[]')
        return Array.isArray(stored) ? stored.filter((event) => event && event.action && event.at) : []
    } catch (e) {
        // A broken store must not stop the instrument from working.
        return []
    }
}

function storeHistory() {
    if (typeof localStorage === 'undefined') {
        return
    }
    try {
        localStorage.setItem(MEDIA_KEY_HISTORY_STORAGE_KEY, JSON.stringify(mediaKeyHistory))
    } catch (e) {
        // Storage may be full or denied; the on-screen reading still works for this page.
    }
}

export function getRecentMediaKeys() {
    if (!historyLoaded) {
        historyLoaded = true
        if (mediaKeyHistory.length === 0) {
            mediaKeyHistory.push(...loadStoredHistory())
        }
    }
    return mediaKeyHistory.slice()
}

/** Instrument only: start the reading from an empty list, in this page and in the stored copy. */
export function clearMediaKeyHistory() {
    mediaKeyHistory.length = 0
    // The stored copy is dropped too, so the next read must try the store again instead of trusting the
    // "already loaded" flag of the history we have just thrown away.
    historyLoaded = false
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.removeItem(MEDIA_KEY_HISTORY_STORAGE_KEY)
        } catch (e) {
            // Same as above.
        }
    }
}

/**
 * Stage 57: the reading line of stages 54-56 did its job (the headset buttons were confirmed working on Linux
 * and on Android), so it must not be painted over the video unless somebody asks for it. Two switches are
 * honoured, both read once when the player mounts: the page address `?mediakeys=1` and this localStorage flag.
 * The recorded history (MEDIA_KEY_HISTORY_STORAGE_KEY) keeps working either way, so a press that arrived while
 * the line was hidden can still be read after the line is switched on again.
 */
export const MEDIA_KEYS_DIAG_SHOW_KEY = 'video-media-keys-diag-show'

export function isMediaKeysDiagRequested() {
    try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(MEDIA_KEYS_DIAG_SHOW_KEY) === '1') {
            return true
        }
    } catch (e) {
        // Storage denied: the address switch below still works.
    }
    try {
        return /[?&]mediakeys=1(?:&|$)/.test(window.location.search)
    } catch (e) {
        return false
    }
}

export function subscribeMediaKeys(listener) {
    if (typeof listener !== 'function') {
        return () => {}
    }
    mediaKeySubscribers.add(listener)
    return () => {
        mediaKeySubscribers.delete(listener)
    }
}

function recordMediaKey(event) {
    getRecentMediaKeys()
    mediaKeyHistory.push({ ...event, at: Date.now() })
    if (mediaKeyHistory.length > MEDIA_KEY_HISTORY_LIMIT) {
        mediaKeyHistory.splice(0, mediaKeyHistory.length - MEDIA_KEY_HISTORY_LIMIT)
    }
    storeHistory()
    for (const listener of mediaKeySubscribers) {
        try {
            listener(event)
        } catch (e) {
            // A diagnostic must never break the media keys it is watching.
        }
    }
}

export function supportsMediaSession() {
    return !!(typeof navigator !== 'undefined'
        && navigator.mediaSession
        && typeof navigator.mediaSession.setActionHandler === 'function')
}

// Not every browser that has a media session can be told where the playback is.
function supportsPositionState() {
    return !!(typeof navigator !== 'undefined'
        && navigator.mediaSession
        && typeof navigator.mediaSession.setPositionState === 'function')
}

function setPlatformHandler(action, handler) {
    if (!supportsMediaSession()) {
        return
    }
    try {
        navigator.mediaSession.setActionHandler(action, handler)
    } catch (e) {
        // Some browsers reject action types they do not implement. The keyboard path still works.
    }
}

/**
 * Mount the media-key owner for one screen.
 *
 * @param {{ onPrev: Function, onNext: Function }} handlers navigation callbacks owned by the screen
 * @returns {{ setAvailability: Function, destroy: Function }}
 */
export function mountTrackMediaKeys({ onPrev, onNext }) {
    // `playing` is what decides whether the platform is offered the two actions at all: while this screen
    // plays something, both directions are reachable and the neighbour rule only refuses inside. With nothing
    // playing there is nothing for the platform to control here, so both actions are taken away (the state of
    // a closed player or of a queue that has finished).
    const enabled = { prev: true, next: true, playing: true }
    // Last command handled by each path, used only to recognise the same press through the other path.
    const handled = {
        key: { command: null, at: 0 },
        platform: { command: null, at: 0 },
    }
    const owner = {}

    function claim(path, command) {
        const other = path === 'key' ? 'platform' : 'key'
        const now = Date.now()
        if (handled[other].command === command && now - handled[other].at < MEDIA_KEY_DEDUPE_MS) {
            return false
        }
        handled[path] = { command, at: now }
        return true
    }

    function run(path, command, callback) {
        const action = command === 'prev' ? ACTION_PREVIOUS : ACTION_NEXT
        if (activeOwner !== owner) {
            // A screen we no longer own: the platform still reaches us, and this is what we say about it.
            recordMediaKey({ action, path, result: 'not-owner' })
            return
        }
        if (!claim(path, command)) {
            recordMediaKey({ action, path, result: 'duplicate' })
            return
        }
        if (!enabled[command]) {
            // Registered, reachable, and refused here — the neighbour rule of task 6, unchanged.
            recordMediaKey({ action, path, result: 'no-neighbour' })
            return
        }
        recordMediaKey({ action, path, result: 'ran' })
        if (typeof callback === 'function') {
            callback()
        }
    }

    function onKeydown(event) {
        const code = event.code || event.key
        if (code === 'MediaTrackPrevious') {
            run('key', 'prev', onPrev)
        } else if (code === 'MediaTrackNext') {
            run('key', 'next', onNext)
        }
    }

    activeOwner = owner

    function applyAvailability() {
        if (!enabled.playing) {
            // Nothing plays here: the platform has nothing to control, and the media keys of a closed player
            // must not stay registered against a queue that no longer exists.
            setPlatformHandler(ACTION_PREVIOUS, null)
            setPlatformHandler(ACTION_NEXT, null)
            return
        }
        // Stage 54: while this screen owns the media keys, BOTH directions are offered — taking one away made
        // the headset button unreachable and hid it from the platform media controls (stage 53-A). `enabled`
        // decides what a press may do, not whether the platform can reach us at all.
        setPlatformHandler(ACTION_PREVIOUS, () => run('platform', 'prev', onPrev))
        setPlatformHandler(ACTION_NEXT, () => run('platform', 'next', onNext))
    }

    applyAvailability()
    document.addEventListener('keydown', onKeydown)

    return {
        setAvailability({ prev = true, next = true, playing = true }) {
            enabled.prev = prev === true
            enabled.next = next === true
            enabled.playing = playing === true
            applyAvailability()
        },
        destroy() {
            document.removeEventListener('keydown', onKeydown)
            if (activeOwner === owner) {
                activeOwner = null
                setPlatformHandler(ACTION_PREVIOUS, null)
                setPlatformHandler(ACTION_NEXT, null)
            }
        }
    }
}

/**
 * What the platform shows on its media controls (a notification, a lock screen, a volume flyout).
 * Plyr writes this with empty strings, so the app has to write it again with the real title.
 */
export function setMediaSessionMetadata({ title, artist = '', album = '', artwork = [] }) {
    if (!supportsMediaSession() || typeof window.MediaMetadata !== 'function') {
        return
    }
    try {
        navigator.mediaSession.metadata = new window.MediaMetadata({ title, artist, album, artwork })
    } catch (e) {
        // Metadata is presentation only; a failure here must not affect playback.
    }
}

/** 'playing' | 'paused' | 'none' — Plyr never reports it, so the OS shows a stale control state. */
export function setMediaSessionPlaybackState(state) {
    if (!supportsMediaSession()) {
        return
    }
    try {
        navigator.mediaSession.playbackState = state
    } catch (e) {
        // Same as above: presentation only.
    }
}

/**
 * Where the playback is: the duration, the current position and the rate (stage 51, task 7).
 *
 * Stage 43 measured that Plyr never reports any of it. Without a duration the platform shows a media item
 * with no end — and, as the device test of stage 48 suggested, an item the OS media controls are not
 * interested in. YouTube reports it, which is part of why YouTube owns the headset buttons there.
 *
 * `positioning` defaults to the beginning of the track and `playbackRate` to 1. A position outside the
 * track is clamped: Chromium rejects the whole call when `positioning` is greater than the duration, so
 * an unclamped value would leave the platform with nothing rather than with something slightly wrong.
 */
export function setMediaSessionPositionState({ duration, positioning = 0, playbackRate = 1 }) {
    if (!supportsPositionState()) {
        return
    }
    // Without a trustworthy duration there is nothing to report. A stream whose length is unknown must not
    // be presented to the operating system as a zero-length item.
    if (!Number.isFinite(duration) || duration <= 0) {
        return
    }
    const position = Number.isFinite(positioning) ? Math.min(Math.max(positioning, 0), duration) : 0
    const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1

    try {
        navigator.mediaSession.setPositionState({ duration, positioning: position, playbackRate: rate })
    } catch (e) {
        // Presentation only: a browser that rejects the state must not affect playback.
    }
}

/** Forget the position: called when the track changes (its length is not known yet) or when nothing plays. */
export function clearMediaSessionPositionState() {
    if (!supportsPositionState()) {
        return
    }
    try {
        // Called without arguments the platform drops the duration, the position and the rate.
        navigator.mediaSession.setPositionState()
    } catch (e) {
        // Presentation only.
    }
}

/** Nothing is playing anymore: forget what the platform was told. */
export function clearMediaSession() {
    if (!supportsMediaSession()) {
        return
    }
    try {
        navigator.mediaSession.metadata = null
    } catch (e) {
        // Ignore.
    }
    clearMediaSessionPositionState()
    setMediaSessionPlaybackState('none')
}
