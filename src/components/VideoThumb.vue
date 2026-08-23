<template>
    <div ref="root" class="video-thumb">
        <img v-if="src" class="video-thumb__img" :src="src" alt="">
        <div v-else class="video-thumb__placeholder">▶</div>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { davFileUrl } from '../utils/videoUrl'
import { generateVideoThumbnail } from '../utils/videoThumbnail'

// A transient network/DNS failure must not leave a card without a preview:
// retry capturing the frame every 10 seconds until it succeeds.
const RETRY_DELAY = 10000

const props = defineProps({
    path: { type: String, required: true },
})

const root = ref(null)
const src = ref('')
let retryTimer = null
let io = null

onMounted(() => {
    const el = root.value
    if (el && typeof IntersectionObserver !== 'undefined') {
        // Generate the frame only when the card becomes visible (lazy).
        io = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                io.disconnect()
                io = null
                load()
            }
        }, { rootMargin: '200px' })
        io.observe(el)
    } else {
        load()
    }
})

onBeforeUnmount(() => {
    if (io) {
        io.disconnect()
        io = null
    }
    clearRetry()
})

async function load() {
    try {
        src.value = await generateVideoThumbnail(davFileUrl(props.path))
        clearRetry()
    } catch (e) {
        // A failed capture (e.g. the DNS server not answering) is retried.
        scheduleRetry()
    }
}

function scheduleRetry() {
    if (retryTimer) {
        return
    }
    retryTimer = setTimeout(() => {
        retryTimer = null
        load()
    }, RETRY_DELAY)
}

function clearRetry() {
    if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
    }
}
</script>

<style scoped>
.video-thumb {
    position: relative;
    width: 100%;
    height: 100%;
}

.video-thumb__img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.video-thumb__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    color: var(--color-text-maxcontrast);
    background: var(--color-background-dark);
}
</style>
