import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AboutView from '../../src/views/AboutView.vue'
import { t } from '../../src/i18n'

vi.mock('../../src/api/about', () => ({
    getAbout: vi.fn(),
}))

import { getAbout } from '../../src/api/about.js'

const SUMMARY = {
    appVersion: '1.2.0',
    nextcloudVersion: '34.0.4.2',
    migrations: [
        { version: '010000Date20260815220000', token: '010000', applied: true },
        { version: '010100Date20260823000000', token: '010100', applied: true },
        { version: '010300Date20261123114500', token: '010300', applied: true },
    ],
    warnings: [],
}

async function mountAbout(payload = SUMMARY, fail = false) {
    if (fail) {
        getAbout.mockRejectedValue(new Error('the app information endpoint is not reachable'))
    } else {
        getAbout.mockResolvedValue({ data: payload })
    }
    const wrapper = mount(AboutView)
    await flushPromises()
    return wrapper
}

const migrationRows = (wrapper) => wrapper.findAll('.about-view__migration').map((row) => ({
    version: row.get('.about-view__migration-version').text(),
    status: row.get('.about-view__migration-status').text(),
    applied: row.attributes('data-applied'),
}))

describe('AboutView', () => {
    beforeEach(() => {
        getAbout.mockReset()
    })

    it('shows the version of the app that Nextcloud itself reports', async () => {
        const wrapper = await mountAbout()

        expect(wrapper.get('.about-view__app-version').text()).toBe('1.2.0')
        expect(wrapper.text()).toContain(t('aboutAppVersion'))
    })

    it('shows the version of Nextcloud the app runs on', async () => {
        const wrapper = await mountAbout()

        expect(wrapper.get('.about-view__nextcloud-version').text()).toBe('34.0.4.2')
        expect(wrapper.text()).toContain(t('aboutNextcloudVersion'))
    })

    it('lists every migration of the app with the version string from its file name', async () => {
        const wrapper = await mountAbout()
        const rows = migrationRows(wrapper)

        expect(rows.map((row) => row.version)).toEqual([
            '010000Date20260815220000',
            '010100Date20260823000000',
            '010300Date20261123114500',
        ])
        expect(rows.every((row) => row.applied === 'true')).toBe(true)
        expect(rows.map((row) => row.status)).toEqual(Array(3).fill(t('aboutMigrationApplied')))
    })

    it('says which migration has not been applied yet', async () => {
        const wrapper = await mountAbout({
            ...SUMMARY,
            migrations: SUMMARY.migrations.map((m, index) => ({ ...m, applied: index < 2 })),
            warnings: ['migration_not_applied'],
        })
        const rows = migrationRows(wrapper)

        expect(rows.map((row) => row.applied)).toEqual(['true', 'true', 'false'])
        expect(rows.at(-1).status).toBe(t('aboutMigrationNotApplied'))
    })

    it('warns on its own line when a migration is still pending', async () => {
        const wrapper = await mountAbout({
            ...SUMMARY,
            migrations: SUMMARY.migrations.map((m, index) => ({ ...m, applied: index < 2 })),
            warnings: ['migration_not_applied'],
        })
        const warnings = wrapper.findAll('.about-view__warning').map((row) => row.text())

        expect(warnings).toEqual([t('aboutWarningMigrationNotApplied')])
    })

    it('warns when the declared app version is below its newest migration', async () => {
        const wrapper = await mountAbout({ ...SUMMARY, appVersion: '1.1.0', warnings: ['version_below_migrations'] })

        expect(wrapper.findAll('.about-view__warning').map((row) => row.text())).toEqual([t('aboutWarningVersionBelowMigrations')])
        expect(wrapper.get('.about-view__app-version').text()).toBe('1.1.0')
    })

    it('shows no warning line while nothing is wrong', async () => {
        const wrapper = await mountAbout()

        expect(wrapper.find('.about-view__warnings').exists()).toBe(false)
    })

    it('says it could not read the information instead of inventing a version', async () => {
        const wrapper = await mountAbout(undefined, true)

        expect(wrapper.get('.about-view__error').text()).toBe(t('aboutLoadError'))
        expect(wrapper.find('.about-view__app-version').exists()).toBe(false)
        expect(wrapper.find('.about-view__migrations').exists()).toBe(false)
    })

    it('accepts a summary without migration rows and shows only the versions', async () => {
        const wrapper = await mountAbout({ appVersion: '1.2.0', nextcloudVersion: '34.0.4.2' })

        expect(wrapper.find('.about-view__migrations').exists()).toBe(false)
        expect(wrapper.get('.about-view__app-version').text()).toBe('1.2.0')
        expect(wrapper.find('.about-view__warnings').exists()).toBe(false)
    })
})

describe('i18n tables for the new labels', () => {
    const KEYS = [
        'aboutNav', 'navMoreLabel', 'aboutTitle', 'aboutLoading', 'aboutLoadError', 'aboutAppVersion',
        'aboutNextcloudVersion', 'aboutMigrationsTitle', 'aboutMigrationApplied', 'aboutMigrationNotApplied',
        'aboutWarningMigrationNotApplied', 'aboutWarningVersionBelowMigrations',
    ]

    it('carries every new label in Russian and in English', () => {
        const language = globalThis.OC.getLanguage
        try {
            for (const key of KEYS) {
                globalThis.OC.getLanguage = () => 'ru'
                expect(t(key), `russian label for ${key}`).not.toBe(key)
                globalThis.OC.getLanguage = () => 'en'
                expect(t(key), `english label for ${key}`).not.toBe(key)
            }
        } finally {
            globalThis.OC.getLanguage = language
        }
    })
})
