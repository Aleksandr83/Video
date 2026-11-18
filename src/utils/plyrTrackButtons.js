/**
 * Prev/next buttons inside the Plyr control row.
 *
 * Responsibility (SRP): render two control buttons in an existing controls bar,
 * keep their enabled/disabled state in sync and route clicks to callbacks. It
 * knows nothing about queues, playlists or which track is playing — the owner
 * (VideoPlayer and, above it, QueuePlayer/MainView) decides what "previous" and
 * "next" mean and injects those decisions as callbacks (dependency inversion).
 *
 * Why the buttons are inserted instead of configured: Plyr 3.7.8 has no
 * prev/next controls at all (its `controls` list knows only play, progress,
 * times, mute, volume, settings, pip, fullscreen, ...), so the only way to get
 * them *into the same row as play/pause* is to add them to the bar Plyr built.
 *
 * Visibility (fullscreen only) is a stylesheet decision, not a DOM one: the
 * buttons are always in the row and the stylesheet shows them when the player
 * is fullscreen. The class names below are the single source of that contract.
 * @see src/assets/app.css
 */

/** Shared class of both buttons; the stylesheet uses it to show them in fullscreen. */
export const TRACK_BUTTON_CLASS = 'video-fullscreen__track'
export const TRACK_BUTTON_PREV_CLASS = `${TRACK_BUTTON_CLASS}--prev`
export const TRACK_BUTTON_NEXT_CLASS = `${TRACK_BUTTON_CLASS}--next`

/** Attribute used by tests and CSS to tell the two buttons apart. */
export const TRACK_BUTTON_ATTRIBUTE = 'data-video-track'

// Same icons the queue row uses, drawn inline: the Plyr sprite has no
// prev/next symbols, so referencing it would render empty buttons.
const ICONS = {
    prev: 'M6 6h2v12H6zM20 6l-8.5 6L20 18V6z',
    next: 'M4 6l8.5 6L4 18V6zM16 6h2v12h-2V6z',
}

const KINDS = [
    { kind: 'prev', className: TRACK_BUTTON_PREV_CLASS },
    { kind: 'next', className: TRACK_BUTTON_NEXT_CLASS },
]

function findExistingButton(controls, kind) {
    return controls.querySelector(`[${TRACK_BUTTON_ATTRIBUTE}="${kind}"]`)
}

function createButton({ kind, className, label }) {
    const button = document.createElement('button')
    // Plyr's own hooks keep the sizing and the hover style identical to its buttons.
    button.type = 'button'
    button.className = `plyr__controls__item plyr__control ${TRACK_BUTTON_CLASS} ${className}`
    button.setAttribute(TRACK_BUTTON_ATTRIBUTE, kind)
    button.setAttribute('aria-label', label)
    button.title = label
    button.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${ICONS[kind]}"/></svg>`
    return button
}

/**
 * @param {object} options
 * @param {HTMLElement|null} options.controls controls bar created by Plyr (`player.elements.controls`)
 * @param {HTMLElement|null} options.after element to insert after (the play button); null appends at the end
 * @param {{prev: string, next: string}} options.labels accessible names
 * @param {{prev?: boolean, next?: boolean}} [options.availability] initial enabled state (both enabled if omitted)
 * @param {Function} [options.onPrev]
 * @param {Function} [options.onNext]
 * @returns {{setAvailability: (state: {prev: boolean, next: boolean}) => void, destroy: () => void}}
 */
export function mountTrackButtons({ controls, after, labels = {}, availability = {}, onPrev = () => {}, onNext = () => {} }) {
    if (!controls || typeof controls.appendChild !== 'function') {
        // No controls bar (Plyr started without one) — every method stays a no-op.
        return { setAvailability: () => {}, destroy: () => {} }
    }

    const enabled = { prev: availability.prev !== false, next: availability.next !== false }
    const buttons = {}

    let previous = after && after.parentNode === controls ? after : null
    for (const { kind, className } of KINDS) {
        // Mounting twice must not duplicate the buttons or their listeners.
        let button = findExistingButton(controls, kind)
        if (!button) {
            button = createButton({ kind, className, label: labels[kind] || '' })
            if (previous) {
                previous.after(button)
            } else {
                controls.appendChild(button)
            }
            button.addEventListener('click', () => {
                // `disabled` alone does not stop a dispatched click event, so the
                // state is checked here as well.
                if (!enabled[kind]) {
                    return
                }
                if (kind === 'prev') {
                    onPrev()
                } else {
                    onNext()
                }
            })
        }
        buttons[kind] = button
        previous = button
    }

    function applyAvailability() {
        for (const { kind } of KINDS) {
            const button = buttons[kind]
            button.disabled = !enabled[kind]
            button.setAttribute('aria-disabled', enabled[kind] ? 'false' : 'true')
        }
    }

    function setAvailability(state = {}) {
        if ('prev' in state) {
            enabled.prev = state.prev !== false
        }
        if ('next' in state) {
            enabled.next = state.next !== false
        }
        applyAvailability()
    }

    function destroy() {
        for (const { kind } of KINDS) {
            buttons[kind].remove()
        }
    }

    applyAvailability()

    return { setAvailability, destroy }
}
