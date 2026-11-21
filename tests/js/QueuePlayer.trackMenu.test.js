import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import QueuePlayer from '../../src/components/QueuePlayer.vue'

/**
 * On Android a long press on a track of the queue opened the browser's own menu
 * ("Copy", "Select all", "Search the web"), because the track label is selectable text: Chromium answers a
 * long press on selectable text by starting a selection and offering that menu. The app has to answer the
 * long press itself, and the track label must not be selectable at all.
 *
 * The menu the app shows offers what the user asked for: move the track up, move it down, remove it from the
 * playlist. Reordering and removing belong to the saved playlist, so QueuePlayer reports the intent and the
 * screen that owns the playlist persists it.
 *
 * Where the menu appears is decided by measurements taken in Chromium, and the numbers below are those
 * measurements (jsdom has no layout, so the geometry is installed by hand):
 *   - the menu is anchored to the PLACE that was pressed. Pinned to the right edge of the row instead, it
 *     opened 1299 px away from the cursor on a 1607 px wide desktop (row 24..1583, menu 206 px wide);
 *   - the queue list is a scroll window of its own (`max-height: 240px` + `overflow-y: auto`), and a menu
 *     that does not fit inside it is cut off by that window: the menu of the last row of a three-row list
 *     hung 48 px below the visible band, and a press where its buttons visually were landed on the page.
 *   - a row is 27 px tall, the menu measures 206x52 when its items stand in one row and 93x140 when they are
 *     stacked one per line.
 */
vi.mock('plyr', () => ({
    __esModule: true,
    default: class MockPlyr {
        constructor(el) {
            const container = document.createElement('div')
            container.className = 'plyr'
            const controls = document.createElement('div')
            controls.className = 'plyr__controls'
            el.parentNode.insertBefore(container, el)
            container.appendChild(el)
            container.appendChild(controls)
            this.elements = { container, controls, buttons: { play: [] } }
        }
        on() {}
        play() { return Promise.resolve() }
        pause() {}
        destroy() { this.destroyed = true }
    },
}))

vi.mock('@nextcloud/router', () => ({ generateFilePath: () => '/apps/video/js/plyr.svg' }))
vi.mock('../../src/utils/videoUrl', () => ({ davFileUrl: (path) => `/dav/${path}` }))
vi.mock('../../src/utils/viewCount', () => ({ incrementView: vi.fn() }))
vi.mock('../../src/utils/videoThumbnail', () => ({
    generateVideoThumbnail: vi.fn(() => Promise.resolve('data:image/jpeg;base64,FRAME')),
}))

const tracks = [
    { path: 'Movies/a.mp4', name: 'a.mp4', id: 1 },
    { path: 'Movies/b.mp4', name: 'b.mp4', id: 2 },
    { path: 'Movies/c.mp4', name: 'c.mp4', id: 3 },
]

const ROW_H = 27
const MENU_W = 206
const MENU_H = 52

async function mountQueue(items = tracks) {
    const wrapper = mount(QueuePlayer, { attachTo: document.body, props: { items } })
    await wrapper.vm.$nextTick()
    return wrapper
}

function listItems(wrapper) {
    return wrapper.findAll('.queue-player__list-item')
}

/** The press of a finger held on a track, or a right click: both are `contextmenu` with coordinates. */
function pressAndHold(item, clientX = 100, clientY = 400) {
    const event = new Event('contextmenu', { bubbles: true, cancelable: true })
    event.clientX = clientX
    event.clientY = clientY
    event.pointerType = 'touch'
    item.element.dispatchEvent(event)
    return event
}

/** A touch pointer event, built the way the component reads it. */
function firePointer(item, type, props = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, props)
    item.element.dispatchEvent(event)
    return event
}

/**
 * The geometry of the queue list, installed by hand: the window of the list, its rows, and the menu placed
 * by the inline `left`/`top`/`bottom` the component computes from the measured press point.
 */
let restoreLayout = null

function installMeasuredLayout({ left = 24, right = 387, top = 332, bottom = 413, rowHeight = ROW_H, menuWidth = MENU_W, menuHeight = MENU_H } = {}) {
    const original = Element.prototype.getBoundingClientRect
    const rect = (l, t, r, b) => ({ x: l, y: t, left: l, top: t, right: r, bottom: b, width: r - l, height: b - t })

    Element.prototype.getBoundingClientRect = function () {
        const cl = this.classList
        if (cl && cl.contains('queue-player__list')) {
            return rect(left, top, right, bottom)
        }
        if (cl && cl.contains('queue-player__list-item')) {
            const i = [...this.parentElement.children].indexOf(this)
            return rect(left, top + i * rowHeight, right, top + (i + 1) * rowHeight)
        }
        if (cl && cl.contains('queue-player__menu')) {
            const rowBox = this.closest('.queue-player__list-item').getBoundingClientRect()
            const style = this.style
            const menuLeft = rowBox.left + (parseFloat(style.left) || 0)
            const grownUp = style.top === '' || style.top === undefined
            const menuBottom = grownUp
                ? rowBox.bottom - (parseFloat(style.bottom) || 0)
                : rowBox.top + (parseFloat(style.top) || 0) + menuHeight
            return rect(menuLeft, menuBottom - menuHeight, menuLeft + menuWidth, menuBottom)
        }
        return original.call(this)
    }

    restoreLayout = () => {
        Element.prototype.getBoundingClientRect = original
        restoreLayout = null
    }
}

function menuEl() {
    return document.querySelector('.queue-player__menu')
}

function menuBox() {
    return menuEl().getBoundingClientRect()
}

function listEl() {
    return document.querySelector('.queue-player__list')
}

describe('QueuePlayer — the track menu replaces the browser menu', () => {
    let wrapper

    afterEach(() => {
        if (wrapper) {
            wrapper.unmount()
            wrapper = null
        }
        if (restoreLayout) {
            restoreLayout()
        }
        document.body.innerHTML = ''
    })

    it('a held finger on a track does not get the browser default menu', async () => {
        wrapper = await mountQueue()
        const event = pressAndHold(listItems(wrapper)[1])
        await wrapper.vm.$nextTick()

        expect(event.defaultPrevented).toBe(true)
    })

    it('the app menu offers Move up, Move down and Remove', async () => {
        wrapper = await mountQueue()
        expect(wrapper.find('.queue-player__menu').exists()).toBe(false)

        pressAndHold(listItems(wrapper)[1])
        await flushPromises()

        const menu = wrapper.find('.queue-player__menu')
        expect(menu.exists()).toBe(true)
        expect(menu.find('.queue-player__menu-up').exists()).toBe(true)
        expect(menu.find('.queue-player__menu-down').exists()).toBe(true)
        expect(menu.find('.queue-player__menu-remove').exists()).toBe(true)
        // A menu of the app is announced as a menu, not as decoration.
        expect(menu.attributes('role')).toBe('menu')
    })

    it('the track that the menu was called for is marked, so the actions cannot hit another row', async () => {
        wrapper = await mountQueue()
        const items = listItems(wrapper)

        pressAndHold(items[2])
        await flushPromises()

        expect(items[2].classes()).toContain('queue-player__list-item--menu')
        expect(items[1].classes()).not.toContain('queue-player__list-item--menu')
        expect(wrapper.find('.queue-player__menu').exists()).toBe(true)
    })

    it('the first track cannot move up and the last one cannot move down', async () => {
        installMeasuredLayout({ bottom: 332 + ROW_H * 8 })
        wrapper = await mountQueue()

        pressAndHold(listItems(wrapper)[0], 100, 345)
        await flushPromises()
        expect(wrapper.find('.queue-player__menu-up').attributes('disabled')).toBeDefined()
        expect(wrapper.find('.queue-player__menu-down').attributes('disabled')).toBeUndefined()
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await flushPromises()

        pressAndHold(listItems(wrapper)[2], 100, 400)
        await flushPromises()
        expect(wrapper.find('.queue-player__menu-up').attributes('disabled')).toBeUndefined()
        expect(wrapper.find('.queue-player__menu-down').attributes('disabled')).toBeDefined()
    })

    it('Move up and Move down report the intent to the screen that owns the playlist', async () => {
        installMeasuredLayout({ bottom: 332 + ROW_H * 8 })
        wrapper = await mountQueue()

        pressAndHold(listItems(wrapper)[2], 100, 400)
        await flushPromises()
        await wrapper.find('.queue-player__menu-up').trigger('pointerdown')
        await wrapper.find('.queue-player__menu-up').trigger('click')

        expect(wrapper.emitted('reorder')).toEqual([[{ from: 2, to: 1 }]])
        expect(wrapper.find('.queue-player__menu').exists()).toBe(false)
        // The queue itself still shows the saved order: only the playlist owner may change it.
        expect(wrapper.findAll('.queue-player__item-name').map((n) => n.text())).toEqual(['a', 'b', 'c'])

        pressAndHold(listItems(wrapper)[0], 100, 345)
        await flushPromises()
        await wrapper.find('.queue-player__menu-down').trigger('pointerdown')
        await wrapper.find('.queue-player__menu-down').trigger('click')
        expect(wrapper.emitted('reorder')).toHaveLength(2)
        expect(wrapper.emitted('reorder')[1]).toEqual([{ from: 0, to: 1 }])
    })

    it('Remove reports which track left the playlist', async () => {
        installMeasuredLayout({ bottom: 332 + ROW_H * 8 })
        wrapper = await mountQueue()

        pressAndHold(listItems(wrapper)[1], 100, 372)
        await flushPromises()
        await wrapper.find('.queue-player__menu-remove').trigger('pointerdown')
        await wrapper.find('.queue-player__menu-remove').trigger('click')

        expect(wrapper.emitted('remove')).toEqual([[{ index: 1, item: tracks[1] }]])
        expect(wrapper.find('.queue-player__menu').exists()).toBe(false)
    })

    it('opening the menu does not change what is playing', async () => {
        installMeasuredLayout({ bottom: 332 + ROW_H * 8 })
        wrapper = await mountQueue()
        const before = wrapper.find('.queue-player__item--current').text()

        pressAndHold(listItems(wrapper)[2], 100, 400)
        await flushPromises()

        expect(wrapper.find('.queue-player__item--current').text()).toBe(before)
    })

    it('the press that opened the menu does not also jump to that track', async () => {
        installMeasuredLayout({ bottom: 332 + ROW_H * 8 })
        wrapper = await mountQueue()
        const before = wrapper.find('.queue-player__item--current').text()

        const item = listItems(wrapper)[2]
        pressAndHold(item, 100, 400)
        await flushPromises()
        // Android releases the finger after the long press and Chromium may deliver a click as well.
        await item.find('.queue-player__item').trigger('click')

        expect(wrapper.find('.queue-player__item--current').text()).toBe(before)
    })

    it('the press that opened the menu does not act on one of its buttons', async () => {
        // Measured in Chromium: the menu opens while the finger is still down, and the release of that press
        // arrives as a click on the button the menu has just placed under the finger.
        installMeasuredLayout()
        wrapper = await mountQueue()

        pressAndHold(listItems(wrapper)[1], 100, 372)
        await flushPromises()
        await wrapper.find('.queue-player__menu-up').trigger('click')

        expect(wrapper.emitted('reorder')).toBeUndefined()
        expect(wrapper.find('.queue-player__menu').exists()).toBe(true)

        // A press of its own on the menu is what asks for an action.
        await wrapper.find('.queue-player__menu-up').trigger('pointerdown')
        await wrapper.find('.queue-player__menu-up').trigger('click')

        expect(wrapper.emitted('reorder')).toEqual([[{ from: 1, to: 0 }]])
    })

    it('a normal tap still plays the track', async () => {
        wrapper = await mountQueue()

        await listItems(wrapper)[2].find('.queue-player__item').trigger('click')

        expect(wrapper.find('.queue-player__item--current').text()).toContain('c')
    })

    it('Escape and a tap outside close the menu', async () => {
        installMeasuredLayout({ bottom: 332 + ROW_H * 8 })
        wrapper = await mountQueue()
        pressAndHold(listItems(wrapper)[1], 100, 372)
        await flushPromises()
        expect(wrapper.find('.queue-player__menu').exists()).toBe(true)

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await flushPromises()
        expect(wrapper.find('.queue-player__menu').exists()).toBe(false)

        pressAndHold(listItems(wrapper)[1], 100, 372)
        await flushPromises()
        document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
        await flushPromises()
        expect(wrapper.find('.queue-player__menu').exists()).toBe(false)
    })

    it('the menu belongs to the track list, never to the row of player buttons', async () => {
        installMeasuredLayout({ bottom: 332 + ROW_H * 8 })
        wrapper = await mountQueue()
        const plyrControls = document.querySelector('.plyr__controls')

        pressAndHold(listItems(wrapper)[1], 100, 372)
        await flushPromises()
        const menu = document.querySelector('.queue-player__menu')

        expect(menu).toBeTruthy()
        expect(plyrControls.contains(menu)).toBe(false)
        expect(menu.closest('.queue-player__list-item')).toBe(listItems(wrapper)[1].element)
    })
})

describe('QueuePlayer — the menu opens where it was called and stays reachable', () => {
    let wrapper = null

    afterEach(() => {
        if (wrapper) {
            wrapper.unmount()
            wrapper = null
        }
        if (restoreLayout) {
            restoreLayout()
        }
        document.body.innerHTML = ''
    })

    it('opens at the place it was called from, not at the far edge of the row', async () => {
        // A desktop list: the row is 1559 px wide (24..1583) and the track label ends at its left end.
        // Measured with the menu pinned to the row's right edge, the menu landed at 1377 — 1299 px from a
        // right click made at x=78, next to the label.
        installMeasuredLayout({ right: 1583, bottom: 332 + ROW_H * 8 })
        wrapper = await mountQueue()

        pressAndHold(listItems(wrapper)[2], 100, 400)
        await flushPromises()

        const box = menuBox()
        expect(box.left).toBe(100)
        expect(box.top).toBe(400)
        expect(box.right).toBeLessThanOrEqual(1583)
        // The list did not have to move at all.
        expect(listEl().scrollTop).toBe(0)
    })

    it('pulls the menu back when it would hang past the right edge of the list', async () => {
        installMeasuredLayout({ right: 1583, bottom: 332 + ROW_H * 8 })
        wrapper = await mountQueue()

        // A click near the right end of the wide row: 1500 + 206 = 1706, past the 1583 edge.
        pressAndHold(listItems(wrapper)[2], 1500, 400)
        await flushPromises()

        const box = menuBox()
        expect(box.left).toBe(1377)
        expect(box.right).toBe(1583)
    })

    it('grows above the press point when the window ends right below it', async () => {
        // Eight visible rows: the window ends at 548, the last row is 521..548, pressed at 540 → only 8 px
        // below the press point, 208 px above it.
        installMeasuredLayout({ bottom: 548 })
        wrapper = await mountQueue([
            ...Array.from({ length: 8 }, (_, i) => ({ path: `Movies/t${i + 1}.mp4`, name: `t${i + 1}.mp4`, id: i + 1 })),
        ])

        pressAndHold(listItems(wrapper)[7], 100, 540)
        await flushPromises()

        const box = menuBox()
        expect(box.bottom).toBe(540)
        expect(box.top).toBe(540 - MENU_H)
        expect(listEl().scrollTop).toBe(0)
    })

    it('opens below and moves the list by the leftover when the press point has too little room on either side', async () => {
        // Three rows (window 332..413), press at the middle of the middle row: 41 px below the point, 40 px
        // above it, the menu needs 52. Below keeps the menu under the finger, so the list moves by 11 px.
        installMeasuredLayout()
        wrapper = await mountQueue()

        pressAndHold(listItems(wrapper)[1], 100, 372)
        await flushPromises()

        const box = menuBox()
        expect(box.top).toBe(372)
        expect(box.bottom).toBe(424)
        expect(listEl().scrollTop).toBe(11)
    })

    it('does not move the list while the press that opened the menu is still down', async () => {
        // Moving the list now would relocate the row out from under the finger, and the browser would deliver
        // the release of that press to whatever button ended up under it.
        vi.useFakeTimers()
        try {
            installMeasuredLayout()
            wrapper = await mountQueue()
            const row = listItems(wrapper)[1]

            firePointer(row, 'pointerdown', { pointerType: 'touch', clientX: 100, clientY: 372 })
            vi.advanceTimersByTime(500)
            await flushPromises()

            expect(menuEl()).toBeTruthy()
            expect(listEl().scrollTop).toBe(0)

            firePointer(row, 'pointerup', { pointerType: 'touch' })
            await flushPromises()

            expect(listEl().scrollTop).toBe(11)
        } finally {
            vi.useRealTimers()
        }
    })

    it('a menu called by a press that is already over moves the list right away', async () => {
        // A right click is over before the menu exists: nothing holds the row, so the list may move now.
        installMeasuredLayout()
        wrapper = await mountQueue()

        pressAndHold(listItems(wrapper)[1], 100, 372)
        await flushPromises()

        expect(listEl().scrollTop).toBe(11)
    })

    it('the menu of a row is placed by that row, not by another one', async () => {
        installMeasuredLayout()
        wrapper = await mountQueue()

        pressAndHold(listItems(wrapper)[1], 100, 372)
        await flushPromises()
        const first = menuEl()
        expect(first.closest('.queue-player__list-item')).toBe(listItems(wrapper)[1].element)

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await flushPromises()
        expect(menuEl()).toBe(null)

        pressAndHold(listItems(wrapper)[2], 100, 400)
        await flushPromises()

        const second = menuEl()
        expect(second).not.toBe(first)
        expect(second.closest('.queue-player__list-item')).toBe(listItems(wrapper)[2].element)
        // The press point of the last row (400) has only 13 px below it inside 332..413 → the menu grows up.
        expect(menuBox().bottom).toBe(400)
    })
})

describe('QueuePlayer — a track label is not selectable text', () => {
    let wrapper = null

    afterEach(() => {
        if (wrapper) {
            wrapper.unmount()
            wrapper = null
        }
        document.body.innerHTML = ''
    })

    it('the component declares the track rows as not selectable', async () => {
        // Measured on Android: a long press on selectable text starts a text selection and the browser
        // offers its own menu (Copy / Select all / Search the web) on top of everything the app shows.
        wrapper = await mountQueue()
        const item = wrapper.find('.queue-player__item')

        expect(item.classes()).toContain('queue-player__item')
        expect(item.attributes('data-selectable')).toBe('false')
    })
})
