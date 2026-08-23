<template>
    <div class="queue-player">
        <VideoPlayer
            v-if="current"
            class="queue-player__video"
            :src="davFileUrl(current.path)"
            :title="current.name"
            :track-key="current.path"
            :resume="!playFromStart"
            @ended="nextAuto"
        />

        <div class="queue-player__controls">
            <button
                class="queue-player__icon-btn queue-player__prev"
                :disabled="!current"
                :title="t('prev')"
                :aria-label="t('prev')"
                @click="prevManual"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M6 6h2v12H6zM20 6l-8.5 6L20 18V6z"/>
                </svg>
            </button>
            <button
                class="queue-player__icon-btn queue-player__next"
                :disabled="!current"
                :title="t('next')"
                :aria-label="t('next')"
                @click="nextManual"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M4 6l8.5 6L4 18V6zM16 6h2v12h-2V6z"/>
                </svg>
            </button>
            <button
                class="queue-player__icon-btn queue-player__shuffle"
                :class="{ 'queue-player__control--active': shuffle }"
                :title="shuffle ? t('shuffleOn') : t('shuffleOff')"
                :aria-pressed="shuffle"
                @click="toggleShuffle"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                </svg>
            </button>
            <button
                class="queue-player__icon-btn queue-player__repeat"
                :class="{ 'queue-player__control--active': repeat }"
                :title="repeat ? t('repeatOn') : t('repeatOff')"
                :aria-pressed="repeat"
                @click="toggleRepeat"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                </svg>
            </button>
            <span v-if="current" class="queue-player__current">{{ current.name }}</span>
            <button class="queue-player__close" :title="t('close')" @click="close">✕</button>
        </div>

        <ul v-if="queue.length" class="queue-player__list">
            <li v-for="(item, index) in queue" :key="item.path" class="queue-player__list-item">
                <button
                    class="queue-player__item"
                    :class="{ 'queue-player__item--current': index === currentIndex }"
                    @click="jump(index)"
                >
                    <span class="queue-player__item-num">{{ index + 1 }}</span>
                    <span class="queue-player__item-name">{{ itemName(item) }}</span>
                </button>
            </li>
        </ul>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import VideoPlayer from './VideoPlayer.vue'
import { davFileUrl } from '../utils/videoUrl'
import { clearPosition } from '../utils/resume'
import { usePlaybackQueue } from '../composables/usePlaybackQueue'
import { t } from '../i18n'

const props = defineProps({
    items: { type: Array, default: () => [] },
})

const emit = defineEmits(['close'])

const playFromStart = ref(false)

const {
    queue,
    current,
    currentIndex,
    order,
    cursor,
    shuffle,
    repeat,
    next,
    prev,
    playIndex,
    toggleShuffle,
    toggleRepeat,
    play,
} = usePlaybackQueue(props.items)

onMounted(() => {
    play()
    document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
})

// Keyboard shortcuts: the dedicated media keys MediaTrackNext / MediaTrackPrevious
// switch to the next / previous track (same as the on-screen buttons).
function onKeydown(event) {
    if (event.code === 'MediaTrackNext' || event.key === 'MediaTrackNext') {
        nextManual()
        return
    }
    if (event.code === 'MediaTrackPrevious' || event.key === 'MediaTrackPrevious') {
        prevManual()
    }
}

// Auto-advance after a track ends: the next track starts from the beginning.
function nextAuto() {
    playFromStart.value = true
    next()
}

// Manual track changes keep the resume feature enabled.
function prevManual() {
    // When going back to a track, drop its saved position so it starts from
    // the beginning instead of resuming at (near) the end.
    const target = previousTrack()
    if (target) {
        clearPosition(target.path)
    }
    playFromStart.value = false
    prev()
}

function nextManual() {
    // When going forward to a track, drop its saved position so it starts
    // from the beginning instead of resuming at (near) the end.
    const target = nextTrack()
    if (target) {
        clearPosition(target.path)
    }
    playFromStart.value = false
    next()
}

function jump(index) {
    playFromStart.value = false
    playIndex(index)
}

// The track that prev() will land on (null when it stays on the current one).
function previousTrack() {
    if (cursor.value > 0) {
        const target = order.value[cursor.value - 1]
        return queue.value[target] || null
    }
    return null
}

// The track that next() will land on (null when the queue stops).
function nextTrack() {
    if (cursor.value < order.value.length - 1) {
        const target = order.value[cursor.value + 1]
        return queue.value[target] || null
    }
    if (repeat.value && order.value.length) {
        return queue.value[order.value[0]] || null
    }
    return null
}

// Display name without the file extension (e.g. "clip.mp4" -> "clip").
function itemName(item) {
    const name = item.name || item.path.split('/').pop() || ''
    const dot = name.lastIndexOf('.')
    return dot > 0 ? name.slice(0, dot) : name
}

function close() {
    emit('close')
}
</script>

<style scoped>
.queue-player__controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    flex-wrap: wrap;
}

.queue-player__icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--color-text-maxcontrast);
    cursor: pointer;
}

.queue-player__icon-btn:hover:not(:disabled) {
    background: var(--color-background-dark);
}

.queue-player__icon-btn:disabled {
    opacity: 0.4;
    cursor: default;
}

/* Enabled state (shuffle/repeat): clearly visible filled button. */
.queue-player__control--active {
    background: var(--color-primary-element);
    color: var(--color-primary-element-text);
}

.queue-player__control--active:hover {
    background: var(--color-primary-element-hover, var(--color-primary-element));
}

.queue-player__current {
    color: var(--color-text-maxcontrast);
    margin-left: 8px;
}

.queue-player__list {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-main-background);
}

.queue-player__list-item {
    margin: 0;
}

.queue-player__item {
    display: flex;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-main-text);
}

.queue-player__item--current {
    background: var(--color-background-hover);
    font-weight: bold;
}

.queue-player__item-num {
    color: var(--color-text-maxcontrast);
    min-width: 18px;
}
</style>
