/**
 * Placement of a menu that is anchored to the element the user pressed.
 *
 * Both menus of this app hang off an anchor: the menu of a track of the queue under the video is anchored to
 * that track's row, and the "add to playlist" menu of a video card is anchored to the card's button. Anchored
 * below, each of them ran out of the area that can show it (measured in Chromium):
 *   - the queue list is a scroll window of its own (`max-height` + `overflow-y: auto`), and the menu of its
 *     last row hung 48 px below that window: a press where the buttons visually were landed on the page;
 *   - the card menu, 216 px tall, hung 177 px below the bottom edge of a 411x620 screen, and every one of its
 *     buttons was off screen.
 *
 * So the side is chosen by the room the area actually has, and the area is moved by the leftover. The
 * functions here hold no DOM knowledge: a caller measures its own anchor, its own area (a scroll box, or the
 * screen) and the drawn height of its menu, and applies the answer.
 */

/**
 * How far the menu of a track row is allowed to overlap the edge of the row it belongs to. It matches the CSS
 * `calc(100% - 4px)` of `.queue-player__menu`, so the measured and the laid-out geometry agree.
 */
export const MENU_EDGE_OVERLAP = 4

/**
 * Room a menu asks for on the side it is anchored to. The overlap is taken from the anchor, not from the area,
 * so it does not count against that room.
 */
export function menuNeedsRoomOnSide(menuHeight, overlap) {
    return Math.max(0, menuHeight - overlap)
}

/**
 * Which side of the anchor the menu is put on.
 *
 * Below is preferred, because that is where the menu is expected after a press; above only when below has no
 * room for it. When the area is shorter than the menu on both sides, the roomier side wins, and ties stay
 * below so the menu does not jump around between rows of the same height.
 */
export function planMenuPlacement({ anchorTop, anchorBottom, windowTop, windowBottom, menuHeight, overlap }) {
    const spaceBelow = windowBottom - anchorBottom
    const spaceAbove = anchorTop - windowTop
    const needed = menuNeedsRoomOnSide(menuHeight, overlap)

    if (spaceBelow >= needed) {
        return { side: 'below', spaceBelow, spaceAbove }
    }
    if (spaceAbove >= needed) {
        return { side: 'above', spaceBelow, spaceAbove }
    }
    return { side: spaceBelow >= spaceAbove ? 'below' : 'above', spaceBelow, spaceAbove }
}

/**
 * How far the area has to move so the side the menu is anchored to becomes reachable: positive moves the
 * content up, negative moves it down. Only the anchored edge is corrected — a menu taller than the area can
 * never fit inside it, and correcting both edges would make the correction chase itself every time the
 * placement is checked again.
 */
export function overflowToShowMenu({ windowTop, windowBottom, menuTop, menuBottom, side }) {
    if (side === 'above') {
        return menuTop < windowTop ? -Math.ceil(windowTop - menuTop) : 0
    }
    return menuBottom > windowBottom ? Math.ceil(menuBottom - windowBottom) : 0
}

/**
 * Which side of the place the menu was called from it grows to.
 *
 * The menu of a track row is anchored to the point the user pressed (measured on a desktop-width list: with
 * the row 1559 px wide and the menu pinned to the row's right edge, a right click next to the track label
 * opened the menu 1299 px away from the cursor). A press point has no height, so the room is counted from the
 * point itself: `menuHeight` is asked for whole, without an overlap credit.
 */
export function planPointerMenuPlacement({ pressTop, windowTop, windowBottom, menuHeight }) {
    const spaceBelow = windowBottom - pressTop
    const spaceAbove = pressTop - windowTop

    if (spaceBelow >= menuHeight) {
        return { side: 'below', spaceBelow, spaceAbove }
    }
    if (spaceAbove >= menuHeight) {
        return { side: 'above', spaceBelow, spaceAbove }
    }
    return { side: spaceBelow >= spaceAbove ? 'below' : 'above', spaceBelow, spaceAbove }
}

/**
 * How far the menu may open to the right of the press point without leaving the area horizontally. A menu
 * wider than the area starts at its left edge.
 */
export function clampMenuLeft({ rowLeft, rowRight, menuWidth, pressLeft }) {
    const widest = rowRight - menuWidth
    if (widest < rowLeft) {
        return rowLeft
    }
    return Math.min(Math.max(pressLeft, rowLeft), widest)
}
