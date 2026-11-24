import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../../src/App.vue'
import { t } from '../../src/i18n'

// Widths cannot be laid out in jsdom, so the measuring step is replaced by numbers while the planning step
// (which decides what stays in the row) runs for real.
vi.mock('../../src/utils/navOverflow', async (importOriginal) => {
    const actual = await importOriginal()
    return { ...actual, measureNav: vi.fn() }
})

import { measureNav } from '../../src/utils/navOverflow.js'

const ViewStub = { name: 'ViewStub', template: '<div class="view-stub"></div>' }

// A row that holds four sections, and a row that cannot hold the fourth one.
const WIDE_ROW = { available: 400, gap: 12, items: [], toggleWidth: 34 }
const NARROW_ROW = {
    available: 300,
    gap: 12,
    items: [
        { name: 'videos', width: 100, collapsible: false },
        { name: 'playlists', width: 100, collapsible: false },
        { name: 'settings', width: 100, collapsible: false },
        { name: 'about', width: 120, collapsible: true },
    ],
    toggleWidth: 34,
}
const EVERY_ITEM_KEPT = (names) => ({
    available: 900,
    gap: 12,
    items: names.map((name) => ({ name, width: 60, collapsible: name === 'about' })),
    toggleWidth: 34,
})

function setAdmin(isAdmin) {
    globalThis.OC.isUserAdmin = () => isAdmin
}

async function mountApp({ admin = false, measurement = WIDE_ROW } = {}) {
    setAdmin(admin)
    measureNav.mockReturnValue(measurement)
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', name: 'home', component: ViewStub },
            { path: '/playlists', name: 'playlists', component: ViewStub },
            { path: '/settings', name: 'settings', component: ViewStub },
            { path: '/about', name: 'about', component: ViewStub },
        ],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [router] } })
    await flushPromises()
    return { wrapper, router }
}

const rowLinks = (wrapper) => wrapper.findAll('.video-app__nav .video-app__link').map((link) => link.text())
const rowHrefs = (wrapper) => wrapper.findAll('.video-app__nav .video-app__link').map((link) => link.attributes('href'))

describe('App header navigation', () => {
    let observers = []

    beforeEach(() => {
        observers = []
        globalThis.ResizeObserver = class {
            constructor(callback) {
                this.callback = callback
                observers.push(this)
            }

            observe() {}

            disconnect() {}
        }
    })

    afterEach(() => {
        document.body.innerHTML = ''
    })

    it('offers the About section to a regular user, next to Videos and Playlists', async () => {
        const { wrapper } = await mountApp({ admin: false })
        const links = wrapper.findAll('.video-app__nav .video-app__link')

        expect(links.map((link) => link.text())).toEqual([t('videosNav'), t('playlistsNav'), t('aboutNav')])
        expect(links.at(-1).attributes('href')).toBe('/about')
        wrapper.unmount()
    })

    it('keeps Settings admin-only and shows About to both', async () => {
        const { wrapper } = await mountApp({ admin: false })
        expect(rowLinks(wrapper)).toEqual([t('videosNav'), t('playlistsNav'), t('aboutNav')])
        wrapper.unmount()

        const admin = await mountApp({ admin: true })
        expect(rowLinks(admin.wrapper)).toEqual([t('videosNav'), t('playlistsNav'), t('settingsNav'), t('aboutNav')])
        expect(rowHrefs(admin.wrapper)).toContain('/settings')
        expect(rowHrefs(admin.wrapper)).toContain('/about')
        admin.wrapper.unmount()
    })

    it('leaves every section in the row when the measurement says they all fit', async () => {
        const { wrapper } = await mountApp({ admin: true, measurement: EVERY_ITEM_KEPT(['videos', 'playlists', 'settings', 'about']) })

        expect(rowLinks(wrapper)).toEqual([t('videosNav'), t('playlistsNav'), t('settingsNav'), t('aboutNav')])
        expect(wrapper.find('.video-app__nav .video-app__more').exists()).toBe(false)
        wrapper.unmount()
    })

    it('moves only the About section into the menu button when the row is too narrow', async () => {
        const { wrapper } = await mountApp({ admin: true, measurement: NARROW_ROW })

        expect(rowLinks(wrapper)).toEqual([t('videosNav'), t('playlistsNav'), t('settingsNav')])
        expect(rowHrefs(wrapper)).not.toContain('/about')
        wrapper.unmount()
    })

    it('shows a caret button with an accessible name instead of the cut-off section', async () => {
        const { wrapper } = await mountApp({ admin: true, measurement: NARROW_ROW })
        const toggle = wrapper.get('.video-app__nav .video-app__more')

        expect(toggle.attributes('aria-label')).toBe(t('navMoreLabel'))
        expect(toggle.attributes('aria-haspopup')).toBe('true')
        expect(toggle.attributes('aria-expanded')).toBe('false')
        expect(toggle.find('svg').exists()).toBe(true)
        expect(toggle.find('svg').attributes('aria-hidden')).toBe('true')
        expect(toggle.text()).toBe('')
        wrapper.unmount()
    })

    it('opens the menu on a click of the caret and lists the section that did not fit', async () => {
        const { wrapper } = await mountApp({ admin: true, measurement: NARROW_ROW })
        const toggle = wrapper.get('.video-app__nav .video-app__more')

        await toggle.trigger('click')

        const menu = wrapper.get('.video-app__menu')
        expect(menu.attributes('role')).toBe('menu')
        expect(menu.findAll('[role="menuitem"]').map((item) => item.text())).toEqual([t('aboutNav')])
        expect(menu.findAll('[role="menuitem"]').at(0).attributes('href')).toBe('/about')
        expect(toggle.attributes('aria-expanded')).toBe('true')
        wrapper.unmount()
    })

    it('navigates to the section from the menu and closes the menu', async () => {
        const { wrapper, router } = await mountApp({ admin: true, measurement: NARROW_ROW })
        await wrapper.get('.video-app__nav .video-app__more').trigger('click')

        await wrapper.get('.video-app__menu [role="menuitem"]').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/about')
        expect(wrapper.find('.video-app__menu').exists()).toBe(false)
        wrapper.unmount()
    })

    it('closes the menu on Escape', async () => {
        const { wrapper } = await mountApp({ admin: true, measurement: NARROW_ROW })
        await wrapper.get('.video-app__nav .video-app__more').trigger('click')
        expect(wrapper.find('.video-app__menu').exists()).toBe(true)

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await flushPromises()

        expect(wrapper.find('.video-app__menu').exists()).toBe(false)
        expect(wrapper.get('.video-app__nav .video-app__more').attributes('aria-expanded')).toBe('false')
        wrapper.unmount()
    })

    it('closes the menu when the click lands outside of it', async () => {
        const { wrapper } = await mountApp({ admin: true, measurement: NARROW_ROW })
        const toggle = wrapper.get('.video-app__nav .video-app__more')
        await toggle.trigger('click')
        expect(wrapper.find('.video-app__menu').exists()).toBe(true)

        document.body.click()
        await flushPromises()

        expect(wrapper.find('.video-app__menu').exists()).toBe(false)
        wrapper.unmount()
    })

    it('measures the row again when the browser reports a new width, and brings the section back', async () => {
        const { wrapper } = await mountApp({ admin: true, measurement: NARROW_ROW })
        expect(rowLinks(wrapper)).not.toContain(t('aboutNav'))

        measureNav.mockReturnValue(EVERY_ITEM_KEPT(['videos', 'playlists', 'settings', 'about']))
        observers.at(-1).callback()
        await flushPromises()

        expect(rowLinks(wrapper)).toEqual([t('videosNav'), t('playlistsNav'), t('settingsNav'), t('aboutNav')])
        expect(wrapper.find('.video-app__nav .video-app__more').exists()).toBe(false)
        wrapper.unmount()
    })

    it('measures the label of the collapsible section from a copy that carries no meaning of its own', async () => {
        const { wrapper } = await mountApp({ admin: true, measurement: NARROW_ROW })
        const measure = wrapper.get('.video-app__measure')

        expect(measure.attributes('aria-hidden')).toBe('true')
        expect(measure.find('.video-app__measure-item').exists()).toBe(true)
        // The copy is not a link: a screen reader and a keyboard must not reach a second About control.
        expect(measure.findAll('a').length).toBe(0)
        expect(measure.findAll('[role="menuitem"]').length).toBe(0)
        wrapper.unmount()
    })
})
