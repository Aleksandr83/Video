<template>
    <div ref="root" class="add-to-playlist">
        <button class="add-to-playlist__toggle" @click="toggle">{{ t('addToPlaylist') }}</button>

        <div
            v-if="open"
            ref="menuEl"
            class="add-to-playlist__menu"
            :class="{ 'add-to-playlist__menu--above': menuAbove }"
        >
            <div class="add-to-playlist__menu-head">
                <span class="add-to-playlist__menu-title">{{ t('addToPlaylist') }}</span>
                <button class="add-to-playlist__close" :title="t('close')" @click="open = false">✕</button>
            </div>

            <div v-if="loading" class="add-to-playlist__loading">{{ t('loading') }}</div>
            <template v-else>
                <div v-if="error" class="add-to-playlist__error">{{ error }}</div>
                <button v-for="pl in playlists" :key="pl.id" class="add-to-playlist__option" @click="add(pl)">
                    {{ pl.name }}
                </button>
                <div v-if="!error && playlists.length === 0" class="add-to-playlist__empty">{{ t('noPlaylists') }}</div>
            </template>

            <!-- Always offer creating a playlist, even when the list failed to load -->
            <form class="add-to-playlist__create" @submit.prevent="createAndAdd">
                <input
                    v-model="newName"
                    class="add-to-playlist__input"
                    type="text"
                    :placeholder="t('playlistNamePlaceholder')"
                    :disabled="creating"
                >
                <button class="add-to-playlist__create-btn" type="submit" :disabled="creating || !newName.trim()">
                    {{ creating ? t('creating') : t('createAndAdd') }}
                </button>
            </form>

            <span v-if="added" class="add-to-playlist__added">{{ t('addedToPlaylist') }}</span>
        </div>
    </div>
</template>

<script setup>
import { nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { getPlaylists, createPlaylist, addPlaylistItem } from '../api/playlists'
import { overflowToShowMenu, planMenuPlacement } from '../utils/menuPlacement'
import { t } from '../i18n'

const props = defineProps({
    path: { type: String, required: true },
})

const root = ref(null)
const menuEl = ref(null)
const menuAbove = ref(false)
const open = ref(false)
const loading = ref(false)
const playlists = ref([])
const error = ref('')
const added = ref(false)
const newName = ref('')
const creating = ref(false)

/**
 * Put the menu on the side of the button that the screen can show, and move the page by whatever still hangs
 * out. Anchored below (the usual case) a 216 px menu was measured hanging 177 px below the bottom edge of a
 * 411x620 screen with five playlists, with every one of its options off screen; anchored above the same button
 * it fits entirely (344..560). The screen is the area here: unlike the list under the video, the card list
 * scrolls with the page, so the only edge this menu can run into is the bottom edge of the viewport.
 */
async function placeMenu() {
    if (!open.value) {
        menuAbove.value = false
        return
    }
    const menu = menuEl.value
    const anchor = root.value ? root.value.querySelector('.add-to-playlist__toggle') : null
    if (!menu || !anchor) {
        return
    }

    const windowBottom = window.innerHeight || 0
    const anchorBox = anchor.getBoundingClientRect()
    const menuBox = menu.getBoundingClientRect()
    const plan = planMenuPlacement({
        anchorTop: anchorBox.top,
        anchorBottom: anchorBox.bottom,
        windowTop: 0,
        windowBottom,
        menuHeight: menuBox.height,
        // `.add-to-playlist__menu` is anchored at `top: 100%`: it starts at the edge of the button, it does
        // not overlap it.
        overlap: 0,
    })

    if (plan.side === 'above' && !menuAbove.value) {
        menuAbove.value = true
        await nextTick()
    }
    if (!open.value || !menuEl.value) {
        return
    }

    const placed = menuEl.value.getBoundingClientRect()
    const shift = overflowToShowMenu({
        windowTop: 0,
        windowBottom,
        menuTop: placed.top,
        menuBottom: placed.bottom,
        side: menuAbove.value ? 'above' : 'below',
    })
    if (shift) {
        window.scrollBy(0, shift)
    }
}

// The menu is drawn before its content is known (it grows when the playlists arrive, and again when a name is
// added or an error line appears), so the side and the shift are recomputed whenever its height can change.
watch([open, loading, error, added, playlists, creating], () => {
    placeMenu()
}, { deep: true })

async function toggle() {
    open.value = !open.value
    if (open.value && playlists.value.length === 0 && !loading.value) {
        await load()
    }
}

// Close the dropdown when clicking outside of it or pressing Escape.
function onDocumentClick(event) {
    if (open.value && root.value && !root.value.contains(event.target)) {
        open.value = false
    }
}

function onKeydown(event) {
    if (event.key === 'Escape') {
        open.value = false
    }
}

onMounted(() => {
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
})

async function load() {
    loading.value = true
    error.value = ''
    added.value = false
    try {
        const { data } = await getPlaylists()
        playlists.value = data.playlists || []
    } catch (e) {
        error.value = t('playlistsLoadError')
    } finally {
        loading.value = false
    }
}

async function add(playlist) {
    added.value = false
    error.value = ''
    try {
        await addPlaylistItem(playlist.id, props.path)
        added.value = true
    } catch (e) {
        error.value = t('playlistsSaveError')
    }
}

// Create a new playlist by name and add the current video to it.
async function createAndAdd() {
    const name = newName.value.trim()
    if (!name || creating.value) {
        return
    }
    creating.value = true
    added.value = false
    error.value = ''
    try {
        const { data } = await createPlaylist(name)
        await addPlaylistItem(data.id, props.path)
        playlists.value.unshift(data)
        newName.value = ''
        added.value = true
    } catch (e) {
        error.value = t('playlistsSaveError')
    } finally {
        creating.value = false
    }
}
</script>

<style scoped>
.add-to-playlist {
    position: relative;
}

.add-to-playlist__menu {
    position: absolute;
    right: 0;
    top: 100%;
    z-index: 20;
    background: var(--color-main-background);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 8px;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.add-to-playlist__menu--above {
    top: auto;
    bottom: 100%;
}

.add-to-playlist__option {
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    padding: 4px;
}

.add-to-playlist__menu-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
}

.add-to-playlist__menu-title {
    font-weight: bold;
}

.add-to-playlist__close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    color: var(--color-text-maxcontrast);
    padding: 0;
}

.add-to-playlist__create {
    display: flex;
    gap: 4px;
    padding-top: 8px;
    margin-top: 8px;
    border-top: 1px solid var(--color-border);
}

.add-to-playlist__input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-main-background);
    color: var(--color-main-text);
}

.add-to-playlist__create-btn {
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--color-primary-element);
    color: var(--color-primary-element-text);
    border: none;
    cursor: pointer;
    white-space: nowrap;
}

.add-to-playlist__create-btn:disabled {
    opacity: 0.5;
    cursor: default;
}

.add-to-playlist__added {
    color: var(--color-success);
}
</style>
