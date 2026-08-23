// Limit how many videos we load at once for thumbnails — loading all visible
// cards simultaneously makes the browser abort many requests (ERR_ABORTED).
const MAX_CONCURRENT = 4
let active = 0
const waiting = []

function runNext() {
    if (active >= MAX_CONCURRENT || waiting.length === 0) {
        return
    }
    active += 1
    const task = waiting.shift()
    task().finally(() => {
        active -= 1
        runNext()
    })
}

/**
 * Capture a frame from a video in the browser and return it as a JPEG data URL.
 *
 * Works for any browser-playable format (mp4, webm) without server-side
 * preview configuration (no ffmpeg needed). It seeks ~1s in, draws the frame
 * to a canvas and resolves with the image data.
 */
export function generateVideoThumbnail(url, maxW = 320, maxH = 180) {
    return new Promise((resolve, reject) => {
        // Forward the capture result to the caller; the queue only limits how
        // many video elements are loading at the same time.
        waiting.push(() => captureFrame(url, maxW, maxH).then(resolve, reject))
        runNext()
    })
}

function captureFrame(url, maxW, maxH) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.preload = 'metadata'
        video.style.display = 'none'
        video.src = url
        document.body.appendChild(video)

        let done = false
        const finish = (fn, value) => {
            if (done) {
                return
            }
            done = true
            video.removeAttribute('src')
            try {
                video.load()
            } catch (e) {
                // ignore
            }
            if (video.parentNode) {
                video.parentNode.removeChild(video)
            }
            fn(value)
        }

        video.addEventListener('error', () => finish(reject, new Error('video load failed')))

        video.addEventListener('loadedmetadata', () => {
            const seekTo = Math.min(1, (video.duration || 1) * 0.1)
            try {
                video.currentTime = seekTo
            } catch (e) {
                finish(reject, e)
            }
        })

        video.addEventListener('seeked', () => {
            try {
                const width = video.videoWidth || maxW
                const height = video.videoHeight || maxH
                if (!width || !height) {
                    finish(reject, new Error('no video dimensions'))
                    return
                }
                const scale = Math.min(maxW / width, maxH / height, 1)
                const canvas = document.createElement('canvas')
                canvas.width = Math.max(1, Math.round(width * scale))
                canvas.height = Math.max(1, Math.round(height * scale))
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    finish(reject, new Error('no canvas context'))
                    return
                }
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                finish(resolve, canvas.toDataURL('image/jpeg', 0.7))
            } catch (e) {
                finish(reject, e)
            }
        })
    })
}
