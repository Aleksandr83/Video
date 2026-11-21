import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AddToPlaylist from '../../src/components/AddToPlaylist.vue'
import { getPlaylists } from '../../src/api/playlists'

/**
 * The "add to playlist" menu of a video card is anchored below the card's button. Measured in Chromium on a
 * 411x620 screen with five playlists: the button sat at 560..581 and the menu — 216 px tall — spanned
 * 581..797, so 177 px of it (and every one of its buttons) was below the bottom edge of the screen.
 *
 * The same rule as for the menu of the queue under the video: pick the side that has room in the area that
 * can show the menu (here: the screen), and move the page when even that is not enough. jsdom has no layout,
 * so the measured numbers are installed by hand.
 */
vi.mock('../../src/api/playlists', () => ({
    getPlaylists: vi.fn(),
    createPlaylist: vi.fn(() => Promise.resolve({ data: { id: 12 } })),
    addPlaylistItem: vi.fn(() => Promise.resolve({ data: { ok: true } })),
}))

const FIVE = [
    { id: 7, name: 'Evening' },
    { id: 8, name: 'Weekend' },
    { id: 9, name: 'Work' },
    { id: 10, name: 'Trip' },
    { id: 11, name: 'Archive' },
]
// Measured in Chromium with five playlists; while the playlists are still loading the menu is drawn much
// smaller, so the placement has to be recomputed once the real height is known.
const MENU_HEIGHT = 216
const LOADING_HEIGHT = 30

let restoreLayout = null
let restoreViewport = null
let restoreScrollBy = null
const scrolls = []
let menuHeight = MENU_HEIGHT
// The fixtures are viewport coordinates at the moment the menu is opened; a scroll the app asks for moves
// everything in the page, so the layout has to answer with the moved numbers.
let scrollY = 0

function installMeasuredLayout({ viewportHeight = 620, buttonTop = 560, buttonHeight = 21 }) {
    scrollY = 0
    const original = Element.prototype.getBoundingClientRect
    const rect = (top, bottom) => {
        const moved = top - scrollY
        return { x: 26, y: moved, left: 26, right: 385, top: moved, bottom: bottom - scrollY, width: 359, height: bottom - top }
    }
    Element.prototype.getBoundingClientRect = function () {
        const cl = this.classList
        if (cl && cl.contains('add-to-playlist__toggle')) {
            return rect(buttonTop, buttonTop + buttonHeight)
        }
        if (cl && cl.contains('add-to-playlist__menu')) {
            // The CSS anchors the menu to the button edge with no overlap: `top: 100%` / `bottom: 100%`.
            const top = cl.contains('add-to-playlist__menu--above') ? buttonTop - menuHeight : buttonTop + buttonHeight
            return rect(top, top + menuHeight)
        }
        return original.call(this)
    }
    restoreLayout = () => {
        Element.prototype.getBoundingClientRect = original
        restoreLayout = null
    }

    const originalInnerHeight = window.innerHeight
    Object.defineProperty(window, 'innerHeight', { value: viewportHeight, configurable: true })
    restoreViewport = () => {
        Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true })
        restoreViewport = null
    }

    const originalScrollBy = window.scrollBy
    scrolls.length = 0
    window.scrollBy = (_x, y) => {
        scrolls.push(y)
        scrollY += y
    }
    restoreScrollBy = () => {
        window.scrollBy = originalScrollBy
        restoreScrollBy = null
    }
}

async function openLoadedMenu(buttonTop, viewportHeight = 620) {
    menuHeight = MENU_HEIGHT
    getPlaylists.mockResolvedValue({ data: { playlists: FIVE } })
    installMeasuredLayout({ buttonTop, viewportHeight })
    const wrapper = mount(AddToPlaylist, { attachTo: document.body, props: { path: 'Movies/clip.mp4' } })
    await wrapper.find('.add-to-playlist__toggle').trigger('click')
    await flushPromises()
    return wrapper
}

function menuEl() {
    return document.querySelector('.add-to-playlist__menu')
}

function isAbove() {
    return menuEl().classList.contains('add-to-playlist__menu--above')
}

afterEach(() => {
    if (restoreLayout) restoreLayout()
    if (restoreViewport) restoreViewport()
    if (restoreScrollBy) restoreScrollBy()
    document.body.innerHTML = ''
})

describe('AddToPlaylist — the menu lands where the screen can show it', () => {
    it('a click opens the menu with the playlists', async () => {
        const wrapper = await openLoadedMenu(320)
        expect(menuEl()).toBeTruthy()
        expect(wrapper.findAll('.add-to-playlist__option')).toHaveLength(5)
    })

    it('opens above the button for the measured case: 177 px past the bottom edge of the screen', async () => {
        // The exact geometry from the measurement: button 560..581, screen 0..620, menu 216 px → 581..797.
        await openLoadedMenu(560)
        expect(isAbove()).toBe(true)
        // Above it fits (344..560 inside 0..620), so the page must not move.
        expect(scrolls).toEqual([])
    })

    it('keeps the menu below the button when the screen has room', async () => {
        // The other measured case: button 320..341 → menu 341..557, inside the 620 px screen.
        await openLoadedMenu(320)
        expect(isAbove()).toBe(false)
        expect(scrolls).toEqual([])
    })

    it('moves the page when the menu fits on neither side', async () => {
        // A 200 px screen with the button at 150..171: 29 px of room below, 150 px above, 216 needed.
        await openLoadedMenu(150, 200)
        expect(isAbove()).toBe(true)
        // Above it spans -66..150, so 66 px hang above the screen.
        expect(scrolls).toEqual([-66])
    })

    it('re-places the menu when its content grows after it was drawn', async () => {
        // The menu is drawn while the playlists are still loading (40 px: it fits below), and grows to 216 px
        // when they arrive — the side chosen for the small menu must not be kept for the big one.
        menuHeight = LOADING_HEIGHT
        let resolveLists = null
        getPlaylists.mockImplementation(() => new Promise((resolve) => {
            resolveLists = resolve
        }))
        installMeasuredLayout({ buttonTop: 560, viewportHeight: 620 })
        const wrapper = mount(AddToPlaylist, { attachTo: document.body, props: { path: 'Movies/clip.mp4' } })
        await wrapper.find('.add-to-playlist__toggle').trigger('click')
        await flushPromises()
        expect(isAbove()).toBe(false)

        resolveLists({ data: { playlists: FIVE } })
        menuHeight = MENU_HEIGHT
        await flushPromises()

        expect(wrapper.findAll('.add-to-playlist__option')).toHaveLength(5)
        expect(isAbove()).toBe(true)
    })
})
