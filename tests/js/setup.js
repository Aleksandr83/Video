/**
 * Vitest setup: the Nextcloud globals that \OCP\Util injects at runtime.
 * Tests run in jsdom, where those globals do not exist.
 */

// Translation helpers used by src/i18n.js.
globalThis.t = (key) => key
globalThis.n = (key) => key

// Nextcloud client API surface used by the app (only what the code touches).
globalThis.OC = {
    apps: { webroot: '/apps' },
    webroot: '',
    getCurrentUser: () => ({ uid: 'testuser', displayName: 'Test User' }),
    getLanguage: () => 'ru',
    isUserAdmin: () => false,
    dialogs: {
        FILEPICKER_TYPE_FOLDER: 1,
        filepicker: () => {},
    },
}

// Namespace the app entry point is registered under.
globalThis.OCA = {}

// Plyr runs `window.matchMedia(...)` while its module loads; jsdom does not
// provide matchMedia at all, so importing Plyr would throw.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    window.matchMedia = () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
    })
}
