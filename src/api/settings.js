import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

export function getSettings() {
    return axios.get(generateUrl('/apps/video/settings'))
}

export function saveSettings(folders) {
    return axios.put(generateUrl('/apps/video/settings'), { folders })
}
