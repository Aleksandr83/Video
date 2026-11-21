<template>
    <div class="queue-player">
        <VideoPlayer
            v-if="current"
            class="queue-player__video"
            :src="davFileUrl(current.path)"
            :title="current.name"
            :track-key="current.path"
            :resume="!playFromStart"
            :has-prev-track="hasPrevTrack"
            :has-next-track="hasNextTrack"
            @ended="nextAuto"
            @prev="prevManual"
            @next="nextManual"
            @close="close"
        />

        <div class="queue-player__controls">
            <button
                class="queue-player__icon-btn button-vue queue-player__prev"
                type="button"
                :disabled="!hasPrevTrack"
                :title="t('prev')"
                :aria-label="t('prev')"
                @click="prevManual"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M6 6h2v12H6zM20 6l-8.5 6L20 18V6z"/>
                </svg>
            </button>
            <button
                class="queue-player__icon-btn button-vue queue-player__next"
                type="button"
                :disabled="!hasNextTrack"
                :title="t('next')"
                :aria-label="t('next')"
                @click="nextManual"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M4 6l8.5 6L4 18V6zM16 6h2v12h-2V6z"/>
                </svg>
            </button>
            <button
                class="queue-player__icon-btn button-vue queue-player__shuffle"
                type="button"
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
                class="queue-player__icon-btn button-vue queue-player__repeat"
                type="button"
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
            <button
                class="queue-player__icon-btn button-vue queue-player__close"
                type="button"
                :title="t('close')"
                :aria-label="t('close')"
                @click="close"
            >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import VideoPlayer from './VideoPlayer.vue'
import { davFileUrl } from '../utils/videoUrl'
import { clearPosition } from '../utils/resume'
import { mountTrackMediaKeys } from '../utils/mediaSession'
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

// Neighbour tracks for the prev/next buttons in the player's fullscreen row.
// Same rules as the buttons below and the media keys, so all three agree.
const hasPrevTrack = computed(() => previousTrack() !== null)
const hasNextTrack = computed(() => nextTrack() !== null)

// The media-key owner of this screen (created on mount, released on unmount).
let mediaKeys = null

onMounted(() => {
    play()
    // This screen owns the queue, so it owns what the media keys mean here. mountTrackMediaKeys()
    // covers both paths a headset press can take (Media Session action and keyboard media key).
    mediaKeys = mountTrackMediaKeys({ onPrev: prevManual, onNext: nextManual })
    syncMediaKeys()
})

onBeforeUnmount(() => {
    if (mediaKeys) {
        mediaKeys.destroy()
        mediaKeys = null
    }
})

// Stage 54: while this queue plays something, both directions stay registered and reachable for the
// headset — a removed action cannot be delivered to us at all (stage 53-A, spec §4.4). The neighbour rule of
// task 6 is unchanged, it only refuses inside. With nothing playing (a closed window, a finished queue) the
// actions are taken away: the platform has nothing to control here.
function syncMediaKeys() {
    if (mediaKeys) {
        mediaKeys.setAvailability({
            prev: hasPrevTrack.value,
            next: hasNextTrack.value,
            playing: !!current.value,
        })
    }
}

watch([hasPrevTrack, hasNextTrack], syncMediaKeys)

// Auto-advance after a track ends: the next track starts from the beginning.
function nextAuto() {
    playFromStart.value = true
    next()
}

// Manual track changes keep the resume feature enabled. They are shared by the
// buttons under the player, the prev/next buttons in the player's fullscreen row
// and the media keys, so all three obey the same neighbour rule.
function prevManual() {
    const target = previousTrack()
    if (!target) {
        // No neighbour: the queue stays as it is. This is what makes a pressed
        // MediaTrackPrevious on the first track (repeat off) do nothing.
        return
    }
    // When going back to a track, drop its saved position so it starts from
    // the beginning instead of resuming at (near) the end.
    clearPosition(target.path)
    playFromStart.value = false
    prev()
}

function nextManual() {
    const target = nextTrack()
    if (!target) {
        // No neighbour: without repeat the end of the queue is the end — the
        // playing window must not disappear from a stray click or media key.
        return
    }
    // When going forward to a track, drop its saved position so it starts
    // from the beginning instead of resuming at (near) the end.
    clearPosition(target.path)
    playFromStart.value = false
    next()
}

function jump(index) {
    playFromStart.value = false
    playIndex(index)
}

// The track that prev() will land on (null when there is no previous one).
// Mirrors nextTrack(): with repeat on, the first track goes back to the last
// one of the current order — which is the shuffled order when shuffle is on.
function previousTrack() {
    if (cursor.value < 0) {
        return null
    }
    if (cursor.value > 0) {
        const target = order.value[cursor.value - 1]
        return queue.value[target] || null
    }
    if (repeat.value && order.value.length) {
        return queue.value[order.value[order.value.length - 1]] || null
    }
    return null
}

// The track that next() will land on (null when the queue has nothing left).
function nextTrack() {
    if (cursor.value < 0) {
        return null
    }
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

/* `button-vue` in the markup is not a style hook. Nextcloud's core CSS (core/css/server.css)
   styles every plain `button:not(.button-vue,[class^=vs__])`: min-height:
   var(--default-clickable-area) (44px), margin: 3px, width: 130px, padding: 7px 14px,
   border-radius: 4px, `outline: none` on :hover/:focus and a white background on :active — and it
   wins for every property this file does not declare itself. Those selectors deliberately skip
   `.button-vue`, so these buttons carry that class, and the box properties are declared here too.
   Measured in stage 27.1 with the real Nextcloud server.css: without this the row buttons were 36x44
   with 3px margins and turned white while pressed. */
.queue-player__icon-btn {
    appearance: none;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 0;
    min-height: 0;
    margin: 0;
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
