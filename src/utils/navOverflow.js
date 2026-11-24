/**
 * Decides which entries of the header row stay visible and which move into the menu button.
 *
 * The decision is made from measured widths, not from a screen-width threshold: the same section costs a
 * different amount of space in Russian and in English, and a threshold would have to guess that. Entries are
 * taken in their given order until one of them no longer fits; from that point on everything goes into the
 * menu, because putting a later entry back into the row would break the order of the sections.
 *
 * Only entries marked as collapsible can be moved. An entry that is not collapsible and does not fit is left
 * in the row and reported through `fits`, so the layout problem stays visible instead of hiding a section.
 */

// Must match the gap of the nav row in the header styles of App.vue.
export const NAV_COLUMN_GAP = 10

/**
 * @param {{ available: number, gap?: number, items?: Array<{ name: string, width: number, collapsible?: boolean }>, toggleWidth?: number }} plan
 * @returns {{ inline: string[], collapsed: string[], toggleShown: boolean, fits: boolean }}
 */
export function planNavOverflow({ available, gap = NAV_COLUMN_GAP, items = [], toggleWidth = 0 }) {
    const inline = items.map((item) => item.name)
    if (!(available > 0)) {
        // A row that reports no width carries no information: hiding a section on that reading would be worse
        // than showing it, so nothing is collapsed.
        return { inline, collapsed: [], toggleShown: false, fits: true }
    }

    const kept = []
    const moved = []
    let used = 0
    let overflowed = false
    let fits = true

    for (const item of items) {
        const needed = used + (kept.length ? gap : 0) + item.width

        if (!overflowed && needed <= available) {
            kept.push(item.name)
            used = needed
            continue
        }

        overflowed = true
        if (item.collapsible) {
            moved.push(item.name)
            continue
        }

        // The section has to stay where it is, even though it does not fit.
        kept.push(item.name)
        used = needed
        fits = false
    }

    const toggleShown = moved.length > 0
    if (toggleShown && used + gap + toggleWidth > available) {
        fits = false
    }

    return { inline: kept, collapsed: moved, toggleShown, fits }
}

/**
 * Reads the widths the plan needs out of the rendered header.
 *
 * `fixedLinks` are the entries that always stay in the row, `collapsibleLinks` are measured copies of the
 * labels that may move into the menu, and `toggle` is the menu button (or its measuring copy) that replaces
 * them. Plain numbers are read, so the caller decides which elements to hand over.
 *
 * @param {{ nav: { clientWidth: number } | null, fixedLinks?: Array<{ name: string, element: { offsetWidth: number } | null }>, collapsibleLinks?: Array<{ name: string, element: { offsetWidth: number } | null }>, toggle?: { offsetWidth: number } | null }} source
 * @returns {{ available: number, items: Array<{ name: string, width: number, collapsible: boolean }>, toggleWidth: number }}
 */
export function measureNav({ nav, fixedLinks = [], collapsibleLinks = [], toggle = null }) {
    const width = (element) => (element && typeof element.offsetWidth === 'number' ? element.offsetWidth : 0)

    return {
        available: nav && typeof nav.clientWidth === 'number' ? nav.clientWidth : 0,
        items: [
            ...fixedLinks.map((entry) => ({ name: entry.name, width: width(entry.element), collapsible: false })),
            ...collapsibleLinks.map((entry) => ({ name: entry.name, width: width(entry.element), collapsible: true })),
        ],
        toggleWidth: width(toggle),
    }
}
