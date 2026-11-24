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
                <select class="settings__category"
                        :value="folder.categoryId"
                        :aria-label="t('settingsCategoriesTitle')"
                        @change="chooseCategory(index, $event)">
                    <option :value="NO_CATEGORY">{{ t('settingsNoCategory') }}</option>
                    <option v-for="category in categories" :key="category.id" :value="category.id">
                        {{ category.name }}
                    </option>
                </select>
                <button class="settings__remove"
                        :title="t('settingsRemoveFolder')"
                        :aria-label="t('settingsRemoveFolder')"
                        @click="removeFolder(index)">
                    <TrashIcon />
                </button>
            </li>
        </ul>

        <div class="settings__actions">
            <button class="settings__add" @click="pickFolder">{{ t('addFolder') }}</button>
            <button class="settings__save" :disabled="saving" @click="save">{{ t('save') }}</button>
            <span v-if="saved" class="settings__saved">{{ t('saved') }}</span>
            <span v-if="error" class="settings__error">{{ error }}</span>
        </div>

        <section class="settings__categories">
            <h3 class="settings__categories-heading">{{ t('settingsCategoriesTitle') }}</h3>

            <ul class="settings__category-list">
                <li v-for="category in categories" :key="category.id" class="settings__category-item">
                    <input v-model="category.name"
                           class="settings__category-name"
                           :aria-label="t('settingsCategoriesTitle')">
                    <button class="settings__category-save" :disabled="busy" @click="saveCategory(category)">
                        {{ t('save') }}
                    </button>
                    <button class="settings__category-remove"
                            :disabled="busy"
                            :title="t('settingsRemoveCategory')"
                            :aria-label="t('settingsRemoveCategory')"
                            @click="removeCategory(category)">
                        <TrashIcon />
                    </button>
                </li>
            </ul>

            <div class="settings__category-newline">
                <input v-model="newCategoryName"
                       class="settings__category-new"
                       :placeholder="t('settingsCategoryNew')">
                <button class="settings__category-add" :disabled="busy" @click="addCategory">
                    {{ t('settingsAddCategory') }}
                </button>
            </div>

            <span v-if="categoryError" class="settings__category-error">{{ categoryError }}</span>
        </section>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getSettings, saveSettings } from '../api/settings'
import { getCategories, createCategory, renameCategory, deleteCategory } from '../api/categories'
import TrashIcon from '../components/TrashIcon.vue'
import { t } from '../i18n'

// A folder without a category is stored as 0: the names themselves are rows of the category table,
// and the folder only carries the id.
const NO_CATEGORY = 0

const folders = ref([])
const categories = ref([])
const newCategoryName = ref('')
const loading = ref(false)
const saving = ref(false)
const editingCategory = ref(false)
const saved = ref(false)
const error = ref('')
const categoryError = ref('')

const busy = computed(() => saving.value || editingCategory.value)

onMounted(load)

async function load() {
    loading.value = true
    error.value = ''
    try {
        const [settings, categoryList] = await Promise.all([getSettings(), getCategories()])

        categories.value = Array.isArray(categoryList.data.categories) ? categoryList.data.categories : []
        folders.value = normaliseFolders(
            Array.isArray(settings.data.folders) ? settings.data.folders : [],
            categories.value,
        )
    } catch (e) {
        error.value = t('settingsLoadError')
    } finally {
        loading.value = false
    }
}

/**
 * A folder may carry the id of a category that is gone (deleted from another session), and old
 * settings entries carry no id at all. Both cases must read as "no category" instead of leaving a
 * dangling value in the select.
 */
function normaliseFolders(list, knownCategories) {
    const known = new Set(knownCategories.map((category) => category.id))

    return list.map((folder) => {
        const categoryId = Number(folder.categoryId) || NO_CATEGORY

        return {
            path: folder.path,
            recursive: Boolean(folder.recursive),
            categoryId: known.has(categoryId) ? categoryId : NO_CATEGORY,
        }
    })
}

function chooseCategory(index, event) {
    folders.value[index].categoryId = Number(event.target.value) || NO_CATEGORY
}

function pickFolder() {
    // Legacy OC.dialogs.filepicker signature:
    // (title, callback, multiselect, mimetype, _modal, type, path, options)
    // 'httpd/unix-directory' mimetype makes folders selectable.
    OC.dialogs.filepicker(
        t('pickFolderTitle'),
        (path) => {
            if (path) {
                folders.value.push({ path, recursive: false, categoryId: NO_CATEGORY })
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
        await saveSettings(folders.value.map((folder) => ({
            path: folder.path,
            recursive: folder.recursive,
            categoryId: folder.categoryId,
        })))
        saved.value = true
    } catch (e) {
        error.value = t('settingsSaveError')
    } finally {
        saving.value = false
    }
}

async function addCategory() {
    const name = newCategoryName.value.trim()
    if (name === '') {
        return
    }

    categoryError.value = ''
    editingCategory.value = true
    try {
        const { data } = await createCategory(name)
        categories.value.push({ id: data.id, name: data.name })
        newCategoryName.value = ''
    } catch (e) {
        categoryError.value = t('settingsCategorySaveError')
    } finally {
        editingCategory.value = false
    }
}

async function saveCategory(category) {
    const name = category.name.trim()
    if (name === '') {
        categoryError.value = t('settingsCategorySaveError')
        return
    }

    categoryError.value = ''
    editingCategory.value = true
    try {
        const { data } = await renameCategory(category.id, name)
        // The id stays the same on purpose: the folders using this category keep pointing at it.
        category.name = data.name
    } catch (e) {
        categoryError.value = t('settingsCategorySaveError')
    } finally {
        editingCategory.value = false
    }
}

async function removeCategory(category) {
    categoryError.value = ''
    editingCategory.value = true
    try {
        await deleteCategory(category.id)
        categories.value = categories.value.filter((item) => item.id !== category.id)
        // Unbind the folders that used the category which no longer exists.
        folders.value.forEach((folder) => {
            if (folder.categoryId === category.id) {
                folder.categoryId = NO_CATEGORY
            }
        })
    } catch (e) {
        categoryError.value = t('settingsCategorySaveError')
    } finally {
        editingCategory.value = false
    }
}
</script>

<style scoped>
.settings__description {
    color: var(--color-text-maxcontrast);
}

/* Columns are declared once, on the list, and every row spans them with subgrid: the track sizes
   are then shared by all rows, so the checkbox, the category select and the delete control land on the
   same x in every row no matter how long a folder path is. (A per-row grid cannot do this: each row
   would size its own first track from its own path text, which is exactly what made the rows drift
   apart.) The path column takes at most the widest path, so the controls stay next to the paths instead
   of being pushed to the far end of the line; a path that does not fit wraps instead of being hidden.
   The cap is min(70ch, 100%) rather than 70ch on its own: a 70ch track is 659 px wide no matter how
   narrow the line is, and that put the path cell of a row outside a 379 px list on a 411 px phone.
   The control tracks are max-content, not auto: an auto track absorbs the leftover width of the line,
   which on a 3215 px monitor stretched the category select to 850 px and threw the delete button 706 px
   away from the row it belongs to. With content-sized tracks the surplus stays after the last control. */
.settings__list {
    display: grid;
    grid-template-columns: fit-content(min(70ch, 100%)) max-content fit-content(220px) max-content;
    justify-content: start;
    gap: 0 12px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.settings__item {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    padding: 8px 0;
}

/* Where subgrid is not available the rows keep their own grid, but with the same track sizing so the
   controls are still identical in every row and still refuse to absorb the leftover width. */
@supports not (grid-template-columns: subgrid) {
    .settings__list {
        display: block;
    }

    .settings__item {
        grid-template-columns: fit-content(min(70ch, 100%)) max-content max-content max-content;
        justify-content: start;
    }
}

/* The path is a monospace cell that may wrap: nothing of the configured folder is ever hidden. */
.settings__path {
    font-family: monospace;
    min-width: 0;
    overflow-wrap: anywhere;
}

/* The delete control is a named icon rather than a word. The row's own "Save" is somewhere else on the
   screen, and the same grey word on two different buttons reads as two equally safe actions; removing a
   search folder is the one of the two that changes what the instance looks for. The core already gives a
   button its min-height (34 px), its border and its radius, so only the square footprint, the resting
   colour and the hover colour are declared here. The control keeps its own column and is placed at its
   start, because a control that removes this row has to touch the row it removes. */
.settings__remove,
.settings__category-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--default-clickable-area);
    padding: 0;
    color: var(--color-text-maxcontrast);
}

.settings__remove:hover,
.settings__remove:focus-visible,
.settings__category-remove:hover,
.settings__category-remove:focus-visible {
    color: var(--color-error);
    border-color: var(--color-error);
}

/* A category picker does not need the whole line: without a cap the select grew into the leftover width
   of the row and separated the delete control from the folder it belongs to. The width is a percentage so
   that the picker shrinks together with its own track instead of overflowing it, and the cap is what
   keeps it from growing back into the empty half of a wide monitor. The core adds 3 px of inline-end
   margin to a form control, which on top of the 12 px column gap put the delete control 15 px away from
   the select; the column gap is ours to decide, so the extra margin is dropped. */
.settings__category {
    width: 100%;
    max-width: 220px;
    margin-inline-end: 0;
}

/* On a narrow screen the three controls would eat almost the whole row (measured on 411 px: the path
   column collapsed to 4 px), so the path takes a line of its own there. The shared tracks cannot do that
   job: an item that spans tracks contributes its unbroken width to every one of them, and measured on a
   411 px phone the three tracks grew to 659 px together — wider than the screen, pushing the row out of
   the list. Declaring fewer or narrower tracks does not help either: an empty fourth track took a 349 px
   share just the same. So here the row becomes a wrapping flex line instead — the path takes the whole
   first line, the three controls share the next one, and their widths come from the same declarations in
   every row, which is what keeps the controls aligned from row to row. */
@media (max-width: 700px) {
    .settings__list {
        display: block;
    }

    .settings__item {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
    }

    .settings__path {
        flex: 1 0 100%;
    }

    .settings__category {
        flex: 0 0 150px;
        max-width: 150px;
    }
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

/* Category reference data: one row per stored category, each with its own rename field. */
.settings__categories {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
}

.settings__categories-heading {
    margin: 0;
    font-size: 16px;
}

.settings__category-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.settings__category-item,
.settings__category-newline {
    display: flex;
    align-items: center;
    gap: 12px;
}

/* The core stylesheet sizes every plain input to 130 px, which hides the tail of a category name;
   the width is declared here instead (the scoped rule wins over the core one) and stays inside the
   available line on a phone. */
.settings__category-name,
.settings__category-new {
    width: min(240px, 100%);
    min-width: 0;
}

.settings__category-error {
    color: var(--color-error);
}
</style>
