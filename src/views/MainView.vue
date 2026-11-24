<template>
    <div class="main-view" :class="{ 'main-view--playing': !!playing }">
        <div v-if="loading" class="main-view__loading">{{ t('loading') }}</div>

        <div v-else-if="error" class="main-view__empty main-view__error">{{ error }}</div>

        <div v-else-if="!configured" class="main-view__empty main-view__empty--hint">
            {{ t('noFoldersHint') }}
        </div>

        <template v-else>
            <div class="main-view__toolbar">
                <input v-model="search" class="main-view__search" type="search" :placeholder="t('searchPlaceholder')">
                <select v-model="categoryFilter" class="main-view__filter">
                    <option value="">{{ t('allCategories') }}</option>
                    <option v-for="category in availableCategories" :key="category.id" :value="category.id">
                        {{ category.name }}
                    </option>
                </select>
            </div>

            <VideoPlayer
                v-if="playing"
                class="main-view__player"
                :src="davFileUrl(playing.path)"
                :title="playing.name"
                :track-key="playing.path"
                :resume="!playFromStart"
                :has-prev-track="hasPrevTrack"
                :has-next-track="hasNextTrack"
                @close="playing = null"
                @ended="onEnded"
                @prev="prevManual"
                @next="nextManual"
            />

            <div class="main-view__list">
                <div v-if="filteredVideos.length" class="main-view__grid">
                    <div
                        v-for="video in filteredVideos"
                        :key="video.path"
                        class="main-view__card"
                        :class="{ 'main-view__card--playing': !!playing && playing.path === video.path }"
                    >
                        <button class="main-view__card-media" @click="playVideo(video)">
                            <VideoThumb :path="video.path" />
                            <span class="main-view__play-badge">▶</span>
                        </button>
                        <div class="main-view__card-body">
                            <div class="main-view__card-title" :title="video.name">{{ stripExtension(video.name) }}</div>
                            <div class="main-view__card-meta">{{ video.path }}</div>
                            <AddToPlaylist class="main-view__card-add" :path="video.path" />
                        </div>
                    </div>
                </div>

                <div v-else class="main-view__empty">
                    {{ t('noVideosInFolder') }}
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getVideos } from '../api/videos'
import { getCategories } from '../api/categories'
import { davFileUrl } from '../utils/videoUrl'
import { clearPosition } from '../utils/resume'
import { mountTrackMediaKeys } from '../utils/mediaSession'
import { getViewCounts, setViewCounts } from '../utils/viewCount'
import VideoPlayer from '../components/VideoPlayer.vue'
import AddToPlaylist from '../components/AddToPlaylist.vue'
import VideoThumb from '../components/VideoThumb.vue'
import { t } from '../i18n'

const loading = ref(false)
const configured = ref(false)
const error = ref('')
const playing = ref(null)
const playFromStart = ref(false)
const videos = ref([])
const search = ref('')
const categories = ref([])
const categoryFilter = ref('')

/**
 * Categories offered by the filter: only those that actually have clips in the loaded list, kept in
 * the order of the reference book (by id) so that renaming a category cannot shuffle the toolbar.
 * An id with no row in the reference book (a category deleted while the settings still mentioned it)
 * offers nothing and hides nothing.
 */
const availableCategories = computed(() => {
    const used = new Set(videos.value.map((video) => Number(video.categoryId) || 0))
    used.delete(0)
    return categories.value.filter((category) => used.has(Number(category.id)))
})

/**
 * Strip the file extension from a display name, e.g. "clip.mp4" -> "clip".
 * Used only for display; the full name is kept for the player and filters.
 */
function stripExtension(name) {
    const dot = name.lastIndexOf('.')
    return dot > 0 ? name.slice(0, dot) : name
}

const filteredVideos = computed(() => {
    const query = search.value.trim().toLowerCase()
    const viewCounts = getViewCounts().value
    const filtered = videos.value.filter((video) => {
        if (query && !video.name.toLowerCase().includes(query)) {
            return false
        }
        if (categoryFilter.value !== '') {
            // The backend puts the id of the owning search folder's category on every clip; 0 means
            // "no category", and such clips are only reachable through "all categories".
            if ((Number(video.categoryId) || 0) !== Number(categoryFilter.value)) {
                return false
            }
        }
        return true
    })
    // Additional sort: most watched first. Ties keep the natural (path) order
    // because Array#sort is stable and the source list is path-sorted.
    return filtered.sort((a, b) => (viewCounts[b.path] || 0) - (viewCounts[a.path] || 0))
})

// The media-key owner of this screen (created on mount, released on unmount).
let mediaKeys = null

onMounted(() => {
    // This screen owns the playing clip, so it owns what the media keys mean here: the card list
    // filtered by the current search/filter is the playlist. mountTrackMediaKeys() covers both paths a
    // headset press can take (Media Session action and keyboard media key).
    mediaKeys = mountTrackMediaKeys({ onPrev: prevManual, onNext: nextManual })
    syncMediaKeys()
    load()
})

onBeforeUnmount(() => {
    if (mediaKeys) {
        mediaKeys.destroy()
        mediaKeys = null
    }
})

/**
 * Neighbours come from the chain the playing clip belongs to: the visible list narrowed to the category
 * of the playing clip, in the order the list currently shows them. The toolbar filter is not consulted,
 * so a clip picked while "all categories" is selected still continues inside its own category, and clips
 * without a category (id 0) chain only among clips without a category.
 */
const playingChain = computed(() => {
    if (!playing.value) {
        return []
    }
    const category = Number(playing.value.categoryId) || 0

    return filteredVideos.value.filter((video) => (Number(video.categoryId) || 0) === category)
})

// Position of the playing clip in its chain (-1 when it is not there).
// Shared by the prev/next navigation and by the player's prev/next buttons, so
// both use the same neighbour rules.
const playingIndex = computed(() => {
    if (!playing.value) {
        return -1
    }
    return playingChain.value.findIndex((video) => video.path === playing.value.path)
})

// The chain is a ring when moving forward: after its last clip comes its first one again. It is not a
// ring when moving back. A chain of a single clip offers no neighbours in either direction.
const hasPrevTrack = computed(() => playingIndex.value > 0)
const hasNextTrack = computed(() => playingChain.value.length > 1 && playingIndex.value >= 0)

// Both directions stay registered while a clip plays (a removed Media Session action cannot be
// delivered to us); the neighbour rule refuses inside the handler. Closing the player takes both away.
function syncMediaKeys() {
    if (mediaKeys) {
        mediaKeys.setAvailability({
            prev: hasPrevTrack.value,
            next: hasNextTrack.value,
            playing: !!playing.value,
        })
    }
}

watch([hasPrevTrack, hasNextTrack], syncMediaKeys)

/**
 * The neighbour of the playing clip inside its own chain: +1 moves forward and wraps to the first clip
 * of the chain, -1 moves back and stops at the first clip. Nothing is returned when the chain holds a
 * single clip or the playing clip is not in it.
 */
function chainNeighbour(step) {
    const chain = playingChain.value
    const index = playingIndex.value

    if (index < 0 || chain.length < 2) {
        return undefined
    }

    if (step > 0) {
        return chain[(index + 1) % chain.length]
    }

    return index > 0 ? chain[index - 1] : undefined
}

function nextManual() {
    const nextVideo = chainNeighbour(1)
    if (nextVideo) {
        // When going forward to a video, drop its saved position so it starts
        // from the beginning instead of resuming at (near) the end.
        clearPosition(nextVideo.path)
        playFromStart.value = false
        playing.value = nextVideo
    }
}

function prevManual() {
    const prevVideo = chainNeighbour(-1)
    if (prevVideo) {
        // When going back to a video, drop its saved position so it starts
        // from the beginning instead of resuming at (near) the end.
        clearPosition(prevVideo.path)
        playFromStart.value = false
        playing.value = prevVideo
    }
}

async function load() {
    loading.value = true
    error.value = ''
    try {
        // The Videos screen shows the configured folders as one flat list (the backend follows the
        // app's recursive setting); folder chips are not rendered, so there is no folder to pass.
        const { data } = await getVideos()
        configured.value = data.configured
        videos.value = data.videos || []
        setViewCounts(data.views || {})
        // The category reference data only feeds the filter select, so it is fetched on its own: the
        // list is on screen as soon as the clips arrive, a slow or failing category request cannot
        // hold the whole screen back, and a failure simply leaves the filter with one option.
        loadCategories()
    } catch (e) {
        error.value = t('videosLoadError')
        configured.value = false
        videos.value = []
        categories.value = []
    } finally {
        loading.value = false
    }
}

/** Reads the category reference book; a failure leaves the filter with its "all categories" option. */
function loadCategories() {
    getCategories()
        .then((response) => {
            categories.value = response?.data?.categories || []
        })
        .catch(() => {
            categories.value = []
        })
}

// Manual pick from a card: keep the resume feature.
function playVideo(video) {
    playFromStart.value = false
    playing.value = video
}

// After a video finishes, start the next clip of the playing clip's own chain (the same neighbour the
// prev/next buttons and the media keys use). Auto-advanced clips start from the beginning. A chain of a
// single clip ends playback, exactly like a chain whose only clip is the playing one.
function onEnded() {
    if (!playing.value || !playingChain.value.length) {
        playing.value = null
        return
    }
    const nextVideo = chainNeighbour(1) || null
    playFromStart.value = true
    playing.value = nextVideo
}
</script>

<style scoped>
.main-view__toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.main-view__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
}

.main-view__card {
    display: flex;
    flex-direction: column;
}

.main-view__card-media {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    border: none;
    border-radius: 8px;
    padding: 0;
    cursor: pointer;
    overflow: hidden;
}

.main-view__play-badge {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 44px;
    color: #fff;
    background: rgba(0, 0, 0, 0.35);
    opacity: 0;
    transition: opacity 0.15s ease;
}

.main-view__card-media:hover .main-view__play-badge,
.main-view__card-media:focus-visible .main-view__play-badge {
    opacity: 1;
}

.main-view__card-body {
    padding: 8px 2px 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.main-view__card-title {
    font-weight: 600;
    color: var(--color-main-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.main-view__card-meta {
    color: var(--color-text-maxcontrast);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.main-view__card-add {
    margin-top: 4px;
}

.main-view__empty--hint {
    color: var(--color-text-maxcontrast);
}

.main-view__error {
    color: var(--color-error);
}

/* The card of the clip that is playing is marked in the list, so the row that plays can be told
   from the others next to it. */
.main-view__card--playing .main-view__card-media {
    outline: 2px solid var(--color-primary-element, #0082c9);
    outline-offset: 2px;
}

/* -------------------------------------------------------------------------
   Phone toolbar: the filter stays, pinned to the right edge, the search
   takes the free space.

   The filter select offers video categories ("all categories" plus the
   categories that have clips in the loaded list). A phone row should not
   leave a dead band on the right: measured in Chromium at 411x917 without
   this rule the search was 177 px and the filter's box ended at 312 px while
   the toolbar spanned to 395 px — 83 px of the row went unused. flex-grow on
   the search absorbs the free space (it sits between the navigation button
   and the filter, so the filter is pushed flush to the right edge);
   min-width: 0 lets the search shrink on the narrowest phones instead of
   pushing the filter out of the row. A desktop (fine pointer or a wide
   window) keeps the compact natural widths — measured unchanged at 177 px
   search on 1280 px.
   ------------------------------------------------------------------------- */
@media (pointer: coarse) and (max-width: 1024px) {
    .main-view__search {
        flex: 1 1 auto;
        min-width: 0;
    }

    .main-view__filter {
        margin-left: auto;
    }
}

/* -------------------------------------------------------------------------
   Watching one clip on a phone: the screen splits into two bands.

   While a clip plays, the root carries main-view--playing and the layout becomes
   a fixed-height grid: toolbar, then the player, then the clip list — the list
   region is the row that takes whatever the player band leaves and scrolls on
   its own, so the video stays visible while the list moves. Measured in Chromium
   at 411x917 before this layout existed: a 16:9 clip left 2 whole cards on the
   screen (379 px wide previews) and reaching the rest of the list scrolled the
   player completely out of view (its box moved to -516..-303); a 9:16 clip took
   379x642 — 70% of the screen. The media gets its own letterboxed band box
   (contain over the player's black background) so a tall clip cannot push the
   list off the screen.

   The media query is the boundary: a coarse pointer and a phone-sized viewport.
   A desktop (fine pointer, or a wide window) keeps the ordinary page flow with
   the full-size grid — measured as 5 columns at 1280 px with 237 px previews.
   Fullscreen is outside this rule: the fullscreen states of the media element
   declare their own full-screen box and keep winning over the capped one.
   ------------------------------------------------------------------------- */
@media (pointer: coarse) and (max-width: 1024px) {
    .main-view--playing {
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
        gap: 8px;
        height: 100%;
        overflow: hidden;
    }

    .main-view--playing .main-view__list {
        min-height: 0;
        overflow-y: auto;
    }

    .main-view--playing .main-view__toolbar,
    .main-view--playing .main-view__player {
        margin-bottom: 0;
    }

    .main-view--playing :deep(.video-player__media) {
        max-height: 38vh;
        object-fit: contain;
    }

    /* Compact rows: a small 16:9 preview with the title, path and the playlist button beside it. */
    .main-view--playing .main-view__grid {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .main-view--playing .main-view__card {
        display: grid;
        grid-template-columns: 132px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
    }

    .main-view--playing .main-view__card-media {
        width: 132px;
    }

    .main-view--playing .main-view__card-body {
        padding-top: 0;
    }

    .main-view--playing .main-view__play-badge {
        font-size: 22px;
    }
}
</style>
