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

// Rollup still leaves a couple of helpers ABOVE the IIFE wrapper when output.format is 'iife' — measured
// 2026-11-21: `var _w=Object.defineProperty;var ww=…;var Ht=…` (Vue interop helpers) sat outside the wrapper
// and would still land in the page's global scope, which is the very thing noGlobalLeaks() is for. They are
// prepended after renderChunk hooks run, so the wrap happens in generateBundle, where chunk.code is already
// the final file: the entry chunk is wrapped once more and every declaration becomes local to one function.
// Safe here because the bundle has no exports, no top-level await and no `import.meta` (grep over src/: none).
// noGlobalLeaks() runs right after this one and verifies the wrapped file, so a leak fails the build.
function wrapEntryChunkAsFunction() {
    return {
        name: 'video-wrap-entry-chunk',
        generateBundle(_options, bundle) {
            for (const [fileName, chunk] of Object.entries(bundle)) {
                if (chunk.type !== 'chunk' || !chunk.isEntry || !fileName.endsWith('.js')) {
                    continue
                }
                chunk.code = `(function(){\n${chunk.code}\n})();`
            }
        },
    }
}

// Guard against the class of bug that took the whole app down on 2026-11-21: a bundle loaded as a classic
// script may not declare names that the page already owns. Nextcloud keeps a global `_` (a function), and a
// bundle with a top-level `const _` is rejected before its first statement runs — SyntaxError
// "Identifier '_' has already been declared" — leaving #video-app empty and the app invisible. Minifier names
// are luck, so this is checked on every build instead of trusted: an emitted JS chunk may declare NOTHING at
// its top level, not even a `var` — a bare `var` can also collide (a later classic script with `let` of the
// same name fails), and names Nextcloud really owns are called out separately below.
const RESERVED_GLOBALS = ['_', 'OC', 'OCP', 'window', 'document']

function noGlobalLeaks() {
    return {
        name: 'video-no-global-leaks',
        generateBundle(_options, bundle) {
            for (const [fileName, chunk] of Object.entries(bundle)) {
                if (chunk.type !== 'chunk' || !fileName.endsWith('.js')) {
                    continue
                }
                const ast = this.parse(chunk.code)
                for (const node of ast.body) {
                    if (node.type === 'VariableDeclaration') {
                        for (const declaration of node.declarations) {
                            const names = []
                            const collect = (target) => {
                                if (!target) return
                                if (target.type === 'Identifier') names.push(target.name)
                                else if (target.type === 'ObjectPattern') target.properties.forEach((p) => collect(p.value || p.argument))
                                else if (target.type === 'ArrayPattern') target.elements.forEach(collect)
                                else if (target.type === 'AssignmentPattern') collect(target.left)
                            }
                            collect(declaration.id)
                            for (const name of names) {
                                this.error(
                                    `${fileName}: a top-level ${node.kind} ${name} leaks into the page's global scope. `
                                    + (RESERVED_GLOBALS.includes(name)
                                        ? `Nextcloud already owns \`${name}\` on every page (\`_\` is a global function there), `
                                          + 'so the collision makes the whole bundle fail with a SyntaxError before anything runs.'
                                        : 'A global the bundle claims can collide with any other script on the page.')
                                    + ' wrapEntryChunkAsFunction() (which runs before this guard) keeps the entry '
                                    + "chunk inside one function; output.format 'iife' keeps it a classic script."
                                )
                            }
                        }
                    } else if (node.type === 'ClassDeclaration' || node.type === 'FunctionDeclaration') {
                        this.error(`${fileName}: a top-level ${node.type} leaks into the page's global scope.`)
                    }
                }
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
    plugins: [vue(), wrapEntryChunkAsFunction(), noGlobalLeaks(), moveCssToCssFolder(), copyPlyrSprite()],
    base: '/apps/video/',
    build: {
        outDir: 'js',
        emptyOutDir: true,
        sourcemap: false,
        // One stylesheet, always. Why (measured 2026-11-21): Vite emits a separate .css asset only for output
        // formats 'es'/'cjs' when cssCodeSplit is on; for any other format it silently injects the stylesheet
        // into the JS chunk as a `document.createElement('style')` statement instead. With format 'iife' the
        // build produced NO css/video-main.css at all (js grew 309.68 kB -> 354.46 kB, the CSS was inside it),
        // and Nextcloud's Util::addStyle needs the real file (see moveCssToCssFolder above). Turning
        // cssCodeSplit off takes the other code path: all CSS is collected and emitted as one asset, whatever
        // the output format, and the JS stays free of injected styles.
        cssCodeSplit: false,
        rollupOptions: {
            input: 'src/main.js',
            output: {
                // The bundle is loaded by \OCP\Util::addScript as a CLASSIC script
                // (<script nonce defer src="/apps/video/js/video-main.js">), so its top-level bindings live in
                // the page's global scope. Nextcloud keeps a global `_` there, and a bundle that declares
                // `const _` itself fails before a single line runs:
                //   SyntaxError: Identifier '_' has already been declared  ->  #video-app stays empty.
                // Measured on the real server page 2026-11-21 (plan/stages.md §56): the whole Video app stopped
                // rendering. Which minified name ends up at the top level is luck, so the build wraps the
                // bundle instead of relying on that luck.
                format: 'iife',
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
