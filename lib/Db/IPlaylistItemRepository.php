<?php

declare(strict_types=1);

namespace OCA\Video\Db;

/**
 * Persistence contract for playlist items.
 */
interface IPlaylistItemRepository {
    /**
     * Items of a playlist ordered by sort_order.
     *
     * @return PlaylistItem[]
     */
    public function findByPlaylist(int $playlistId): array;

    public function add(int $playlistId, string $path, int $sortOrder): PlaylistItem;

    public function remove(int $playlistId, int $itemId): bool;

    public function setOrder(int $itemId, int $sortOrder): void;

    public function deleteByPlaylist(int $playlistId): void;
}
