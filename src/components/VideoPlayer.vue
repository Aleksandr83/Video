<template>
    <div class="video-player">
        <button class="video-player__close button-vue" type="button" :title="t('close')" :aria-label="t('close')" @click="close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        </button>
        <video
            ref="videoRef"
            class="video-player__media"
            :src="src"
            :title="title"
        ></video>
        <!-- Stage 55 (temporary): the media-key instrument is rendered here and moved into the Plyr
             container (div.plyr) once Plyr exists, so it also exists inside the real fullscreen subtree.
             See the comment on moveMediaKeysDiagIntoPlayer(). Removed together with the instrument.
             Stage 57: it is off by default now. Ask for it with `?mediakeys=1` in the page address or with
             the localStorage flag `video-media-keys-diag-show=1`; the reading itself is unchanged. -->
        <MediaKeysDiag
            v-if="mediaKeysDiagVisible"
            ref="mediaKeysDiagRef"
            :availability="{ prev: hasPrevTrack, next: hasNextTrack }"
        />
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { generateFilePath } from '@nextcloud/router'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { loadPosition, savePosition, clearPosition } from '../utils/resume'
import {
    setMediaSessionMetadata,
    setMediaSessionPlaybackState,
    setMediaSessionPositionState,
    clearMediaSessionPositionState,
    clearMediaSession,
    supportsMediaSession,
    isMediaKeysDiagRequested,
} from '../utils/mediaSession'
import { generateVideoThumbnail } from '../utils/videoThumbnail'
import { incrementView } from '../utils/viewCount'
import { createFullscreenOrientation, LANDSCAPE_FALLBACK_CLASS } from '../utils/fullscreenOrientation'
import { mountTrackButtons } from '../utils/plyrTrackButtons'
import MediaKeysDiag from './MediaKeysDiag.vue'
import { t } from '../i18n'

const props = defineProps({
    src: { type: String, required: true },
    title: { type: String, default: '' },
    // Used as the localStorage key for resume; pass the video path.
    trackKey: { type: String, default: '' },
    // When false, the track always starts from the beginning (no resume).
    // Auto-advance (next track after ended) passes false so previously watched
    // videos restart from the start; manual selection keeps resume enabled.
    resume: { type: Boolean, default: true },
    // Track navigation owned by the parent (queue/playlist/filters). The player
    // only draws the buttons and emits prev/next; what a neighbour track is
    // (and whether one exists) the parent knows. In fullscreen the buttons join
    // the Plyr row next to play/pause (see src/assets/app.css).
    hasPrevTrack: { type: Boolean, default: false },
    hasNextTrack: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'ended', 'prev', 'next'])

// How long a track may stay stuck in a buffering/stalled state before we force
// a reload. A dropped WebDAV stream freezes the video, and pause+play cannot
// restart it — only a fresh load of the source can.
const STALL_RECOVERY_DELAY = 10000

const videoRef = ref(null)
// Stage 55: the temporary media-key instrument (see the comment on moveMediaKeysDiagIntoPlayer()).
const mediaKeysDiagRef = ref(null)
// Stage 57: the instrument is off by default — it was a measuring tool for stages 54-56, and the headset
// buttons have been confirmed working with it. Read once when the player mounts: `?mediakeys=1` in the page
// address or the localStorage flag `video-media-keys-diag-show=1` bring it back (isMediaKeysDiagRequested()).
const mediaKeysDiagVisible = isMediaKeysDiagRequested()
let player = null
let saveTimer = null
let retryTimer = null
let stallTimer = null
// The track key the player is currently playing (for resume bookkeeping).
let currentTrackKey = ''
// The track whose saved position is not applied yet. A stored value is only trusted once the
// media reports its duration, because only then can we tell whether it belongs to a track that
// has already finished (task 8) — so the seek waits for `loadedmetadata`.
let pendingResumeKey = ''
// The src for which a view has already been counted (one view per track).
let countedSrc = ''
// Keeps the fullscreen orientation in sync with the shape of the video.
let orientationController = null
// The element we tagged with LANDSCAPE_FALLBACK_CLASS (the fullscreen element).
let taggedElement = null
// Prev/next buttons inside the Plyr control row (null while the parent offers
// no track navigation).
let trackButtons = null
// Which cover request is the current one (stage 51). Captures finish in the order the browser
// chooses, so a frame of a track we already left must not be painted over the track playing now.
let coverRequest = 0
// False once the player is gone: a cover that arrives late must not bring the session back.
let playerMounted = false

onMounted(() => {
    const video = videoRef.value

    player = new Plyr(video, {
        controls: ['play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
        settings: ['captions', 'quality', 'speed'],
        title: props.title,
        // What the platform shows on its own media controls (headset buttons, notifications). Plyr's own
        // default is an empty title, so the OS used to display an unnamed item (measured in stage 43).
        mediaMetadata: { title: props.title },
        // Serve the icon sprite from the app itself — the default CDN URL is
        // blocked by Nextcloud's Content Security Policy.
        iconUrl: generateFilePath('video', '', 'js/plyr.svg'),
    })

    currentTrackKey = props.trackKey

    playerMounted = true

    // Listeners are attached once; they also fire after a source change.
    player.on('ready', attemptPlay)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('loadeddata', attemptPlay)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('error', onError)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeupdate)
    video.addEventListener('ended', onEnded)
    // What the platform's media controls need to know about the media itself: how long the track is, how
    // far it has got, and at which rate. `durationchange` also covers a stream whose length only appears
    // after the metadata, and `ratechange` is what Plyr's speed setting turns into.
    video.addEventListener('durationchange', reportPositionState)
    video.addEventListener('ratechange', reportPositionState)
    // The stream stopped delivering data (network hiccup). Watch for it and
    // recover with a reload if playback does not resume on its own.
    video.addEventListener('waiting', onStall)
    video.addEventListener('stalled', onStall)

    document.addEventListener('keydown', onKeydown)

    // Fullscreen orientation (Android): keep the screen matching the shape of the
    // video and tag the fullscreen element for the CSS landscape fallback.
    orientationController = createFullscreenOrientation({
        video,
        onStateChange: applyOrientationState,
    })
    orientationController.start()

    syncTrackButtons()
    moveMediaKeysDiagIntoPlayer()

    prepareTrack()
})

// Stage 55 (task 7, the temporary instrument): Plyr wraps the media element in `div.plyr`, and that wrapper
// is what Plyr takes into real fullscreen. A line rendered next to the player is therefore not painted in
// fullscreen — that is why the instrument of stage 54 could not be read on the device (stage 53-B, finding
// ①; the second finding was that it was mounted only in QueuePlayer, so the "Videos" screen had none).
// The element stays Vue-rendered here — its scoped styles and its subscription to the media-key history keep
// working, only its parent changes — so one instrument covers both screens (both play through this
// component) and lies inside the fullscreen subtree, where the headset buttons are usually pressed.
function moveMediaKeysDiagIntoPlayer() {
    const diag = mediaKeysDiagRef.value
    const container = player && player.elements && player.elements.container
    if (!diag || !diag.$el || !container || diag.$el.parentNode === container) {
        return
    }
    container.appendChild(diag.$el)
}

// The parent owns track navigation; the player only keeps the two buttons in the
// Plyr row in sync with what the parent can do at the moment (first track of a
// queue has no previous one, the last one has no next unless the queue repeats).
function syncTrackButtons() {
    if (!props.hasPrevTrack && !props.hasNextTrack) {
        if (trackButtons) {
            trackButtons.destroy()
            trackButtons = null
        }
        return
    }

    if (!trackButtons) {
        const elements = player && player.elements
        const playButtons = elements && elements.buttons && elements.buttons.play
        trackButtons = mountTrackButtons({
            controls: elements ? elements.controls : null,
            after: Array.isArray(playButtons) ? playButtons[0] || null : playButtons || null,
            labels: { prev: t('prev'), next: t('next') },
            availability: { prev: props.hasPrevTrack, next: props.hasNextTrack },
            onPrev: () => emit('prev'),
            onNext: () => emit('next'),
        })
    }

    trackButtons.setAvailability({ prev: props.hasPrevTrack, next: props.hasNextTrack })
}

watch(() => [props.hasPrevTrack, props.hasNextTrack], syncTrackButtons)

// When the source changes (next video in a queue/playlist), keep the SAME
// player instance instead of recreating it, so fullscreen and controls are
// preserved across tracks.
watch(() => props.src, (next) => {
    const video = videoRef.value
    if (!video || !next) {
        return
    }
    clearRetry()
    saveCurrentPosition()
    currentTrackKey = props.trackKey
    video.src = next
    try {
        video.load()
    } catch (e) {
        // ignore
    }
    prepareTrack()
})

function saveCurrentPosition() {
    const video = videoRef.value
    // Do not save a position for a video that already ended — it would resume
    // right at the end and immediately finish again.
    if (currentTrackKey && video && !video.ended) {
        // The duration is what lets resume.js drop a position that is too close to the end.
        savePosition(currentTrackKey, video.currentTime, video.duration)
    }
}

function prepareTrack() {
    const video = videoRef.value
    if (!video) {
        return
    }
    // The length of the new track is not known yet, so the position state of the track being left is
    // dropped: reported to the platform it would look like the new file was as long as the old one.
    clearMediaSessionPositionState()
    // Plyr writes the platform metadata once, when the player is set up. A track switch reuses this
    // player instance, so the title has to be refreshed here — otherwise the headset/lock-screen control
    // keeps naming the video that was playing when the player opened.
    setMediaSessionMetadata({ title: props.title })
    refreshCover()

    // Resume from the last playback position of the new track (unless the
    // parent asked to start from the beginning, e.g. auto-advance).
    pendingResumeKey = props.trackKey && props.resume ? props.trackKey : ''
    // Usually the seek waits for `loadedmetadata`; when the media is already readable
    // (a reload of the same file), that event will not come again.
    if (pendingResumeKey && video.readyState >= 1) {
        applyPendingResume()
    }
    attemptPlay()
}

// The media reported its length: the stored position can be judged, and the platform can be told.
function onLoadedMetadata() {
    applyPendingResume()
    reportPositionState()
}

// Tell the operating system how long this track is and where its playback is (stage 51).
function reportPositionState() {
    const video = videoRef.value
    if (!video) {
        return
    }
    setMediaSessionPositionState({
        duration: video.duration,
        positioning: video.currentTime,
        playbackRate: video.playbackRate,
    })
}

/**
 * A picture for the platform's media controls — the notification, the lock screen, the media flyout
 * (stage 51, task 7). The app has no server-side preview, so the frame is captured in the browser with the
 * util the video cards already use, and handed over as a JPEG data URL.
 *
 * Two things this must not do: load the file a second time in a browser that cannot show a cover, and let
 * a capture of a track we already left arrive after the next track has been reported.
 */
function refreshCover() {
    if (!supportsMediaSession()) {
        return
    }
    const request = ++coverRequest
    generateVideoThumbnail(props.src)
        .then((frame) => {
            if (!playerMounted || request !== coverRequest) {
                return
            }
            setMediaSessionMetadata({
                title: props.title,
                artwork: [{ src: frame, type: 'image/jpeg' }],
            })
        })
        .catch(() => {
            // A missing cover is a presentation detail; the title is already reported and playback works.
        })
}

// Apply the saved position now that the media reported something about itself.
function applyPendingResume() {
    const video = videoRef.value
    if (!pendingResumeKey || !video) {
        return
    }
    const trackKey = pendingResumeKey
    // loadPosition drops a value that lies within RESUME_MIN_REMAINING seconds of the end:
    // that track was watched through, so this one starts from zero. Without a duration the
    // remaining time cannot be judged and the value is used as it is.
    const position = loadPosition(trackKey, video.duration)
    pendingResumeKey = ''
    if (position > 0) {
        try {
            video.currentTime = position
        } catch (e) {
            // Seek not possible for this file — keep playing from the start.
        }
    }
}

// A track that reached its end is finished: forget its resume position, so opening it again
// starts from the beginning (task 8). This also covers repeat/shuffle, which replay the
// track from zero.
function onEnded() {
    const video = videoRef.value
    if (currentTrackKey) {
        clearPosition(currentTrackKey)
    }
    if (video) {
        pendingResumeKey = ''
    }
    emit('ended')
}

// Start playback automatically. The player is opened by an explicit user
// action (click on a card, play from a queue), so autoplay is expected.
// Retry once data is loaded in case the first attempt was blocked by the
// browser's autoplay policy.
function attemptPlay() {
    const video = videoRef.value
    if (video && video.paused && player) {
        player.play().catch(() => {
            // Autoplay may be blocked; the user can press play manually.
        })
    }
}

function onPause() {
    saveCurrentPosition()
    // The platform (a headset's play/pause button, a lock screen) shows the state we report. Plyr never
    // reports it — stage 43 measured `playbackState: undefined` while a video was playing.
    setMediaSessionPlaybackState('paused')
}

// Playback actually started: cancel any pending retry and count a view once
// per track (used to sort the Videos page by popularity).
function onPlaying() {
    clearRetry()
    clearStall()
    setMediaSessionPlaybackState('playing')
    if (countedSrc !== props.src) {
        countedSrc = props.src
        incrementView(props.trackKey || props.src)
    }
}

// A failed load (e.g. the DNS server not answering during a track switch)
// must not stop the playlist: retry loading every 30 seconds until it works.
function onError() {
    scheduleRetry()
}

function scheduleRetry() {
    if (retryTimer) {
        return
    }
    retryTimer = setTimeout(() => {
        retryTimer = null
        reloadCurrentTrack()
    }, 30000)
}

function clearRetry() {
    if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
    }
}

// Playback is stuck buffering (waiting/stalled) and does not resume on its
// own. A dead stream cannot be restarted with pause+play — only a fresh load
// of the source recovers it, so do that automatically.
function onStall() {
    if (stallTimer) {
        return
    }
    stallTimer = setTimeout(() => {
        stallTimer = null
        reloadCurrentTrack()
    }, STALL_RECOVERY_DELAY)
}

function clearStall() {
    if (stallTimer) {
        clearTimeout(stallTimer)
        stallTimer = null
    }
}

// Re-request the current source and resume playback from the saved position.
function reloadCurrentTrack() {
    const video = videoRef.value
    if (!video || !props.src) {
        return
    }
    clearRetry()
    clearStall()
    saveCurrentPosition()
    video.src = props.src
    try {
        video.load()
    } catch (e) {
        // ignore
    }
    prepareTrack()
}

// Keyboard shortcut: the dedicated media key MediaPlayPause toggles playback.
function onKeydown(event) {
    if (event.code === 'MediaPlayPause' || event.key === 'MediaPlayPause') {
        event.preventDefault()
        togglePlay()
    }
}

function togglePlay() {
    const video = videoRef.value
    if (!video || !player) {
        return
    }
    if (video.paused) {
        player.play().catch(() => {
            // Autoplay may be blocked; the user can press play manually.
        })
    } else {
        player.pause()
    }
}

function onTimeupdate() {
    // The progress marker the platform shows follows the playback. The browser decides how often the
    // operating system is really updated, so every tick is reported here; only the localStorage write
    // below is throttled.
    reportPositionState()

    if (!currentTrackKey || saveTimer) {
        return
    }
    // Throttle position writes to localStorage.
    saveTimer = setTimeout(() => {
        saveTimer = null
        saveCurrentPosition()
    }, 5000)
}

onBeforeUnmount(() => {
    playerMounted = false
    // A frame that is still being captured must not report itself after the player is gone.
    coverRequest += 1
    if (saveTimer) {
        clearTimeout(saveTimer)
    }
    clearRetry()
    clearStall()
    document.removeEventListener('keydown', onKeydown)
    if (orientationController) {
        orientationController.stop()
        orientationController = null
    }
    clearOrientationTag()
    if (trackButtons) {
        trackButtons.destroy()
        trackButtons = null
    }
    saveCurrentPosition()
    clearMediaSession()
    if (player) {
        player.destroy()
    }
})

// Presentation of the orientation state: the module decides what the screen
// should look like, the component tags the fullscreen element so the stylesheet
// (see src/assets/app.css) can rotate it when the browser refuses to rotate.
function applyOrientationState(state) {
    clearOrientationTag()
    if (state.fullscreen && state.landscapeVideo && state.element) {
        state.element.classList.add(LANDSCAPE_FALLBACK_CLASS)
        taggedElement = state.element
    }
}

function clearOrientationTag() {
    if (taggedElement) {
        taggedElement.classList.remove(LANDSCAPE_FALLBACK_CLASS)
        taggedElement = null
    }
}

function close() {
    emit('close')
}
</script>

<style scoped>
.video-player {
    position: relative;
    margin-bottom: 16px;
}

/* Close the player. No dark disc: the icon lies directly on the video and keeps its
   contrast through a drop shadow, so it stays visible over bright and dark frames
   (the old rgba(0,0,0,.6) disc was invisible on a dark picture — measured in stage 23).
   A backdrop appears only on hover/focus, the way Plyr's own controls behave.

   Two defenses against Nextcloud's core CSS, which styles every plain `button`
   (`button:not(.button-vue,[class^=vs__])` in core/css/server.css): min-height:
   var(--default-clickable-area) (44px), margin: 3px, width: 130px, padding: 7px 14px,
   border-radius: 4px, `outline: none` on :hover/:focus, and on :active
   background-color: var(--color-main-background) + color: var(--color-main-text) — i.e. a
   white disc with a dark icon. Measured in stage 27.1 with the real Nextcloud server.css:
   (a) the button came out 28x44 pushed by 3px margins, so `border-radius: 50%` drew a
   vertical pill and the icon no longer matched the shape — what the user reported as "the ✕
   is not centered in the circle"; (b) during a mouse press the disc turned white. Those core
   selectors deliberately skip `.button-vue`, so the button carries that class (the same
   escape hatch @nextcloud/vue uses), and the box is declared completely here as well. */
.video-player__close {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    appearance: none;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    color: #fff;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
}

.video-player__close svg {
    flex: 0 0 auto;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.85));
}

.video-player__close:hover {
    background: rgba(0, 0, 0, 0.55);
}

/* A visible focus ring for keyboard users: the browser default was a 1px dark ring
   that disappeared against the video. */
.video-player__close:focus-visible {
    background: rgba(0, 0, 0, 0.55);
    outline: 2px solid var(--color-primary-element, #0082c9);
    outline-offset: 1px;
}

.video-player__close:active {
    background: rgba(0, 0, 0, 0.7);
}

.video-player__media {
    width: 100%;
    max-height: 70vh;
    background: #000;
}

/* In fullscreen Plyr fullscreens its .plyr wrapper (see src/assets/app.css for
   the landscape fallback); let the video fill it without cropping. */
.video-player__media:fullscreen,
.plyr--fullscreen-fallback .video-player__media,
.plyr:fullscreen .video-player__media {
    max-height: none;
    height: 100%;
    width: 100%;
    object-fit: contain;
}
</style>
