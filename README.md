# Video — local video player for Nextcloud

A Nextcloud app that turns a storage of video files into a personal video portal:
browsing a video list, folder navigation, search, a built-in player and playlists.

## Features

- Browse and play videos **right in the browser** (mp4, webm and other browser-supported formats)
- Convenient interface: video list, folder browsing, search and filters (by folders and extensions)
- **Settings (admin)**: choose Nextcloud folders to scan for videos, with recursion
  (including subfolders) configured separately for each folder; **no search is performed
  outside the selected folders**. Until folders are configured — an empty list with a hint
- Player (Plyr): play/pause, seeking, volume, fullscreen mode, speed, subtitles (WebVTT).
  In fullscreen on a phone the player follows the shape of the video: wide videos are shown
  in landscape (the screen is asked to rotate, and if the browser or the system refuses, the
  player rotates itself), vertical videos stay in portrait
- **Track navigation in the player row**: prev/next buttons are added right after play/pause in
  Plyr's control bar and are visible only in fullscreen (outside fullscreen the queue row under
  the player already has them). A button is dimmed and inert when there is no neighbour to go to.
  Available on both screens — "Playlists" (queue) and "Videos" (the card list).
- **Control bar in a narrow player** (a phone, both fullscreen and the ordinary player): the seek
  bar and the time get their own row above the buttons instead of being squeezed to 35-90 px inside
  the button row. The threshold is the width of the player (600 px), so a wide desktop layout keeps
  Plyr's single-row bar. In fullscreen the Picture-in-Picture button is hidden — otherwise the
  exit-fullscreen button wraps onto a row of its own.
- **Playlists**: create, save, open, add/remove files, reorder
- Playback logic: auto-advance to the next file, shuffle, loop the playlist
- Resume playback from where you left off (localStorage)
- Multitenancy: works with Nextcloud accounts
- Localization: Russian + English

> Note on "quality": for local files (mp4/webm), quality switching is determined by the
> file itself and the browser. The player implements speed, subtitles and fullscreen mode;
> quality switching support is left extensible (a foundation for HLS/DASH in the future).

## Technology stack

| Layer | Technology |
|---|---|
| Backend | PHP 8.3, native Nextcloud app framework (OCP API), Nextcloud 34 |
| Frontend | Vue 3 (Composition API), Vite, Vitest |
| Player | Plyr (HTML5 `<video>`) |
| Playlist storage | Nextcloud database |
| Settings storage | Nextcloud appconfig (global, admin) |
| File access | WebDAV / Nextcloud Files API |
| Tests | PHPUnit (backend), Vitest + @vue/test-utils (frontend) |

## Project structure

```
Video/
├── appinfo/        # App registration: info.xml, routes.php
├── lib/            # PHP backend (namespace OCA\Video)
│   ├── AppInfo/    #   Application entry point
│   ├── Controller/ #   Controllers
│   ├── Service/    #   Services and business logic
│   ├── Db/         #   Entities, interfaces and repositories (playlists)
│   └── Migration/  #   Database migrations
├── src/            # Vue 3 frontend (sources)
│   ├── views/      #   Pages (Videos, Playlists, Settings)
│   ├── components/ #   Components (VideoPlayer, QueuePlayer, AddToPlaylist)
│   ├── composables/#   Logic (playback queue)
│   ├── api/        #   API client
│   ├── utils/      #   Helpers (WebDAV URL, resume)
│   └── assets/     #   Styles
├── templates/      # PHP page templates
├── js/             # Built JS bundle (generated, not stored in git)
├── css/            # Built styles (generated, not stored in git)
├── l10n/           # Localization
├── tests/          # Tests
│   ├── Unit/       #   PHPUnit
│   ├── js/         #   Vitest
│   └── stubs/      #   OCP stubs for standalone tests
├── docs/           # Documentation, development history
├── composer.json   # PHP dependencies and autoloading
├── package.json    # JS dependencies and scripts
├── phpunit.xml     # PHPUnit configuration
├── vite.config.js  # Frontend build
└── vitest.config.js# Vitest configuration
```

## Requirements

- Nextcloud **34+**
- PHP **8.3+**
- Node.js **20+** (for building the frontend)
- Composer **2.x**

## Installation and development

```bash
# 1. Install PHP dependencies (backend)
composer install

# 2. Install and build the frontend
npm install
npm run build          # output in js/ (video-main.js) and css/ (video-main.css)

# 3. Deploy the app
#    Copy/symlink this folder to nextcloud/apps/video
#    (the folder name must match the app id "video"),
#    then enable it either in the UI:
#       Nextcloud → Settings → Apps → enable "Video"
#    or from the command line (run from the Nextcloud root, as the web user):
#       sudo -u www-data php occ app:enable video
#    Enabling the app runs its database migrations automatically (a fresh
#    install needs no extra step).
#    Only when upgrading an EXISTING installation to a newer app version do the
#    new migrations need to be applied explicitly:
#       sudo -u www-data php occ upgrade
```

## Tests

```bash
composer test:unit      # PHPUnit (backend)
npm run test:unit       # Vitest (frontend)
```

## Development conventions

- Comments in code, scripts, CSS and configuration files are written in **English** — the project is
  international. The `plan/` and `docs/` folders are the exception: they are maintained in Russian.
- The rule covers comments only. Data strings — localization dictionaries (`src/i18n.js`) and other UI
  text — stay in their own language and are not translated.
- `README.md` and commit messages are in English as well.
- The convention is enforced by code review; an automated lint or test for comment language is
  deliberately not part of the toolchain.

