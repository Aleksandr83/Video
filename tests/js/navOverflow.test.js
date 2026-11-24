import { describe, it, expect } from 'vitest'
import { NAV_COLUMN_GAP, planNavOverflow, measureNav } from '../../src/utils/navOverflow.js'

/**
 * The header row keeps the sections that fit and hands the rest to a menu button. The decision is made from
 * measured widths, never from a fixed screen-width threshold: the same four sections take a different amount
 * of space in Russian and in English, and the app cannot know the widths of the labels in advance.
 */

const item = (name, width, collapsible = false) => ({ name, width, collapsible })

describe('planNavOverflow', () => {
    it('keeps every section in the row when all of them fit', () => {
        const plan = planNavOverflow({
            available: 400,
            items: [item('videos', 42), item('playlists', 77), item('settings', 74), item('about', 84, true)],
        })

        expect(plan.inline).toEqual(['videos', 'playlists', 'settings', 'about'])
        expect(plan.collapsed).toEqual([])
        expect(plan.toggleShown).toBe(false)
        expect(plan.fits).toBe(true)
    })

    it('collapses a section that does not fit and shows the menu button instead', () => {
        // 100 + gap + 100 = 212 used; the third section would need 212 + gap + 100 = 324 of 300.
        const plan = planNavOverflow({
            available: 300,
            gap: 12,
            items: [item('videos', 100), item('playlists', 100), item('about', 100, true)],
            toggleWidth: 34,
        })

        expect(plan.inline).toEqual(['videos', 'playlists'])
        expect(plan.collapsed).toEqual(['about'])
        expect(plan.toggleShown).toBe(true)
        expect(plan.fits).toBe(true)
    })

    it('collapses the sections behind a collapsed one instead of squeezing them into the row', () => {
        const plan = planNavOverflow({
            available: 200,
            gap: 12,
            items: [item('videos', 100), item('about', 100, true), item('settings', 100, true)],
            toggleWidth: 34,
        })

        expect(plan.inline).toEqual(['videos'])
        expect(plan.collapsed).toEqual(['about', 'settings'])
        expect(plan.toggleShown).toBe(true)
        expect(plan.fits).toBe(true)
    })

    it('reports that the menu button itself does not fit once sections were collapsed', () => {
        // The row is full: 100 + gap + 100 = 212 of 220 available, and the button needs 212 + gap + 60.
        const plan = planNavOverflow({
            available: 220,
            gap: 12,
            items: [item('videos', 100), item('playlists', 100), item('about', 100, true)],
            toggleWidth: 60,
        })

        expect(plan.collapsed).toEqual(['about'])
        expect(plan.toggleShown).toBe(true)
        expect(plan.fits).toBe(false)
    })

    it('leaves a section that is not collapsible in the row and says the row overflows', () => {
        const plan = planNavOverflow({
            available: 100,
            gap: 12,
            items: [item('videos', 60), item('playlists', 60), item('about', 40, true)],
            toggleWidth: 34,
        })

        expect(plan.inline).toEqual(['videos', 'playlists'])
        expect(plan.collapsed).toEqual(['about'])
        expect(plan.fits).toBe(false)
    })

    it('keeps everything in the row when the browser cannot measure anything (jsdom, hidden app)', () => {
        // Zero widths are what a browser without layout reports; hiding a section on that reading would be
        // worse than showing it, so the plan is "nothing is collapsed".
        const plan = planNavOverflow({ available: 0, gap: 12, items: [item('videos', 0), item('about', 0, true)], toggleWidth: 0 })

        expect(plan.collapsed).toEqual([])
        expect(plan.toggleShown).toBe(false)
        expect(plan.fits).toBe(true)
    })

    it('reserves the gap between the last kept section and the menu button', () => {
        // Exactly enough room for the button, and one pixel less: the button sits right after the row.
        const gap = NAV_COLUMN_GAP
        const fits = planNavOverflow({
            available: 100 + gap + 34,
            items: [item('videos', 100), item('about', 100, true)],
            toggleWidth: 34,
        })
        const crowded = planNavOverflow({
            available: 100 + gap + 34 - 1,
            items: [item('videos', 100), item('about', 100, true)],
            toggleWidth: 34,
        })

        expect(fits.collapsed).toEqual(['about'])
        expect(fits.fits).toBe(true)
        expect(crowded.collapsed).toEqual(['about'])
        expect(crowded.fits).toBe(false)
    })
})

describe('measureNav', () => {
    it('reads the row width and the width of each section out of the rendered elements', () => {
        const measured = measureNav({
            nav: { clientWidth: 360 },
            fixedLinks: [{ name: 'videos', element: { offsetWidth: 42 } }, { name: 'playlists', element: { offsetWidth: 77 } }],
            collapsibleLinks: [{ name: 'about', element: { offsetWidth: 84 } }],
            toggle: { offsetWidth: 34 },
        })

        expect(measured.available).toBe(360)
        expect(measured.toggleWidth).toBe(34)
        expect(measured.items).toEqual([
            { name: 'videos', width: 42, collapsible: false },
            { name: 'playlists', width: 77, collapsible: false },
            { name: 'about', width: 84, collapsible: true },
        ])
    })

    it('treats a missing menu button copy as zero width so the plan still runs', () => {
        const measured = measureNav({
            nav: { clientWidth: 300 },
            fixedLinks: [{ name: 'videos', element: { offsetWidth: 42 } }],
            collapsibleLinks: [{ name: 'about', element: { offsetWidth: 84 } }],
            toggle: null,
        })

        expect(measured.toggleWidth).toBe(0)
        expect(planNavOverflow({ ...measured }).collapsed).toEqual([])
    })

    it('reports an unmeasurable row as no room at all', () => {
        const measured = measureNav({
            nav: null,
            fixedLinks: [{ name: 'videos', element: { offsetWidth: 42 } }],
            collapsibleLinks: [{ name: 'about', element: { offsetWidth: 84 } }],
            toggle: { offsetWidth: 34 },
        })

        expect(measured.available).toBe(0)
        expect(measured.items.map((i) => i.name)).toEqual(['videos', 'about'])
    })
})
