import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

export function getPlaylists() {
    return axios.get(generateUrl('/apps/video/playlists'))
}

export function createPlaylist(name) {
    return axios.post(generateUrl('/apps/video/playlists'), { name })
}

export function getPlaylist(id) {
    return axios.get(generateUrl(`/apps/video/playlists/${id}`))
}

export function renamePlaylist(id, name) {
    return axios.put(generateUrl(`/apps/video/playlists/${id}`), { name })
}

export function deletePlaylist(id) {
    return axios.delete(generateUrl(`/apps/video/playlists/${id}`))
}

export function addPlaylistItem(playlistId, path) {
    return axios.post(generateUrl(`/apps/video/playlists/${playlistId}/items`), { path })
}

export function removePlaylistItem(playlistId, itemId) {
    return axios.delete(generateUrl(`/apps/video/playlists/${playlistId}/items/${itemId}`))
}

export function reorderPlaylistItems(playlistId, order) {
    return axios.put(generateUrl(`/apps/video/playlists/${playlistId}/items`), { order })
}
