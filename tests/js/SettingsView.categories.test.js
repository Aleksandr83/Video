import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SettingsView from '../../src/views/SettingsView.vue'
import { t } from '../../src/i18n'

vi.mock('../../src/api/settings', () => ({
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
}))

vi.mock('../../src/api/categories', () => ({
    getCategories: vi.fn(),
    createCategory: vi.fn(),
    renameCategory: vi.fn(),
    deleteCategory: vi.fn(),
}))

import { getSettings, saveSettings } from '../../src/api/settings'
import { getCategories, createCategory, renameCategory, deleteCategory } from '../../src/api/categories'

const CATEGORIES = () => [
    { id: 1, name: 'Music' },
    { id: 2, name: 'Films' },
]

const FOLDERS = () => [
    { path: '/Videos/Clips', recursive: true, categoryId: 1 },
    { path: '/11/11he B4.r.m.', recursive: true, categoryId: 0 },
    { path: '/Concerts', recursive: false, categoryId: 2 },
]

async function mountSettings() {
    getSettings.mockResolvedValue({ data: { configured: true, folders: FOLDERS() } })
    getCategories.mockResolvedValue({ data: { categories: CATEGORIES() } })
    const wrapper = mount(SettingsView)
    await flushPromises()
    return wrapper
}

const rows = (wrapper) => wrapper.findAll('.settings__item')
const categorySelects = (wrapper) => wrapper.findAll('.settings__category')
const editorRows = (wrapper) => wrapper.findAll('.settings__category-item')

/**
 * A category belongs to a search folder (one category per configured folder) and the category names
 * live in the database. The folder entry therefore stores the id of a category, the combobox sits
 * before the "Remove" button, and the same screen carries the editor of that reference data.
 */
describe('SettingsView.vue — the category combobox of a search folder', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('every row has a category select placed after the subfolders checkbox and before Remove', async () => {
        const wrapper = await mountSettings()

        expect(categorySelects(wrapper)).toHaveLength(3)
        for (const row of rows(wrapper)) {
            const order = row.findAll('.settings__path, .settings__recursive, .settings__category, .settings__remove')
                .map((el) => el.element.className)
            expect(order).toEqual(['settings__path', 'settings__recursive', 'settings__category', 'settings__remove'])
            expect(row.find('select.settings__category').exists()).toBe(true)
        }
    })

    it('the select offers "no category" plus every stored category, and shows the folder current one', async () => {
        const wrapper = await mountSettings()
        const [first, second, third] = categorySelects(wrapper)

        expect(first.findAll('option').map((o) => o.text())).toEqual([t('settingsNoCategory'), 'Music', 'Films'])
        expect(first.element.value).toBe('1')
        expect(second.element.value).toBe('0')
        expect(third.element.value).toBe('2')
    })

    it('saving sends every folder with its category id, not only with its path and recursive flag', async () => {
        const wrapper = await mountSettings()
        await wrapper.find('.settings__save').trigger('click')
        await flushPromises()

        expect(saveSettings).toHaveBeenCalledTimes(1)
        expect(saveSettings.mock.calls[0][0]).toEqual([
            { path: '/Videos/Clips', recursive: true, categoryId: 1 },
            { path: '/11/11he B4.r.m.', recursive: true, categoryId: 0 },
            { path: '/Concerts', recursive: false, categoryId: 2 },
        ])
    })

    it('choosing a category in the select changes that folder only', async () => {
        const wrapper = await mountSettings()
        const selects = categorySelects(wrapper)
        await selects[1].setValue('2')
        await wrapper.find('.settings__save').trigger('click')
        await flushPromises()

        const sent = saveSettings.mock.calls[0][0]
        expect(sent.map((f) => f.categoryId)).toEqual([1, 2, 2])
    })

    it('a folder keeps "no category" when no category is stored yet', async () => {
        getSettings.mockResolvedValue({ data: { configured: true, folders: [{ path: '/Only', recursive: false, categoryId: 0 }] } })
        getCategories.mockResolvedValue({ data: { categories: [] } })
        const wrapper = mount(SettingsView)
        await flushPromises()

        const select = categorySelects(wrapper)[0]
        expect(select.findAll('option').map((o) => o.text())).toEqual([t('settingsNoCategory')])
        expect(select.element.value).toBe('0')
    })
})

describe('SettingsView.vue — the editor of the category reference data', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('the screen lists every stored category with its own rename field and buttons', async () => {
        const wrapper = await mountSettings()
        const items = editorRows(wrapper)

        expect(items).toHaveLength(2)
        expect(items.map((item) => item.find('input').element.value)).toEqual(['Music', 'Films'])
        // The delete control of a category row is a named icon, so it no longer carries a word: its name
        // lives in aria-label/title (asserted by the icon test below). What stays checked here is that the
        // row still has exactly two controls, in this order.
        expect(items[0].findAll('button').map((b) => b.text())).toEqual([t('save'), ''])
    })

    it('adding a category stores it and offers it in every folder select', async () => {
        createCategory.mockResolvedValue({ data: { id: 3, name: 'Documentaries' } })
        const wrapper = await mountSettings()

        await wrapper.find('.settings__category-new').setValue('Documentaries')
        await wrapper.find('.settings__category-add').trigger('click')
        await flushPromises()

        expect(createCategory).toHaveBeenCalledWith('Documentaries')
        expect(editorRows(wrapper)).toHaveLength(3)
        expect(categorySelects(wrapper)[0].findAll('option').map((o) => o.text()))
            .toEqual([t('settingsNoCategory'), 'Music', 'Films', 'Documentaries'])
    })

    it('renaming keeps the id, so the folders using that category stay attached to it', async () => {
        renameCategory.mockResolvedValue({ data: { id: 1, name: 'Live music' } })
        const wrapper = await mountSettings()
        const first = editorRows(wrapper)[0]

        await first.find('input').setValue('Live music')
        await first.find('.settings__category-save').trigger('click')
        await flushPromises()

        expect(renameCategory).toHaveBeenCalledWith(1, 'Live music')
        expect(categorySelects(wrapper)[0].findAll('option').map((o) => o.text()))
            .toEqual([t('settingsNoCategory'), 'Live music', 'Films'])
        expect(categorySelects(wrapper)[0].element.value).toBe('1')
    })

    it('deleting a category removes it from the list and unbinds the folders that used it', async () => {
        deleteCategory.mockResolvedValue({ data: { status: 'ok' } })
        const wrapper = await mountSettings()

        await editorRows(wrapper)[0].find('.settings__category-remove').trigger('click')
        await flushPromises()

        expect(deleteCategory).toHaveBeenCalledWith(1)
        expect(editorRows(wrapper)).toHaveLength(1)
        expect(categorySelects(wrapper).map((s) => s.element.value)).toEqual(['0', '0', '2'])
    })

    it('a name the server rejects is reported instead of being added to the list', async () => {
        createCategory.mockRejectedValue(new Error('taken'))
        const wrapper = await mountSettings()

        await wrapper.find('.settings__category-new').setValue('Music')
        await wrapper.find('.settings__category-add').trigger('click')
        await flushPromises()

        expect(editorRows(wrapper)).toHaveLength(2)
        expect(wrapper.find('.settings__category-error').exists()).toBe(true)
    })
})

describe('SettingsView.vue — the delete control of the category editor is a named icon as well', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('each stored category exposes an icon-only remove control with an accessible name', async () => {
        const wrapper = await mountSettings()

        expect(editorRows(wrapper)).toHaveLength(2)
        for (const row of editorRows(wrapper)) {
            const button = row.find('.settings__category-remove')
            // The category editor is a second list on the same screen; its delete control has to read the
            // same way as the folder rows, otherwise one of the two looks like a safe action.
            expect(button.find('svg').exists()).toBe(true)
            expect(button.text().trim()).toBe('')
            expect(button.attributes('aria-label')).toBe(t('settingsRemoveCategory'))
            expect(button.attributes('title')).toBe(t('settingsRemoveCategory'))
        }
    })
})
