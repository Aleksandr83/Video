import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

export function incrementViewRequest(path) {
    return axios.post(generateUrl('/apps/video/views'), { path })
}
