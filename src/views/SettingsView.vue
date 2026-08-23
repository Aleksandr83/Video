<template>
    <div class="settings">
        <h2 class="settings__heading">{{ t('settingsTitle') }}</h2>
        <p class="settings__description">{{ t('settingsDescription') }}</p>

        <div v-if="loading" class="settings__loading">{{ t('loading') }}</div>

        <div v-else-if="folders.length === 0" class="settings__empty">
            {{ t('settingsEmpty') }}
        </div>

        <ul v-else class="settings__list">
            <li v-for="(folder, index) in folders" :key="index" class="settings__item">
                <span class="settings__path">{{ folder.path }}</span>
                <label class="settings__recursive">
                    <input v-model="folder.recursive" type="checkbox">
                    {{ t('settingsRecursive') }}
                </label>
                <button class="settings__remove" @click="removeFolder(index)">{{ t('remove') }}</button>
            </li>
        </ul>

        <div class="settings__actions">
            <button class="settings__add" @click="pickFolder">{{ t('addFolder') }}</button>
            <button class="settings__save" :disabled="saving" @click="save">{{ t('save') }}</button>
            <span v-if="saved" class="settings__saved">{{ t('saved') }}</span>
            <span v-if="error" class="settings__error">{{ error }}</span>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getSettings, saveSettings } from '../api/settings'
import { t } from '../i18n'

const folders = ref([])
const loading = ref(false)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

onMounted(load)

async function load() {
    loading.value = true
    error.value = ''
    try {
        const { data } = await getSettings()
        folders.value = Array.isArray(data.folders) ? data.folders : []
    } catch (e) {
        error.value = t('settingsLoadError')
    } finally {
        loading.value = false
    }
}

function pickFolder() {
    // Legacy OC.dialogs.filepicker signature:
    // (title, callback, multiselect, mimetype, _modal, type, path, options)
    // 'httpd/unix-directory' mimetype makes folders selectable.
    OC.dialogs.filepicker(
        t('pickFolderTitle'),
        (path) => {
            if (path) {
                folders.value.push({ path, recursive: false })
            }
        },
        false,
        'httpd/unix-directory',
    )
}

function removeFolder(index) {
    folders.value.splice(index, 1)
}

async function save() {
    saving.value = true
    saved.value = false
    error.value = ''
    try {
        await saveSettings(folders.value)
        saved.value = true
    } catch (e) {
        error.value = t('settingsSaveError')
    } finally {
        saving.value = false
    }
}
</script>

<style scoped>
.settings__description {
    color: var(--color-text-maxcontrast);
}

.settings__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
}

.settings__path {
    font-family: monospace;
}

.settings__actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
}

.settings__saved {
    color: var(--color-success);
}

.settings__error {
    color: var(--color-error);
}
</style>
