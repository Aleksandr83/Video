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

        <ul v-if="queue.length" ref="listEl" class="queue-player__list">
            <li
                v-for="(item, index) in queue"
                :key="item.path"
                class="queue-player__list-item"
                :class="{ 'queue-player__list-item--menu': menuIndex === index }"
                @contextmenu.prevent="openTrackMenu(index, $event)"
                @pointerdown="trackPressStart(index, $event)"
                @pointerup="trackPressEnd"
                @pointercancel="trackPressEnd"
                @pointermove="cancelHold"
            >
                <button
                    class="queue-player__item"
                    data-selectable="false"
                    :class="{ 'queue-player__item--current': index === currentIndex }"
                    @click="jump(index)"
                >
                    <span class="queue-player__item-num">{{ index + 1 }}</span>
                    <span class="queue-player__item-name">{{ itemName(item) }}</span>
                </button>

                <!-- A right click reaches us as `contextmenu` (measured in Chromium). A finger held on a row
                     does not produce that event here — the menu opened from our own hold timer at +508 ms —
                     so both paths are kept. What the row may do is decided here, in the app: move the track in
                     the saved playlist, or take it out of it. -->
                <div
                    v-if="menuIndex === index"
                    class="queue-player__menu"
                    :style="menuStyle"
                    role="menu"
                    @click.stop
                    @pointerdown.stop="armTrackMenu"
                    @contextmenu.stop.prevent
                >
                    <button
                        class="queue-player__menu-up button-vue"
                        type="button"
                        role="menuitem"
                        :disabled="index === 0"
                        @click="moveTrackUp(index)"
                    >
                        {{ t('up') }}
                    </button>
                    <button
                        class="queue-player__menu-down button-vue"
                        type="button"
                        role="menuitem"
                        :disabled="index === queue.length - 1"
                        @click="moveTrackDown(index)"
                    >
                        {{ t('down') }}
                    </button>
                    <button
                        class="queue-player__menu-remove button-vue"
                        type="button"
                        role="menuitem"
                        @click="removeTrack(index)"
                    >
                        {{ t('remove') }}
                    </button>
                </div>
            </li>
        </ul>
    </div>
</template>

<script setup>
import { ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import VideoPlayer from './VideoPlayer.vue'
import { davFileUrl } from '../utils/videoUrl'
import { clearPosition } from '../utils/resume'
import { mountTrackMediaKeys } from '../utils/mediaSession'
import { usePlaybackQueue } from '../composables/usePlaybackQueue'
import { clampMenuLeft, overflowToShowMenu, planPointerMenuPlacement } from '../utils/menuPlacement'
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
    syncItems,
    previousTrack,
    nextTrack,
    hasPrevTrack,
    hasNextTrack,
} = usePlaybackQueue(props.items)

// The list under the video is a view of the saved playlist, and the playlist is the owner of its order:
// when the screen reorders or removes a track (after the server accepted it) the queue follows the new list
// instead of holding on to the one it was built from.
watch(() => props.items, (items) => syncItems(items))

// The menu of one row at a time: which row was pressed, and when. The timestamp matters because Android
// releases the finger after a long press, and the browser may deliver that release as a click of the row —
// which must not be taken for a request to play another track.
const menuIndex = ref(-1)
const menuAbove = ref(false)
const menuStyle = ref({})
const listEl = ref(null)
// Where the menu was called from, in the page's own coordinates: `clientX`/`clientY` of the right click, or of
// the pointerdown that started the hold.
let menuPress = null
let menuOpenedAt = 0
let holdTimer = null
// A press that is still down, the leftover the list has to move once it is over, and whether the menu was
// pressed since it opened.
let pressIsDown = false
let pendingShift = 0
let menuActionArmed = false

const HOLD_DELAY = 500
const RELEASE_CLICK_GRACE = 700

function openTrackMenu(index, event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault()
    }
    clearHold()
    menuIndex.value = index
    menuOpenedAt = Date.now()
    menuAbove.value = false
    menuActionArmed = false
    pendingShift = 0
    menuPress = event && typeof event.clientX === 'number' ? { x: event.clientX, y: event.clientY } : null
    // The menu is drawn at its final place as soon as it can be measured; until then it sits at the top left
    // corner of its row, which is inside the row and so always visible.
    menuStyle.value = { left: '0px', top: '0px' }
    if (typeof document !== 'undefined') {
        document.addEventListener('pointerdown', closeMenuOnOutside)
        document.addEventListener('keydown', closeMenuOnEscape)
    }
    placeTrackMenu(index)
}

/**
 * Put the menu on the side of the row that the list window can show. The list is a scroll box of its own
 * (`max-height` + `overflow-y: auto`), and a menu hanging below a row near the bottom of it is cut off by that
 * box: measured in Chromium, the menu of the last row of a three-row list hung 48 px below the visible band,
 * and a press at the place its buttons were landed on the page. Anchored above such a row it fits (338..390
 * inside 332..413); when the row has too little room on either side, the list is scrolled by the leftover.
 */
async function placeTrackMenu(index) {
    await nextTick()
    const list = listEl.value
    const row = list ? list.querySelectorAll('.queue-player__list-item')[index] : null
    const menu = row ? row.querySelector('.queue-player__menu') : null
    if (!list || !menu || !row || menuIndex.value !== index) {
        return
    }

    const listBox = list.getBoundingClientRect()
    const rowBox = row.getBoundingClientRect()
    const menuBox = menu.getBoundingClientRect()
    const pressX = menuPress ? menuPress.x : rowBox.left
    const pressY = menuPress ? menuPress.y : rowBox.top

    const plan = planPointerMenuPlacement({
        pressTop: pressY,
        windowTop: listBox.top,
        windowBottom: listBox.bottom,
        menuHeight: menuBox.height,
    })
    // The menu opens at the place it was called from, like the browser's own context menu, and is pulled back
    // when it would hang past the edge of the list. Pinned to the row's right edge instead, it opened 1299 px
    // away from a right click made next to the track label on a 1607 px wide desktop.
    const left = clampMenuLeft({
        rowLeft: listBox.left,
        rowRight: listBox.right,
        menuWidth: menuBox.width,
        pressLeft: pressX,
    })

    menuAbove.value = plan.side === 'above'
    menuStyle.value = menuAbove.value
        ? { left: `${Math.round(left - rowBox.left)}px`, bottom: `${Math.round(rowBox.bottom - pressY)}px` }
        : { left: `${Math.round(left - rowBox.left)}px`, top: `${Math.round(pressY - rowBox.top)}px` }
    await nextTick()

    const measured = row.querySelector('.queue-player__menu')
    if (menuIndex.value !== index || !measured) {
        return
    }

    const placedMenu = row.querySelector('.queue-player__menu')
    if (menuIndex.value !== index || !placedMenu) {
        return
    }

    const placed = placedMenu.getBoundingClientRect()
    const shift = overflowToShowMenu({
        windowTop: list.getBoundingClientRect().top,
        windowBottom: list.getBoundingClientRect().bottom,
        menuTop: placed.top,
        menuBottom: placed.bottom,
        side: menuAbove.value ? 'above' : 'below',
    })
    if (!shift) {
        return
    }
    if (pressIsDown) {
        // Moving the list now would relocate the row out from under the finger that is still on it, and the
        // browser would deliver the release of that press to whatever menu button ended up under it. Measured
        // in Chromium exactly that happened: the release of a held middle row ran the "move up" action and reordered
        // saved playlist without any request to move it.
        pendingShift = shift
        return
    }
    list.scrollTop += shift
}

function closeTrackMenu() {
    menuIndex.value = -1
    menuAbove.value = false
    menuPress = null
    menuStyle.value = {}
    menuActionArmed = false
    pendingShift = 0
    clearHold()
    if (typeof document !== 'undefined') {
        document.removeEventListener('pointerdown', closeMenuOnOutside)
        document.removeEventListener('keydown', closeMenuOnEscape)
    }
}

function clearHold() {
    if (holdTimer) {
        clearTimeout(holdTimer)
        holdTimer = null
    }
}

function trackPressStart(index, event) {
    pressIsDown = true
    if (!event || event.pointerType !== 'touch') {
        return
    }
    clearHold()
    holdTimer = setTimeout(() => {
        holdTimer = null
        openMenuFromHold(index, event)
    }, HOLD_DELAY)
}

function trackPressEnd() {
    pressIsDown = false
    clearHold()
    const list = listEl.value
    if (pendingShift && list && menuIndex.value >= 0) {
        list.scrollTop += pendingShift
    }
    pendingShift = 0
}

function cancelHold() {
    clearHold()
}

// A finger held on a row is a request for the menu: measured in Chromium, a 700 ms hold does not produce a
// `contextmenu` here, so this timer is the path that answers it (a right click does come as `contextmenu`).
// A move or a release cancels it, so a normal tap stays a normal tap.
function openMenuFromHold(index, event) {
    openTrackMenu(index, event)
}

/**
 * A press on the menu is what asks it for an action. The press that opened the menu is not: in Chromium the
 * menu of a row opens while the finger is still down, and the release of that press arrives as a click on
 * whatever button the menu has just placed under the finger.
 */
function armTrackMenu() {
    menuActionArmed = true
}

function closeMenuOnOutside(event) {
    if (menuIndex.value < 0) {
        return
    }
    const row = event && event.target && event.target.closest ? event.target.closest('.queue-player__list-item') : null
    if (row && row.querySelector('.queue-player__menu')) {
        // A press inside the row the menu belongs to belongs to the menu too.
        return
    }
    closeTrackMenu()
}

function closeMenuOnEscape(event) {
    if (event && event.key === 'Escape' && menuIndex.value >= 0) {
        closeTrackMenu()
    }
}

function moveTrackUp(index) {
    reportMove(index, index - 1)
}

function moveTrackDown(index) {
    reportMove(index, index + 1)
}

function reportMove(from, to) {
    if (!menuActionArmed) {
        // The press that opened the menu is not a request to move a track.
        return
    }
    if (from < 0 || to < 0 || to >= queue.value.length || from === to) {
        closeTrackMenu()
        return
    }
    // The order of the playlist is owned by the screen that saved it: report the intent and let the new
    // list come back through props.items.
    emit('reorder', { from, to })
    closeTrackMenu()
}

function removeTrack(index) {
    if (!menuActionArmed) {
        return
    }
    const item = queue.value[index]
    if (!item) {
        closeTrackMenu()
        return
    }
    emit('remove', { index, item })
    closeTrackMenu()
}

// Neighbour tracks come from the queue itself: the buttons under the player, the fullscreen row and the
// media keys all obey the same rule, so all three agree.

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
    closeTrackMenu()
})

// While this queue plays something, both directions stay registered and reachable for the headset — a
// removed action cannot be delivered to us at all (Media Session spec §4.4: an action with no handler is
// aborted before it reaches the page). The neighbour rule of task 6 is unchanged, it only refuses inside. With nothing playing (a closed window, a finished queue) the
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
    // A long press ends with a click in some browsers; while that press is still being answered the row
    // does not change what plays.
    if (menuIndex.value === index && Date.now() - menuOpenedAt < RELEASE_CLICK_GRACE) {
        return
    }
    playFromStart.value = false
    playIndex(index)
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

/* A finger held on selectable text makes Android start a text selection and offer the browser's own menu
   (Copy / Select all / Search the web) above everything the app shows. These rows are controls, not text to
   copy, so they are not selectable and the long press belongs to the app. */
.queue-player__list-item {
    position: relative;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
}

.queue-player__menu {
    position: absolute;
    z-index: 3;
    display: flex;
    /* One item per line: the shape of a context menu, which is what a mouse user expects and where it was
       called from. Its position is set inline by placeTrackMenu(). */
    flex-direction: column;
    gap: 4px;
    padding: 4px;
    background: var(--color-main-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
}

.queue-player__menu button {
    min-height: 44px;
    padding: 6px 12px;
    font-size: 14px;
    white-space: nowrap;
}

.queue-player__menu button[disabled] {
    opacity: 0.35;
}

/* On a touch screen the same three actions stand side by side: the row of buttons is 52 px tall instead of
   140 px, so it fits the window of the queue list far more often. Measured with a held finger: 206x52 with
   buttons 44 px tall, and it is the shape the phone check confirmed. */
@media (pointer: coarse) {
    .queue-player__menu {
        flex-direction: row;
        flex-wrap: wrap;
    }
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
