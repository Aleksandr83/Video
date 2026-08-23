<?php

declare(strict_types=1);

namespace OCA\Video\Db;

/**
 * Persistence contract for per-user video view counters.
 */
interface IVideoViewRepository {
    /**
     * @return VideoView[]
     */
    public function findByUser(string $userId): array;

    public function increment(string $userId, string $path): VideoView;
}
