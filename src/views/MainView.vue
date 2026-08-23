<template>
    <div class="main-view">
        <div v-if="loading" class="main-view__loading">{{ t('loading') }}</div>

        <div v-else-if="error" class="main-view__empty main-view__error">{{ error }}</div>

        <div v-else-if="!configured" class="main-view__empty main-view__empty--hint">
            {{ t('noFoldersHint') }}
        </div>

        <template v-else>
            <div class="main-view__toolbar">
                <button v-if="currentFolder" class="main-view__up" @click="goUp">← {{ t('up') }}</button>
                <input v-model="search" class="main-view__search" type="search" :placeholder="t('searchPlaceholder')">
                <select v-model="extensionFilter" class="main-view__filter">
                    <option value="">{{ t('allFormats') }}</option>
                    <option v-for="ext in availableExtensions" :key="ext" :value="ext">{{ ext.toUpperCase() }}</option>
                </select>
            </div>

            <VideoPlayer
                v-if="playing"
                class="main-view__player"
                :src="davFileUrl(playing.path)"
                :title="playing.name"
                :track-key="playing.path"
                :resume="!playFromStart"
                @close="playing = null"
                @ended="onEnded"
            />

            <div v-if="subfolders.length" class="main-view__folders">
                <button v-for="sub in subfolders" :key="sub" class="main-view__folder-btn" @click="openFolder(sub)">{{ sub }}</button>
            </div>

            <div v-if="filteredVideos.length" class="main-view__grid">
                <div v-for="video in filteredVideos" :key="video.path" class="main-view__card">
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

            <div v-else-if="!subfolders.length" class="main-view__empty">
                {{ t('noVideosInFolder') }}
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { getVideos } from '../api/videos'
import { davFileUrl } from '../utils/videoUrl'
import { clearPosition } from '../utils/resume'
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
const currentFolder = ref('')
const subfolders = ref([])
const videos = ref([])
const search = ref('')
const extensionFilter = ref('')

const availableExtensions = computed(() => {
    const set = new Set(
        videos.value
            .map((v) => (v.name.split('.').pop() || '').toLowerCase())
            .filter(Boolean),
    )
    return [...set].sort()
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
        if (extensionFilter.value) {
            const ext = (video.name.split('.').pop() || '').toLowerCase()
            if (ext !== extensionFilter.value) {
                return false
            }
        }
        return true
    })
    // Additional sort: most watched first. Ties keep the natural (path) order
    // because Array#sort is stable and the source list is path-sorted.
    return filtered.sort((a, b) => (viewCounts[b.path] || 0) - (viewCounts[a.path] || 0))
})

onMounted(() => {
    document.addEventListener('keydown', onKeydown)
    load()
})

onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
})

// Dedicated media keys: next / previous clip in the current (filtered) list.
function onKeydown(event) {
    if (event.code === 'MediaTrackNext' || event.key === 'MediaTrackNext') {
        nextManual()
    } else if (event.code === 'MediaTrackPrevious' || event.key === 'MediaTrackPrevious') {
        prevManual()
    }
}

function nextManual() {
    const list = filteredVideos.value
    if (!playing.value || !list.length) {
        return
    }
    const index = list.findIndex((video) => video.path === playing.value.path)
    const nextVideo = index >= 0 ? list[index + 1] : undefined
    if (nextVideo) {
        // When going forward to a video, drop its saved position so it starts
        // from the beginning instead of resuming at (near) the end.
        clearPosition(nextVideo.path)
        playFromStart.value = false
        playing.value = nextVideo
    }
}

function prevManual() {
    const list = filteredVideos.value
    if (!playing.value || !list.length) {
        return
    }
    const index = list.findIndex((video) => video.path === playing.value.path)
    const prevVideo = index > 0 ? list[index - 1] : undefined
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
        const { data } = await getVideos(currentFolder.value)
        configured.value = data.configured
        subfolders.value = data.subfolders || []
        videos.value = data.videos || []
        setViewCounts(data.views || {})
    } catch (e) {
        error.value = t('videosLoadError')
        configured.value = false
        subfolders.value = []
        videos.value = []
    } finally {
        loading.value = false
    }
}

function openFolder(path) {
    currentFolder.value = path
    search.value = ''
    extensionFilter.value = ''
    load()
}

function parentPath(path) {
    const trimmed = path.replace(/\/+$/, '')
    const index = trimmed.lastIndexOf('/')
    return index <= 0 ? '' : trimmed.slice(0, index)
}

function goUp() {
    currentFolder.value = parentPath(currentFolder.value)
    load()
}

// Manual pick from a card: keep the resume feature.
function playVideo(video) {
    playFromStart.value = false
    playing.value = video
}

// After a video finishes, start the next one in the current (filtered) list,
// like YouTube. Auto-advanced tracks start from the beginning. Stops when the
// end of the list is reached.
function onEnded() {
    const list = filteredVideos.value
    if (!playing.value || !list.length) {
        playing.value = null
        return
    }
    const index = list.findIndex((video) => video.path === playing.value.path)
    const nextVideo = index >= 0 ? list[index + 1] || null : null
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

.main-view__folders {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 0 0 16px;
}

.main-view__folder-btn {
    background: var(--color-background-hover);
    border: 1px solid var(--color-border);
    color: var(--color-main-text);
    border-radius: 999px;
    cursor: pointer;
    font-size: 14px;
    padding: 6px 12px;
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
</style>
