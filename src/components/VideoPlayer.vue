<template>
    <div class="video-player">
        <button class="video-player__close" :title="t('close')" @click="close">✕</button>
        <video
            ref="videoRef"
            class="video-player__media"
            :src="src"
            :title="title"
        ></video>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { generateFilePath } from '@nextcloud/router'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { loadPosition, savePosition } from '../utils/resume'
import { incrementView } from '../utils/viewCount'
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
})

const emit = defineEmits(['close', 'ended'])

// How long a track may stay stuck in a buffering/stalled state before we force
// a reload. A dropped WebDAV stream freezes the video, and pause+play cannot
// restart it — only a fresh load of the source can.
const STALL_RECOVERY_DELAY = 10000

const videoRef = ref(null)
let player = null
let saveTimer = null
let retryTimer = null
let stallTimer = null
// The track key the player is currently playing (for resume bookkeeping).
let currentTrackKey = ''
// The src for which a view has already been counted (one view per track).
let countedSrc = ''

onMounted(() => {
    const video = videoRef.value

    player = new Plyr(video, {
        controls: ['play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
        settings: ['captions', 'quality', 'speed'],
        title: props.title,
        // Serve the icon sprite from the app itself — the default CDN URL is
        // blocked by Nextcloud's Content Security Policy.
        iconUrl: generateFilePath('video', '', 'js/plyr.svg'),
    })

    currentTrackKey = props.trackKey

    // Listeners are attached once; they also fire after a source change.
    player.on('ready', attemptPlay)
    video.addEventListener('loadeddata', attemptPlay)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('error', onError)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeupdate)
    video.addEventListener('ended', () => emit('ended'))
    // The stream stopped delivering data (network hiccup). Watch for it and
    // recover with a reload if playback does not resume on its own.
    video.addEventListener('waiting', onStall)
    video.addEventListener('stalled', onStall)

    document.addEventListener('keydown', onKeydown)

    prepareTrack()
})

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
        savePosition(currentTrackKey, video.currentTime)
    }
}

function prepareTrack() {
    const video = videoRef.value
    if (!video) {
        return
    }
    // Resume from the last playback position of the new track (unless the
    // parent asked to start from the beginning, e.g. auto-advance).
    if (props.trackKey && props.resume) {
        const position = loadPosition(props.trackKey)
        if (position > 0) {
            try {
                video.currentTime = position
            } catch (e) {
                // Seek not possible for this file — keep playing from the start.
            }
        }
    }
    attemptPlay()
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
}

// Playback actually started: cancel any pending retry and count a view once
// per track (used to sort the Videos page by popularity).
function onPlaying() {
    clearRetry()
    clearStall()
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
    if (saveTimer) {
        clearTimeout(saveTimer)
    }
    clearRetry()
    clearStall()
    document.removeEventListener('keydown', onKeydown)
    saveCurrentPosition()
    if (player) {
        player.destroy()
    }
})

function close() {
    emit('close')
}
</script>

<style scoped>
.video-player {
    position: relative;
    margin-bottom: 16px;
}

.video-player__close {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    line-height: 1;
}

.video-player__media {
    width: 100%;
    max-height: 70vh;
    background: #000;
}

/* In fullscreen Plyr fullscreens the .plyr wrapper; let the video fill it. */
.video-player__media:fullscreen,
.plyr--fullscreen .video-player__media,
.plyr:fullscreen .video-player__media {
    max-height: none;
    height: 100%;
    object-fit: contain;
}
</style>
