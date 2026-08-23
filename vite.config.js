import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs'

// Move the emitted CSS from js/ into css/ so that Nextcloud's Util::addStyle
// can load it (css/video-main.css) with the CSP nonce.
function moveCssToCssFolder() {
    return {
        name: 'video-move-css',
        closeBundle() {
            const root = fileURLToPath(new URL('.', import.meta.url))
            const src = `${root}js/video-main.css`
            if (existsSync(src)) {
                const destDir = `${root}css`
                mkdirSync(destDir, { recursive: true })
                copyFileSync(src, `${destDir}/video-main.css`)
                rmSync(src)
            }
        },
    }
}

// Copy the Plyr icon sprite into the build so the player can load it from the
// app itself (same-origin) instead of the blocked CDN (Nextcloud CSP).
function copyPlyrSprite() {
    return {
        name: 'video-copy-plyr-sprite',
        closeBundle() {
            const root = fileURLToPath(new URL('.', import.meta.url))
            const src = resolve(root, 'node_modules/plyr/dist/plyr.svg')
            const dest = resolve(root, 'js/plyr.svg')
            if (existsSync(src)) {
                mkdirSync(dirname(dest), { recursive: true })
                copyFileSync(src, dest)
            }
        },
    }
}

// Build target: a Nextcloud app. Output lands in js/ (bundle) and css/ (styles)
// and is loaded via \OCP\Util::addScript/addStyle as /apps/video/js/video-main.js
// and /apps/video/css/video-main.css (Nextcloud injects the CSP nonce).
export default defineConfig({
    plugins: [vue(), moveCssToCssFolder(), copyPlyrSprite()],
    base: '/apps/video/',
    build: {
        outDir: 'js',
        emptyOutDir: true,
        sourcemap: false,
        rollupOptions: {
            input: 'src/main.js',
            output: {
                entryFileNames: 'video-main.js',
                chunkFileNames: 'video-[name].js',
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name && assetInfo.name.endsWith('.css')) {
                        return 'video-main.css'
                    }
                    return 'video-[name][extname]'
                },
            },
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
})
