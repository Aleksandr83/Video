<template>
    <div class="video-app">
        <header ref="headerEl" class="video-app__header">
            <h1 class="video-app__title">{{ title }}</h1>
            <nav ref="navEl" class="video-app__nav">
                <RouterLink class="video-app__link" data-nav-name="videos" data-nav-fixed="true" to="/">{{ t('videosNav') }}</RouterLink>
                <RouterLink class="video-app__link" data-nav-name="playlists" data-nav-fixed="true" to="/playlists">{{ t('playlistsNav') }}</RouterLink>
                <RouterLink v-if="isAdmin" class="video-app__link" data-nav-name="settings" data-nav-fixed="true" to="/settings">{{ t('settingsNav') }}</RouterLink>
                <RouterLink v-if="!collapsed.includes('about')" class="video-app__link" data-nav-name="about" to="/about">{{ t('aboutNav') }}</RouterLink>
                <button v-if="collapsed.length"
                        ref="toggleEl"
                        class="video-app__more"
                        :class="{ 'video-app__more--open': menuOpen }"
                        type="button"
                        :aria-label="t('navMoreLabel')"
                        :title="t('navMoreLabel')"
                        aria-haspopup="true"
                        :aria-expanded="menuOpen ? 'true' : 'false'"
                        @click="toggleMenu">
                    <svg class="video-app__more-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                        <path d="M3.5 6h9L8 12.5z" />
                    </svg>
                </button>
            </nav>
            <ul v-if="menuOpen"
                ref="menuEl"
                class="video-app__menu"
                role="menu"
                :style="menuStyle"
                @click.stop>
                <li v-for="entry in menuEntries" :key="entry.name" class="video-app__menu-entry">
                    <RouterLink class="video-app__menu-link" role="menuitem" :to="entry.to" @click="closeMenu">{{ entry.label }}</RouterLink>
                </li>
            </ul>
            <span ref="measureEl" class="video-app__measure" aria-hidden="true">
                <span class="video-app__link video-app__measure-item" data-measure="about">{{ t('aboutNav') }}</span>
                <span class="video-app__more video-app__measure-item" data-measure="toggle">
                    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                        <path d="M3.5 6h9L8 12.5z" />
                    </svg>
                </span>
            </span>
        </header>
        <main class="video-app__content">
            <RouterView />
        </main>
    </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { t } from './i18n'
import { clampMenuLeft, overflowToShowMenu, planPointerMenuPlacement } from './utils/menuPlacement'
import { measureNav, planNavOverflow } from './utils/navOverflow'

const title = 'Video'
const isAdmin = ref(typeof OC !== 'undefined' && typeof OC.isUserAdmin === 'function' ? OC.isUserAdmin() : false)

// The section that may move into the menu. The others have to stay reachable from the row itself.
const COLLAPSIBLE = [{ name: 'about', to: '/about', label: () => t('aboutNav') }]

const headerEl = ref(null)
const navEl = ref(null)
const toggleEl = ref(null)
const menuEl = ref(null)
const measureEl = ref(null)

const collapsed = ref([])
const menuOpen = ref(false)
const menuAbove = ref(false)
const menuStyle = ref({})

let observer = null

const menuEntries = computed(() => COLLAPSIBLE
    .filter((entry) => collapsed.value.includes(entry.name))
    .map((entry) => ({ name: entry.name, to: entry.to, label: entry.label() })))

function remeasure() {
    const nav = navEl.value
    if (!nav) {
        return
    }

    const fixed = [...nav.querySelectorAll('[data-nav-fixed]')].map((element) => ({
        name: element.dataset.navName,
        element,
    }))
    const collapsible = COLLAPSIBLE.map((entry) => ({
        name: entry.name,
        element: measureEl.value ? measureEl.value.querySelector(`[data-measure="${entry.name}"]`) : null,
    }))
    const toggle = measureEl.value ? measureEl.value.querySelector('[data-measure="toggle"]') : null

    const plan = planNavOverflow(measureNav({ nav, fixedLinks: fixed, collapsibleLinks: collapsible, toggle }))

    collapsed.value = plan.collapsed
    if (!plan.toggleShown) {
        closeMenu()
    }
}

function closeMenu() {
    menuOpen.value = false
    menuStyle.value = {}
}

async function positionMenu() {
    const header = headerEl.value
    const toggle = toggleEl.value
    const menu = menuEl.value
    if (!header || !toggle || !menu) {
        return
    }

    const headerBox = header.getBoundingClientRect()
    const toggleBox = toggle.getBoundingClientRect()
    const menuBox = menu.getBoundingClientRect()
    const windowBottom = typeof window !== 'undefined' ? window.innerHeight : headerBox.bottom

    const plan = planPointerMenuPlacement({
        pressTop: toggleBox.bottom,
        windowTop: headerBox.bottom,
        windowBottom,
        menuHeight: menuBox.height,
    })
    const left = clampMenuLeft({
        rowLeft: headerBox.left,
        rowRight: headerBox.right,
        menuWidth: menuBox.width,
        pressLeft: toggleBox.left,
    })

    menuAbove.value = plan.side === 'above'
    menuStyle.value = menuAbove.value
        ? { left: `${Math.round(left - headerBox.left)}px`, bottom: `${Math.round(headerBox.bottom - toggleBox.bottom)}px` }
        : { left: `${Math.round(left - headerBox.left)}px`, top: `${Math.round(toggleBox.bottom - headerBox.top) + 4}px` }

    await nextTick()

    const placed = menuEl.value
    if (!placed) {
        return
    }

    const box = placed.getBoundingClientRect()
    const shift = overflowToShowMenu({
        windowTop: 0,
        windowBottom,
        menuTop: box.top,
        menuBottom: box.bottom,
        side: menuAbove.value ? 'above' : 'below',
    })
    if (shift && !menuAbove.value) {
        // A menu hanging below a header near the bottom of the screen is pulled up instead of being cut off.
        menuStyle.value = { ...menuStyle.value, top: `${Math.round(box.top - headerBox.top - shift)}px` }
    }
}

async function toggleMenu() {
    if (menuOpen.value) {
        closeMenu()
        return
    }

    menuOpen.value = true
    await nextTick()
    await positionMenu()
}

// Clicks that land on the button or inside the menu are handled by the controls themselves; everything else
// on the page closes the menu.
function onDocumentClick(event) {
    if (!menuOpen.value) {
        return
    }

    const target = event.target
    if (target instanceof Element && target.closest('.video-app__more, .video-app__menu')) {
        return
    }

    closeMenu()
}

function onDocumentKeydown(event) {
    if (event.key === 'Escape' && menuOpen.value) {
        closeMenu()
    }
}

onMounted(async () => {
    await nextTick()
    remeasure()

    if (typeof ResizeObserver !== 'undefined' && navEl.value) {
        observer = new ResizeObserver(() => remeasure())
        observer.observe(navEl.value)
    }

    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
    if (observer) {
        observer.disconnect()
        observer = null
    }

    document.removeEventListener('click', onDocumentClick)
    document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<style scoped>
.video-app {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-main-background);
    color: var(--color-main-text);
    box-sizing: border-box;
}

.video-app__header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 16px 8px;
    flex-shrink: 0;
}

.video-app__content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0 16px 16px;
}

.video-app__title {
    margin: 0;
    font-size: 20px;
}

/* The row takes the space that is left after the title instead of the space its own content asks for: that
   way its own width is the room available to the sections, and nothing can spill out of the app column. */
.video-app__nav {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    /* Must match NAV_COLUMN_GAP: the plan adds up these gaps to decide what stays in the row. */
    gap: 10px;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
}

.video-app__link {
    color: var(--color-main-text);
    text-decoration: none;
    white-space: nowrap;
}

.video-app__more {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    color: var(--color-main-text);
    cursor: pointer;
}

.video-app__more:hover,
.video-app__more--open {
    background: var(--color-background-hover);
    border-color: var(--color-border);
}

.video-app__menu {
    position: absolute;
    z-index: 3;
    top: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--color-main-background);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
}

.video-app__menu-link {
    display: block;
    padding: 6px 10px;
    border-radius: 4px;
    color: var(--color-main-text);
    text-decoration: none;
    white-space: nowrap;
}

.video-app__menu-link:hover {
    background: var(--color-background-hover);
}

/* Copies used only to measure: they carry the styles of the real controls so their widths are the widths of
   the row, but they hold no link and no button a keyboard or a screen reader could reach. */
.video-app__measure {
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    pointer-events: none;
}

.video-app__measure-item {
    display: inline-block;
}
</style>
