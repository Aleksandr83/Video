import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

// Categories are instance-wide reference data kept in the app database; a search folder stores only
// the id of its category, so renaming a category cannot orphan the folders that use it.
export function getCategories() {
    return axios.get(generateUrl('/apps/video/categories'))
}

export function createCategory(name) {
    return axios.post(generateUrl('/apps/video/categories'), { name })
}

export function renameCategory(id, name) {
    return axios.put(generateUrl(`/apps/video/categories/${id}`), { name })
}

export function deleteCategory(id) {
    return axios.delete(generateUrl(`/apps/video/categories/${id}`))
}
