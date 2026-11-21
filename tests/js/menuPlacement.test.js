import { describe, it, expect } from 'vitest'
import {
    clampMenuLeft,
    menuNeedsRoomOnSide,
    overflowToShowMenu,
    planMenuPlacement,
    planPointerMenuPlacement,
} from '../../src/utils/menuPlacement'

/**
 * Two menus in this app are anchored to the thing the user pressed: the track menu of the queue under the
 * video (anchored to a track row) and the "add to playlist" menu of a video card (anchored to the card's
 * button). Both were measured in Chromium to open BELOW the anchor, and both end up partly unreachable when
 * the anchor is close to the bottom of the area that can show them:
 *   - the queue list is its own scroll window (`max-height` + `overflow-y: auto`): the menu of the last row
 *     hung 48 px below that window, and a press where its buttons visually were landed on the page;
 *   - the card menu, 216 px tall with five playlists, hung 177 px below the bottom edge of the screen, and
 *     every one of its buttons was off screen.
 * These two helpers hold the decision (which side has room) and the amount the reachable area has to move,
 * so both menus make the same choice from the same numbers. The fixtures below are those measurements.
 */

// Queue list, three rows (measured): window 332..413, a row 27 px, the menu 52 px, overlapping the row by 4 px.
const QUEUE = { windowTop: 332, windowBottom: 413, anchorHeight: 27, menuHeight: 52, overlap: 4 }
// A video card near the bottom of a 411x620 screen (measured): button 560..581, the menu 216 px, no overlap.
const CARD = { windowTop: 0, windowBottom: 620, anchorTop: 560, anchorBottom: 581, menuHeight: 216, overlap: 0 }

const queueRow = (index) => ({
    anchorTop: QUEUE.windowTop + index * QUEUE.anchorHeight,
    anchorBottom: QUEUE.windowTop + (index + 1) * QUEUE.anchorHeight,
})

describe('planMenuPlacement — which side of the anchor the menu fits on', () => {
    it('below when the reachable area has room below the anchor', () => {
        // Eight rows visible: window 332..548, the first row ends at 359 → 189 px of room below.
        const plan = planMenuPlacement({
            ...queueRow(0),
            windowTop: QUEUE.windowTop, windowBottom: QUEUE.windowTop + QUEUE.anchorHeight * 8,
            menuHeight: QUEUE.menuHeight, overlap: QUEUE.overlap,
        })
        expect(plan.side).toBe('below')
    })

    it('above when the anchor is the last one in the window (the measured case: 48 px hung below)', () => {
        const plan = planMenuPlacement({
            ...queueRow(2),
            windowTop: QUEUE.windowTop, windowBottom: QUEUE.windowBottom,
            menuHeight: QUEUE.menuHeight, overlap: QUEUE.overlap,
        })
        expect(plan.side).toBe('above')
    })

    it('above for the card menu that measured 177 px below the bottom edge of the screen', () => {
        const plan = planMenuPlacement({ ...CARD })
        expect(plan.side).toBe('above')
    })

    it('the overlap with the anchor counts as room on the side the menu is anchored to', () => {
        const needed = QUEUE.menuHeight - QUEUE.overlap
        const justFits = planMenuPlacement({
            ...queueRow(0),
            windowTop: QUEUE.windowTop, windowBottom: queueRow(0).anchorBottom + needed,
            menuHeight: QUEUE.menuHeight, overlap: QUEUE.overlap,
        })
        expect(justFits.side).toBe('below')

        const shortByOneAndNothingAbove = planMenuPlacement({
            ...queueRow(0),
            windowTop: QUEUE.windowTop, windowBottom: queueRow(0).anchorBottom + needed - 1,
            menuHeight: QUEUE.menuHeight, overlap: QUEUE.overlap,
        })
        // 47 px below and nothing above: flipping would cut 48 px to save 1, so the menu stays where it was.
        expect(shortByOneAndNothingAbove.side).toBe('below')

        const shortByOneWithRoomAbove = planMenuPlacement({
            ...queueRow(0),
            windowTop: QUEUE.windowTop - needed, windowBottom: queueRow(0).anchorBottom + needed - 1,
            menuHeight: QUEUE.menuHeight, overlap: QUEUE.overlap,
        })
        expect(shortByOneWithRoomAbove.side).toBe('above')
    })

    it('the roomier side when there is not enough room on either side', () => {
        // A two-row window (332..386) and its second row: 27 px above it, nothing below.
        const plan = planMenuPlacement({
            ...queueRow(1),
            windowTop: QUEUE.windowTop, windowBottom: QUEUE.windowTop + QUEUE.anchorHeight * 2,
            menuHeight: QUEUE.menuHeight, overlap: QUEUE.overlap,
        })
        expect(plan.side).toBe('above')
    })

    it('below when both sides are equally short, so the menu keeps appearing under the finger', () => {
        // Three-row window, middle row: 27 px above and 27 px below.
        const plan = planMenuPlacement({
            ...queueRow(1),
            windowTop: QUEUE.windowTop, windowBottom: QUEUE.windowBottom,
            menuHeight: QUEUE.menuHeight, overlap: QUEUE.overlap,
        })
        expect(plan.side).toBe('below')
    })

    it('an anchor with the whole window below it is never flipped', () => {
        const plan = planMenuPlacement({
            anchorTop: 0, anchorBottom: 100, windowTop: 0, windowBottom: 1000,
            menuHeight: 216, overlap: 0,
        })
        expect(plan.side).toBe('below')
    })

    it('reports the room on both sides, so the caller can see why the side was chosen', () => {
        const plan = planMenuPlacement({
            ...queueRow(2),
            windowTop: QUEUE.windowTop, windowBottom: QUEUE.windowBottom,
            menuHeight: QUEUE.menuHeight, overlap: QUEUE.overlap,
        })
        expect(plan.spaceBelow).toBe(0)
        expect(plan.spaceAbove).toBe(QUEUE.anchorHeight * 2)
    })
})

describe('menuNeedsRoomOnSide — how much room a menu actually asks for', () => {
    it('its height minus the overlap it is allowed to take from the anchor', () => {
        expect(menuNeedsRoomOnSide(QUEUE.menuHeight, QUEUE.overlap)).toBe(48)
    })

    it('its full height when the CSS does not let it overlap the anchor', () => {
        expect(menuNeedsRoomOnSide(CARD.menuHeight, 0)).toBe(216)
    })

    it('never a negative amount', () => {
        expect(menuNeedsRoomOnSide(10, 24)).toBe(0)
    })
})

describe('overflowToShowMenu — how far the reachable area has to move', () => {
    it('nothing when the menu is already inside the area', () => {
        expect(overflowToShowMenu({ windowTop: 332, windowBottom: 413, menuTop: 338, menuBottom: 390, side: 'below' })).toBe(0)
    })

    it('how much hangs below the area, as a positive move, for a menu anchored below', () => {
        // The measured cut of the last row of a three-row window: menu 409..461, window bottom 413.
        expect(overflowToShowMenu({ windowTop: 332, windowBottom: 413, menuTop: 409, menuBottom: 461, side: 'below' })).toBe(48)
        // The measured cut of the card menu: 581..797 against the bottom edge 620.
        expect(overflowToShowMenu({ windowTop: 0, windowBottom: 620, menuTop: 581, menuBottom: 797, side: 'below' })).toBe(177)
    })

    it('how much hangs above the area, as a negative move, for a menu anchored above', () => {
        expect(overflowToShowMenu({ windowTop: 332, windowBottom: 386, menuTop: 311, menuBottom: 363, side: 'above' })).toBe(-21)
    })

    it('a menu exactly on the edge of the area is already reachable', () => {
        expect(overflowToShowMenu({ windowTop: 332, windowBottom: 413, menuTop: 361, menuBottom: 413, side: 'below' })).toBe(0)
        expect(overflowToShowMenu({ windowTop: 332, windowBottom: 413, menuTop: 332, menuBottom: 384, side: 'above' })).toBe(0)
    })

    it('a menu anchored above is not pushed by the part that hangs below its own edge', () => {
        // A menu taller than the area can never fit: only the edge it is anchored to is corrected, so the
        // correction does not chase itself when the placement is checked again.
        expect(overflowToShowMenu({ windowTop: 0, windowBottom: 200, menuTop: 0, menuBottom: 216, side: 'above' })).toBe(0)
    })

    it('a menu anchored below is not pushed by the part that hangs above its own edge', () => {
        expect(overflowToShowMenu({ windowTop: 0, windowBottom: 200, menuTop: -16, menuBottom: 200, side: 'below' })).toBe(0)
    })

    it('rounds a fraction of a pixel to a whole one', () => {
        expect(overflowToShowMenu({ windowTop: 0, windowBottom: 620, menuTop: 600, menuBottom: 620.4, side: 'below' })).toBe(1)
        expect(overflowToShowMenu({ windowTop: 0, windowBottom: 620, menuTop: -0.4, menuBottom: 215.6, side: 'above' })).toBe(-1)
    })
})


describe('planPointerMenuPlacement — which side of the press point the menu grows to', () => {
    // The menu is anchored to the place it was called from (measured defect on a desktop-width list: with the
    // row 1559 px wide and the menu pinned to its right edge, a right click next to the label opened the menu
    // 1299 px away from the cursor). The press point has no height, so the room is counted from that point.
    const DESKTOP = { windowTop: 332, windowBottom: 548, menuHeight: 52 }

    it('below the press point when there is room below it', () => {
        const plan = planPointerMenuPlacement({ ...DESKTOP, pressTop: 400, spaceRequiredBelow: 200 })
        expect(plan.side).toBe('below')
        expect(plan.spaceBelow).toBe(148)
        expect(plan.spaceAbove).toBe(68)
    })

    it('above the press point when the window ends too close below it', () => {
        // Press at 540 in a window ending at 548: 8 px below, 208 px above.
        const plan = planPointerMenuPlacement({ ...DESKTOP, pressTop: 540, spaceRequiredBelow: 8 })
        expect(plan.side).toBe('above')
    })

    it('below when the press point is in the middle of a window too short for either side', () => {
        // A 27 px window (332..359) and a press at its middle: 13 px on each side.
        const plan = planPointerMenuPlacement({ windowTop: 332, windowBottom: 359, pressTop: 345, menuHeight: 52 })
        expect(plan.side).toBe('below')
    })

    it('the gap between the two sides decides, not the size of the menu', () => {
        const plan = planPointerMenuPlacement({ windowTop: 332, windowBottom: 548, pressTop: 520, menuHeight: 200 })
        expect(plan.spaceBelow).toBe(28)
        expect(plan.spaceAbove).toBe(188)
        expect(plan.side).toBe('above')
    })

    it('a press at the very bottom edge of the window still gets a reachable menu', () => {
        const plan = planPointerMenuPlacement({ windowTop: 332, windowBottom: 548, pressTop: 548, menuHeight: 52 })
        expect(plan.side).toBe('above')
    })
})

describe('clampMenuLeft — how far the menu may open to the right of the press point', () => {
    // Measured on a desktop list: row 24..1583, menu 206 px wide.
    const ROW = { rowLeft: 24, rowRight: 1583, menuWidth: 206 }

    it('does not move the menu when it fits to the right of the press point', () => {
        // Click next to the label at x=100 → the menu may open right there.
        expect(clampMenuLeft({ ...ROW, pressLeft: 100 })).toBe(100)
    })

    it('pulls the menu back when it would hang past the right edge of the window', () => {
        // Click at x=1500: 1500 + 206 = 1706 > 1583 → the menu is pulled to 1377.
        expect(clampMenuLeft({ ...ROW, pressLeft: 1500 })).toBe(1377)
    })

    it('never pushes the menu past the left edge of the window', () => {
        expect(clampMenuLeft({ ...ROW, pressLeft: 5 })).toBe(24)
    })

    it('a menu wider than the window starts at its left edge', () => {
        expect(clampMenuLeft({ rowLeft: 24, rowRight: 200, menuWidth: 400, pressLeft: 150 })).toBe(24)
    })
})
