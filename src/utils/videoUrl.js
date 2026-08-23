/**
 * Build the WebDAV download URL for a file path relative to the user's files
 * root (e.g. '/Movies/a.mp4'). Nextcloud serves these files with Range request
 * support, so the HTML5 video element can seek/scrub in the player.
 */
export function davFileUrl(path) {
    const uid = typeof OC !== 'undefined' && OC.getCurrentUser
        ? (OC.getCurrentUser().uid || '')
        : ''
    const webroot = typeof OC !== 'undefined' && OC.webroot ? OC.webroot : ''

    const segments = String(path || '')
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/')

    return `${webroot}/remote.php/dav/files/${encodeURIComponent(uid)}/${segments}`
}
