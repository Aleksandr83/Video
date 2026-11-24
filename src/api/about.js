import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

// The About screen reports what the server knows: the version Nextcloud reports for this app, the version of
// Nextcloud itself, and which of the app migrations this instance has actually applied.
export function getAbout() {
    return axios.get(generateUrl('/apps/video/about'))
}
