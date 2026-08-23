<template>
    <div ref="root" class="video-thumb">
        <img v-if="src" class="video-thumb__img" :src="src" alt="">
        <div v-else class="video-thumb__placeholder">▶</div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { davFileUrl } from '../utils/videoUrl'
import { generateVideoThumbnail } from '../utils/videoThumbnail'

const props = defineProps({
    path: { type: String, required: true },
})

const root = ref(null)
const src = ref('')

onMounted(() => {
    const el = root.value
    if (el && typeof IntersectionObserver !== 'undefined') {
        // Generate the frame only when the card becomes visible (lazy).
        const io = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                io.disconnect()
                load()
            }
        }, { rootMargin: '200px' })
        io.observe(el)
    } else {
        load()
    }
})

async function load() {
    try {
        src.value = await generateVideoThumbnail(davFileUrl(props.path))
    } catch (e) {
        // Keep the placeholder when the frame cannot be captured.
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
