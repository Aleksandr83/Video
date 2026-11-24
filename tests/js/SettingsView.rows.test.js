import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SettingsView from '../../src/views/SettingsView.vue'
import { t } from '../../src/i18n'

vi.mock('../../src/api/settings', () => ({
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
}))

// The folder rows are about folders, but the screen now needs the category list to draw them.
vi.mock('../../src/api/categories', () => ({
    getCategories: vi.fn(),
    createCategory: vi.fn(),
    renameCategory: vi.fn(),
    deleteCategory: vi.fn(),
}))

import { getSettings, saveSettings } from '../../src/api/settings'
import { getCategories } from '../../src/api/categories'

/**
 * Insurance for the Settings list rearrangement (grid columns instead of a flex flow).
 *
 * The rearrangement itself is pure CSS: jsdom does not lay out, so no red test can describe it —
 * the geometry is proven in real Chromium instead (see plan/stages.md). What these tests protect is
 * the markup and the data the layout works on: the row must keep its controls in a fixed order, the
 * path must stay a single unbroken text node (a grid cell may visually shorten it, but the value must
 * survive), and saving must still send every row with all of its fields.
 *
 * Written before the category column existed; it is updated on purpose in the category round: the row
 * has one control more, and a folder now travels with its category id.
 */
const FOLDERS = [
    { path: '/Videos/Clips', recursive: true },
    { path: '/11/11he B4.r.m.', recursive: true },
    { path: '/Movies/Docs', recursive: false },
]

async function mountSettings(folders = FOLDERS) {
    // A fresh copy per mount: the view keeps mutating the arrays it receives, so a shared
    // module-level fixture would leak one test's edits into the next one.
    getSettings.mockResolvedValue({ data: { configured: true, folders: folders.map((f) => ({ ...f })) } })
    getCategories.mockResolvedValue({ data: { categories: [] } })
    const wrapper = mount(SettingsView)
    await flushPromises()
    return wrapper
}

function rows(wrapper) {
    return wrapper.findAll('.settings__item')
}

describe('SettingsView.vue — search folder rows keep their structure and data', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('every row renders the path, the subfolders checkbox, the category select and the remove button in that order', async () => {
        const wrapper = await mountSettings()
        expect(rows(wrapper)).toHaveLength(3)
        for (const row of rows(wrapper)) {
            const order = row.findAll('.settings__path, .settings__recursive, .settings__category, .settings__remove')
                .map((el) => el.element.className)
            expect(order).toEqual(['settings__path', 'settings__recursive', 'settings__category', 'settings__remove'])
            expect(row.find('.settings__recursive input[type="checkbox"]').exists()).toBe(true)
        }
    })

    it('the path text of a row stays intact (a grid cell may clip it visually, never truncate the value)', async () => {
        const wrapper = await mountSettings()
        expect(rows(wrapper).map((row) => row.find('.settings__path').text())).toEqual([
            '/Videos/Clips',
            '/11/11he B4.r.m.',
            '/Movies/Docs',
        ])
    })

    it('the checkbox mirrors the "recursive" flag from the API and its toggle updates the model', async () => {
        const wrapper = await mountSettings()
        const boxes = rows(wrapper).map((row) => row.find('.settings__recursive input').element.checked)
        expect(boxes).toEqual([true, true, false])

        await rows(wrapper)[2].find('.settings__recursive input').setValue(true)
        await wrapper.find('.settings__save').trigger('click')
        await flushPromises()

        expect(saveSettings).toHaveBeenCalledTimes(1)
        expect(saveSettings.mock.calls[0][0]).toEqual([
            { path: '/Videos/Clips', recursive: true, categoryId: 0 },
            { path: '/11/11he B4.r.m.', recursive: true, categoryId: 0 },
            { path: '/Movies/Docs', recursive: true, categoryId: 0 },
        ])
    })

    it('Remove drops exactly one row and saving sends the remaining rows with all their fields', async () => {
        const wrapper = await mountSettings()
        await rows(wrapper)[1].find('.settings__remove').trigger('click')
        await wrapper.find('.settings__save').trigger('click')
        await flushPromises()

        expect(rows(wrapper).map((row) => row.find('.settings__path').text())).toEqual([
            '/Videos/Clips',
            '/Movies/Docs',
        ])
        expect(saveSettings).toHaveBeenCalledTimes(1)
        expect(saveSettings.mock.calls[0][0]).toEqual([
            { path: '/Videos/Clips', recursive: true, categoryId: 0 },
            { path: '/Movies/Docs', recursive: false, categoryId: 0 },
        ])
    })

    it('the "no category" option is offered even when the instance has no categories yet', async () => {
        const wrapper = await mountSettings()
        const select = rows(wrapper)[0].find('.settings__category')

        expect(select.findAll('option').map((o) => o.text())).toEqual([t('settingsNoCategory')])
        expect(select.element.value).toBe('0')
    })

    it('the folder remove control is a named icon, not a word that looks as safe as Save', async () => {
        const wrapper = await mountSettings()

        for (const row of rows(wrapper)) {
            const button = row.find('.settings__remove')
            // Deleting a search folder must be recognisable without reading a word, and without colour:
            // an icon plus an accessible name that survives a language switch and a screen reader.
            expect(button.find('svg').exists()).toBe(true)
            expect(button.text().trim()).toBe('')
            expect(button.attributes('aria-label')).toBe(t('settingsRemoveFolder'))
            expect(button.attributes('title')).toBe(t('settingsRemoveFolder'))
        }
    })
})
