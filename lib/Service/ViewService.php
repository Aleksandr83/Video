<?php

declare(strict_types=1);

namespace OCA\Video\Service;

use OCA\Video\Db\IVideoViewRepository;

/**
 * Per-user video view counters (used to sort the Videos page by popularity).
 */
class ViewService {
    public function __construct(
        private IVideoViewRepository $views,
    ) {
    }

    /**
     * @return array<string, int> map of video path => view count
     */
    public function getViewCounts(string $userId): array {
        $map = [];
        foreach ($this->views->findByUser($userId) as $view) {
            $map[$view->getPath()] = $view->getCount();
        }

        return $map;
    }

    public function incrementView(string $userId, string $path): void {
        $path = trim($path);
        if ($path === '') {
            throw new \InvalidArgumentException('Video path is required');
        }

        $this->views->increment($userId, $path);
    }
}
