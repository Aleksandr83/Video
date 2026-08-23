import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import MainView from './views/MainView.vue'
import SettingsView from './views/SettingsView.vue'
import PlaylistsView from './views/PlaylistsView.vue'
import './assets/app.css'

// Entry point of the Video app. The bundle is loaded by templates/main.php
// (see PageController) and mounts into #video-app.
const router = createRouter({
    history: createWebHashHistory('/apps/video/'),
    routes: [
        { path: '/', name: 'home', component: MainView },
        { path: '/settings', name: 'settings', component: SettingsView },
        { path: '/playlists', name: 'playlists', component: PlaylistsView },
    ],
})

createApp(App).use(router).mount('#video-app')
