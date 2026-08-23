import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

export function getVideos(folder = '') {
    const params = folder ? { folder } : {}
    return axios.get(generateUrl('/apps/video/videos'), { params })
}
