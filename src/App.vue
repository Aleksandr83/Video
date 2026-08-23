<template>
    <div class="video-app">
        <header class="video-app__header">
            <h1 class="video-app__title">{{ title }}</h1>
            <nav class="video-app__nav">
                <router-link class="video-app__link" to="/">{{ t('videosNav') }}</router-link>
                <router-link class="video-app__link" to="/playlists">{{ t('playlistsNav') }}</router-link>
                <router-link v-if="isAdmin" class="video-app__link" to="/settings">{{ t('settingsNav') }}</router-link>
            </nav>
        </header>
        <main class="video-app__content">
            <router-view />
        </main>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { t } from './i18n'

const title = 'Video'
const isAdmin = ref(typeof OC !== 'undefined' && typeof OC.isUserAdmin === 'function' ? OC.isUserAdmin() : false)
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

.video-app__nav {
    display: flex;
    gap: 12px;
}

.video-app__link {
    color: var(--color-main-text);
    text-decoration: none;
}
</style>
