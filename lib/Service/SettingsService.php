<?php

declare(strict_types=1);

namespace OCA\Video\Service;

use OCA\Video\AppInfo\Application;
use OCA\Video\Db\FolderSetting;
use OCP\IConfig;

/**
 * Manages the admin-global video search folder settings.
 *
 * The folder list is stored in the Nextcloud app config (global, not per-user)
 * as a JSON-encoded array of {path, recursive, categoryId} entries. A category is
 * referenced by its id only; the names live in the `video_categories` table.
 */
class SettingsService {
    public const CONFIG_KEY = 'search_folders';

    public function __construct(
        private IConfig $config,
    ) {
    }

    /**
     * @return FolderSetting[]
     */
    public function getFolders(): array {
        $json = $this->config->getAppValue(Application::APP_ID, self::CONFIG_KEY, '');

        if ($json === '') {
            return [];
        }

        $data = json_decode($json, true);
        if (!is_array($data)) {
            return [];
        }

        $folders = [];
        foreach ($data as $item) {
            if (is_array($item)) {
                $folders[] = FolderSetting::fromArray($item);
            }
        }

        return $folders;
    }

    public function hasFolders(): bool {
        return count($this->getFolders()) > 0;
    }

    /**
     * The category of the configured folder a stored path belongs to (0 when it has none).
     */
    public function categoryIdForPath(string $path): int {
        return self::categoryIdForPathIn($this->getFolders(), $path);
    }

    /**
     * The same rule over a folder list that has already been read.
     *
     * The nearest (longest) configured folder wins: a folder registered inside another one claims the
     * videos below it, and an uncategorized inner folder deliberately hides the category above it —
     * that is how "this subfolder does not belong to that category" is expressed. A path outside every
     * configured folder has no category. Matching happens on directory boundaries, so '/Videosion' is
     * not below '/Videos'. The comparison is case-sensitive on purpose: a listing can only contain
     * videos that were found through these very folder paths.
     *
     * @param FolderSetting[] $folders
     */
    public static function categoryIdForPathIn(array $folders, string $path): int {
        $wanted = rtrim($path, '/');
        $categoryId = 0;
        $claimedLength = -1;

        foreach ($folders as $folder) {
            $root = rtrim($folder->getPath(), '/');
            if ($root === '') {
                continue;
            }
            if ($wanted !== $root && !str_starts_with($wanted, $root . '/')) {
                continue;
            }
            if (strlen($root) > $claimedLength) {
                $claimedLength = strlen($root);
                $categoryId = $folder->getCategoryId();
            }
        }

        return $categoryId;
    }

    /**
     * Replaces the configured folder list. Empty paths are skipped.
     *
     * @param FolderSetting[] $folders
     */
    public function setFolders(array $folders): void {
        $normalized = [];
        foreach ($folders as $folder) {
            $path = trim($folder->getPath());
            if ($path === '') {
                continue;
            }
            $normalized[] = (new FolderSetting(
                $path,
                $folder->isRecursive(),
                $folder->getCategoryId(),
            ))->toArray();
        }

        $this->config->setAppValue(
            Application::APP_ID,
            self::CONFIG_KEY,
            json_encode($normalized, JSON_UNESCAPED_SLASHES),
        );
    }

    /**
     * Unbinds every folder that points at the given category id.
     *
     * Called when a category row is deleted: without this step the folder list would keep ids of
     * rows that no longer exist, and the Settings screen would show them as "no category" while the
     * stored value still claims otherwise.
     */
    public function clearCategoryReferences(int $categoryId): void {
        if ($categoryId === 0) {
            return;
        }

        $folders = $this->getFolders();
        $cleared = [];
        $changed = false;

        foreach ($folders as $folder) {
            if ($folder->getCategoryId() === $categoryId) {
                $cleared[] = new FolderSetting($folder->getPath(), $folder->isRecursive(), 0);
                $changed = true;
                continue;
            }
            $cleared[] = $folder;
        }

        if (!$changed) {
            return;
        }

        $this->setFolders($cleared);
    }
}
