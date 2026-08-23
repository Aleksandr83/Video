<?php

declare(strict_types=1);

namespace OCA\Video\Service;

use OCA\Video\Db\VideoItem;
use OCP\Files\File;
use OCP\Files\Folder;

/**
 * Discovers video files, restricted to the folders configured by the admin
 * (see SettingsService). Each configured folder has its own "include subfolders"
 * flag; no search is performed outside the configured folders.
 *
 * The service receives the current user's root folder (OCP\Files\Folder) from
 * the controller, which keeps it easy to test and free of IRootFolder's heavy
 * dependency tree.
 */
class VideoService {
    /** @var string[] */
    public const SUPPORTED_EXTENSIONS = ['mp4', 'webm', 'm4v', 'ogv'];

    public function __construct(
        private SettingsService $settings,
    ) {
    }

    /**
     * @return VideoItem[]
     */
    public function getVideos(Folder $userFolder, string $currentPath = ''): array {
        $videos = [];

        foreach ($this->settings->getFolders() as $folderSetting) {
            $rootPath = rtrim($folderSetting->getPath(), '/');
            $recursive = $folderSetting->isRecursive();

            if ($currentPath === '') {
                // Aggregate the whole configured root.
                $node = $this->getFolder($userFolder, $rootPath);
                if ($node === null) {
                    continue;
                }
                foreach ($this->scan($node, $recursive) as $video) {
                    $videos[] = $video;
                }
                continue;
            }

            // Navigation: only folders inside a recursive root are reachable.
            if (!$recursive) {
                continue;
            }
            if ($currentPath !== $rootPath && !str_starts_with($currentPath, $rootPath . '/')) {
                continue;
            }
            $node = $this->getFolder($userFolder, $currentPath);
            if ($node === null) {
                continue;
            }
            foreach ($this->scan($node, true) as $video) {
                $videos[] = $video;
            }
        }

        usort(
            $videos,
            static fn (VideoItem $a, VideoItem $b): int => strnatcasecmp($a->getPath(), $b->getPath()),
        );

        return $videos;
    }

    /**
     * Subfolders available for navigation.
     *
     * At the top level (empty current path) the configured roots themselves are
     * returned. Deeper navigation is only possible inside recursive roots.
     *
     * @return string[]
     */
    public function getSubfolders(Folder $userFolder, string $currentPath = ''): array {
        if ($currentPath === '') {
            $roots = [];
            foreach ($this->settings->getFolders() as $folderSetting) {
                if ($this->getFolder($userFolder, $folderSetting->getPath()) !== null) {
                    $roots[] = $folderSetting->getPath();
                }
            }
            sort($roots);
            return $roots;
        }

        if (!$this->isInsideRecursiveRoot($currentPath)) {
            return [];
        }

        $node = $this->getFolder($userFolder, $currentPath);
        if ($node === null) {
            return [];
        }

        $subfolders = [];
        foreach ($node->getDirectoryListing() as $child) {
            if ($child instanceof Folder) {
                $subfolders[] = VideoItem::pathFromNode($child);
            }
        }
        sort($subfolders);

        return $subfolders;
    }

    private function isInsideRecursiveRoot(string $currentPath): bool {
        foreach ($this->settings->getFolders() as $folderSetting) {
            if (!$folderSetting->isRecursive()) {
                continue;
            }
            $rootPath = rtrim($folderSetting->getPath(), '/');
            if ($currentPath === $rootPath || str_starts_with($currentPath, $rootPath . '/')) {
                return true;
            }
        }
        return false;
    }

    /**
     * @return VideoItem[]
     */
    private function scan(Folder $folder, bool $recursive): array {
        $result = [];
        foreach ($folder->getDirectoryListing() as $node) {
            if ($node instanceof File) {
                if ($this->isSupported($node->getName())) {
                    $result[] = VideoItem::fromNode($node);
                }
            } elseif ($node instanceof Folder && $recursive) {
                foreach ($this->scan($node, true) as $video) {
                    $result[] = $video;
                }
            }
        }
        return $result;
    }

    private function isSupported(string $name): bool {
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        return in_array($extension, self::SUPPORTED_EXTENSIONS, true);
    }

    private function getFolder(Folder $userFolder, string $path): ?Folder {
        if (!$userFolder->nodeExists($path)) {
            return null;
        }
        $node = $userFolder->get($path);
        return $node instanceof Folder ? $node : null;
    }
}
