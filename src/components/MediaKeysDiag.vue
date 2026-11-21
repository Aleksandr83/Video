<template>
    <p class="media-keys-diag" :style="LAYOUT" aria-hidden="true">
        <span class="media-keys-diag__offer" :style="OFFER_STYLE">
            prev {{ availability.prev ? RUNS : REFUSED }} · next {{ availability.next ? RUNS : REFUSED }}
        </span>
        <span
            v-for="(event, index) in events"
            :key="`${event.action}-${event.path}-${event.at}-${index}`"
            class="media-keys-diag__event"
            :style="EVENT_STYLE"
        >
            {{ clock(event.at) }} {{ event.action }} {{ event.path }} {{ results[event.result] || event.result }}
        </span>
    </p>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { subscribeMediaKeys, getRecentMediaKeys } from '../utils/mediaSession'

/**
 * Stage 54-55 (task 7) — a TEMPORARY measuring instrument, not a feature.
 * Stage 57 switched it OFF: it is mounted only when `?mediakeys=1` is in the page address or
 * localStorage `video-media-keys-diag-show` is `1` (isMediaKeysDiagRequested() in src/utils/mediaSession.js),
 * because the device measurement it was made for is done — the headset buttons work on Linux and Android.
 *
 * Why it exists: the user reports that prev/next of Bluetooth headsets work for youtube.com in the same
 * Brave while the browser is not the active app, and not for this app. Where a hardware media key actually
 * goes cannot be observed from a headless browser (stage 30.5 and stage 43 both showed that synthetic media
 * keys never reach the media session there), so the app has to report it on the device itself: did the press
 * arrive at all, through which path, and what did the layer do with it.
 *
 * Stage 55 moved it. As mounted in stage 54 it could not be read on the device (stage 53-B, finding ①): it
 * hung below the player, OUTSIDE `div.plyr`, and `div.plyr` is the element Plyr takes into real fullscreen —
 * so in fullscreen, which is where the headset buttons get pressed, the line was never painted. It is now
 * rendered by `VideoPlayer.vue` and re-parented into the Plyr container (see
 * `moveMediaKeysDiagIntoPlayer()` there): one instrument for both screens — "Playlists" and "Videos" both
 * play through this component — inside the fullscreen subtree, and in normal view too.
 *
 * Removed together with the history recording in src/utils/mediaSession.js when the device measurement is
 * done: this file, its import and its template element in src/components/VideoPlayer.vue, and the tests in
 * tests/js/VideoPlayer.mediaKeysDiag.test.js.
 *
 * Symbols, not words: the reading is the same in any language, and no new interface strings are invented.
 *   ✓ ran — the press changed the track
 *   ∅ no neighbour — arrived, but this queue has no neighbour in that direction (the rule of task 6)
 *   ≈ duplicate — arrived a second time through the other path and was swallowed by the anti-dedupe
 *   ✕ not the owner — another screen owns the media keys now
 * The first two tokens (`prev ✓ · next ✓`) are what the screen offers the platform right now; a press that
 * is missing from the list altogether never reached this page.
 */
const props = defineProps({
    availability: { type: Object, default: () => ({ prev: false, next: false }) },
})

// Everything the instrument needs to sit on the player is written here, inline, not in a stylesheet.
// Why (measured 2026-11-21 with /tmp/vc/check34.mjs, cache-busted per variant, old build rebuilt from git in
// /tmp/vc/prev55): the app is loaded as js/video-main.js + css/video-main.css, and every scoped rule of this
// app only works when those two files come from ONE build — the `data-v-*` hash of a component is part of its
// source. With the CSS of the previous round and the JS of this one, the line lost `position: absolute`, joined
// the flex column of div.plyr as a normal block and stretched the player from 363x150 to 363x209; with no CSS
// at all the player became 395x1530. Measured on the same stand after this change: the same mismatched pair
// leaves the player at 363x150 and the line at 96x25 with `position: absolute`. A measuring instrument must not
// be able to move the thing it measures, so its placement does not depend on the stylesheet.
const LAYOUT = {
    position: 'absolute',
    top: '8px',
    left: '8px',
    zIndex: '2',
    pointerEvents: 'none',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2px 10px',
    margin: '0',
    maxWidth: 'calc(100% - 16px)',
    padding: '4px 8px',
    borderRadius: '4px',
    background: 'rgba(0, 0, 0, .72)',
    color: '#fff',
    fontSize: '12px',
    lineHeight: '1.4',
    fontVariantNumeric: 'tabular-nums',
}

const OFFER_STYLE = { fontWeight: '700' }
const EVENT_STYLE = { whiteSpace: 'nowrap' }

const SHOWN = 6

const RUNS = '✓'
const REFUSED = '∅'

const results = {
    ran: '✓',
    'no-neighbour': '∅',
    duplicate: '≈',
    'not-owner': '✕',
}

const events = ref([])
let unsubscribe = null

function clock(at) {
    const date = new Date(at)
    const pad = (value) => String(value).padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function keep(list) {
    return list.slice(-SHOWN)
}

function render(history) {
    events.value = keep(history.map((event) => ({ ...event })))
}

onMounted(() => {
    // Presses that arrived before this screen was mounted are still worth showing.
    render(getRecentMediaKeys())
    unsubscribe = subscribeMediaKeys((event) => {
        events.value = [...events.value, { ...event }].slice(-SHOWN)
    })
})

onBeforeUnmount(() => {
    if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
    }
})
</script>
