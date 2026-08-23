<template>
    <div class="playlists">
        <h2 class="playlists__heading">{{ t('playlistsTitle') }}</h2>

        <QueuePlayer v-if="playing" class="playlists__queue" :items="playing" @close="playing = null" />

        <div class="playlists__create">
            <input v-model="newName" class="playlists__new-name" type="text" :placeholder="t('playlistNamePlaceholder')">
            <button class="playlists__create-btn" :disabled="creating || !newName.trim()" @click="create">
                {{ t('createPlaylist') }}
            </button>
        </div>

        <div v-if="loading" class="playlists__loading">{{ t('loading') }}</div>
        <div v-else-if="error" class="playlists__error">{{ error }}</div>

        <div v-if="!loading && !error && playlists.length === 0" class="playlists__empty">{{ t('noPlaylists') }}</div>

        <ul v-else class="playlists__list">
            <li v-for="pl in playlists" :key="pl.id" class="playlists__item" :class="{ 'playlists__item--active': pl.id === selectedId }">
                <button class="playlists__play" @click="playPlaylist(pl)">{{ t('play') }}</button>
                <button class="playlists__open" @click="open(pl)">{{ pl.name }}</button>
                <button class="playlists__rename" @click="startRename(pl)">{{ t('rename') }}</button>
                <button class="playlists__delete" @click="remove(pl)">{{ t('delete') }}</button>
            </li>
        </ul>

        <div v-if="selected" class="playlists__detail">
            <h3 class="playlists__detail-title">{{ selected.name }}</h3>

            <ul v-if="items.length" class="playlists__items">
                <li v-for="(item, index) in items" :key="item.id" class="playlists__item-row">
                    <span class="playlists__item-path">{{ item.path }}</span>
                    <button class="playlists__move-up" :disabled="index === 0" @click="moveUp(index)">↑</button>
                    <button class="playlists__move-down" :disabled="index === items.length - 1" @click="moveDown(index)">↓</button>
                    <button class="playlists__item-remove" @click="removeItem(item)">{{ t('remove') }}</button>
                </li>
            </ul>
            <div v-else class="playlists__detail-empty">{{ t('playlistEmpty') }}</div>
        </div>

        <div v-if="renaming" class="playlists__rename-form">
            <span class="playlists__rename-label">{{ t('rename') }}:</span>
            <input v-model="renameName" class="playlists__rename-input" type="text">
            <button class="playlists__rename-save" @click="saveRename">{{ t('save') }}</button>
            <button class="playlists__rename-cancel" @click="renaming = null">{{ t('cancel') }}</button>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
    getPlaylists,
    createPlaylist,
    getPlaylist,
    renamePlaylist,
    deletePlaylist,
    removePlaylistItem,
    reorderPlaylistItems,
} from '../api/playlists'
import QueuePlayer from '../components/QueuePlayer.vue'
import { t } from '../i18n'

const playlists = ref([])
const selected = ref(null)
const selectedId = ref(null)
const items = ref([])
const newName = ref('')
const creating = ref(false)
const loading = ref(false)
const error = ref('')
const renaming = ref(null)
const renameName = ref('')
const playing = ref(null)

// A transient network/DNS failure must not leave the page stuck: retry loading
// the playlist list every 10 seconds until it succeeds.
const LOAD_RETRY_DELAY = 10000
let loadRetryTimer = null

onMounted(load)

onBeforeUnmount(() => {
    clearLoadRetry()
})

function scheduleLoadRetry() {
    if (loadRetryTimer) {
        return
    }
    loadRetryTimer = setTimeout(() => {
        loadRetryTimer = null
        load()
    }, LOAD_RETRY_DELAY)
}

function clearLoadRetry() {
    if (loadRetryTimer) {
        clearTimeout(loadRetryTimer)
        loadRetryTimer = null
    }
}

async function playPlaylist(playlist) {
    const { data } = await getPlaylist(playlist.id)
    playing.value = (data.items || []).map((item) => ({
        path: item.path,
        name: item.path.split('/').pop() || item.path,
    }))
}

async function load() {
    loading.value = true
    error.value = ''
    try {
        const { data } = await getPlaylists()
        playlists.value = data.playlists || []
        clearLoadRetry()
    } catch (e) {
        error.value = t('playlistsLoadError')
        scheduleLoadRetry()
    } finally {
        loading.value = false
    }
}

async function create() {
    if (!newName.value.trim() || creating.value) {
        return
    }
    creating.value = true
    error.value = ''
    try {
        const { data } = await createPlaylist(newName.value)
        playlists.value.push(data)
        newName.value = ''
    } catch (e) {
        error.value = t('playlistsSaveError')
    } finally {
        creating.value = false
    }
}

async function open(playlist) {
    selected.value = playlist
    selectedId.value = playlist.id
    error.value = ''
    try {
        const { data } = await getPlaylist(playlist.id)
        items.value = data.items || []
    } catch (e) {
        error.value = t('playlistsLoadError')
    }
}

function startRename(playlist) {
    renaming.value = playlist
    renameName.value = playlist.name
}

async function saveRename() {
    if (!renaming.value || !renameName.value.trim()) {
        return
    }
    try {
        const { data } = await renamePlaylist(renaming.value.id, renameName.value)
        const index = playlists.value.findIndex((pl) => pl.id === data.id)
        if (index !== -1) {
            playlists.value[index] = data
        }
        if (selected.value && selected.value.id === data.id) {
            selected.value = data
        }
    } catch (e) {
        error.value = t('playlistsSaveError')
    } finally {
        renaming.value = null
    }
}

async function remove(playlist) {
    try {
        await deletePlaylist(playlist.id)
        playlists.value = playlists.value.filter((pl) => pl.id !== playlist.id)
        if (selectedId.value === playlist.id) {
            selected.value = null
            selectedId.value = null
            items.value = []
        }
    } catch (e) {
        error.value = t('playlistsSaveError')
    }
}

function moveUp(index) {
    return move(index, index - 1)
}

function moveDown(index) {
    return move(index, index + 1)
}

async function move(from, to) {
    if (to < 0 || to >= items.value.length) {
        return
    }
    const next = [...items.value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    items.value = next

    try {
        await reorderPlaylistItems(selectedId.value, next.map((item) => item.id))
    } catch (e) {
        error.value = t('playlistsSaveError')
        if (selectedId.value) {
            const { data } = await getPlaylist(selectedId.value)
            items.value = data.items || []
        }
    }
}

async function removeItem(item) {
    try {
        await removePlaylistItem(selectedId.value, item.id)
        items.value = items.value.filter((i) => i.id !== item.id)
    } catch (e) {
        error.value = t('playlistsSaveError')
    }
}
</script>

<style scoped>
.playlists__create {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}

.playlists__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
}

.playlists__item--active .playlists__open {
    font-weight: bold;
}

.playlists__open {
    flex: 1;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 15px;
    color: var(--color-primary-element);
    padding: 4px 0;
}

.playlists__item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
}

.playlists__item-path {
    flex: 1;
    font-family: monospace;
}
</style>
