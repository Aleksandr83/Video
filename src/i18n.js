/**
 * Minimal lightweight i18n for the Video app (Russian + English).
 *
 * Full Nextcloud l10n/transifex integration can be layered on later; for now we
 * keep a small dictionary and a t() helper. English is the fallback language.
 */
const translations = {
    ru: {
        videosNav: 'Видео',
        settingsNav: 'Настройки',
        appLoading: 'Приложение Video загружается…',
        settingsTitle: 'Настройки поиска видео',
        settingsDescription: 'Выберите папки Nextcloud, в которых будет выполняться поиск видеофайлов. Вне выбранных папок поиск не ведётся.',
        settingsEmpty: 'Папки не настроены. Добавьте хотя бы одну папку.',
        settingsRecursive: 'Включая подпапки',
        addFolder: 'Добавить папку',
        pickFolderTitle: 'Выберите папку',
        save: 'Сохранить',
        saved: 'Сохранено',
        remove: 'Удалить',
        loading: 'Загрузка…',
        settingsLoadError: 'Не удалось загрузить настройки',
        settingsSaveError: 'Не удалось сохранить настройки',
        noFoldersHint: 'Папки для поиска видео не настроены. Попросите администратора настроить их в разделе «Настройки».',
        up: 'Вверх',
        down: 'Вниз',
        searchPlaceholder: 'Поиск видео…',
        allFormats: 'Все форматы',
        noVideosInFolder: 'В этой папке нет видео',
        close: 'Закрыть',
        playlistsNav: 'Плейлисты',
        playlistsTitle: 'Плейлисты',
        playlistNamePlaceholder: 'Название нового плейлиста',
        createPlaylist: 'Создать',
        noPlaylists: 'Плейлистов пока нет',
        playlistEmpty: 'В этом плейлисте нет видео',
        addToPlaylist: 'В плейлист',
        addedToPlaylist: 'Добавлено',
        rename: 'Переименовать',
        delete: 'Удалить',
        cancel: 'Отмена',
        playlistsLoadError: 'Не удалось загрузить плейлисты',
        playlistsSaveError: 'Не удалось сохранить плейлисты',
        createAndAdd: 'Создать и добавить',
        creating: 'Создание…',
        play: 'Играть',
        prev: 'Предыдущий трек',
        next: 'Следующий трек',
        shuffle: 'Перемешать',
        repeat: 'Повтор',
        shuffleOn: 'Перемешивание включено',
        shuffleOff: 'Перемешивание выключено',
        repeatOn: 'Повтор включён',
        repeatOff: 'Повтор выключен',
        videosLoadError: 'Не удалось загрузить список видео',
    },
    en: {
        videosNav: 'Videos',
        settingsNav: 'Settings',
        appLoading: 'Video app is loading…',
        settingsTitle: 'Video search settings',
        settingsDescription: 'Choose the Nextcloud folders where video files will be searched. No search is performed outside the selected folders.',
        settingsEmpty: 'No folders configured. Add at least one folder.',
        settingsRecursive: 'Include subfolders',
        addFolder: 'Add folder',
        pickFolderTitle: 'Choose a folder',
        save: 'Save',
        saved: 'Saved',
        remove: 'Remove',
        loading: 'Loading…',
        settingsLoadError: 'Failed to load settings',
        settingsSaveError: 'Failed to save settings',
        noFoldersHint: 'No folders for video search are configured. Ask an administrator to configure them in Settings.',
        up: 'Up',
        down: 'Down',
        searchPlaceholder: 'Search videos…',
        allFormats: 'All formats',
        noVideosInFolder: 'No videos in this folder',
        close: 'Close',
        playlistsNav: 'Playlists',
        playlistsTitle: 'Playlists',
        playlistNamePlaceholder: 'New playlist name',
        createPlaylist: 'Create',
        noPlaylists: 'No playlists yet',
        playlistEmpty: 'No videos in this playlist',
        addToPlaylist: 'Add to playlist',
        addedToPlaylist: 'Added',
        rename: 'Rename',
        delete: 'Delete',
        cancel: 'Cancel',
        playlistsLoadError: 'Failed to load playlists',
        playlistsSaveError: 'Failed to save playlists',
        createAndAdd: 'Create and add',
        creating: 'Creating…',
        play: 'Play',
        prev: 'Previous track',
        next: 'Next track',
        shuffle: 'Shuffle',
        repeat: 'Repeat',
        shuffleOn: 'Shuffle on',
        shuffleOff: 'Shuffle off',
        repeatOn: 'Repeat on',
        repeatOff: 'Repeat off',
        videosLoadError: 'Failed to load the video list',
    },
}

function currentLang() {
    if (typeof OC !== 'undefined' && typeof OC.getLanguage === 'function') {
        return OC.getLanguage()
    }
    return 'en'
}

export function t(key) {
    const lang = currentLang().startsWith('ru') ? 'ru' : 'en'
    const table = translations[lang] ?? translations.en
    return table[key] ?? key
}
