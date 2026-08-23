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
 * as a JSON-encoded array of {path, recursive} entries.
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
            $normalized[] = (new FolderSetting($path, $folder->isRecursive()))->toArray();
        }

        $this->config->setAppValue(
            Application::APP_ID,
            self::CONFIG_KEY,
            json_encode($normalized, JSON_UNESCAPED_SLASHES),
        );
    }
}
