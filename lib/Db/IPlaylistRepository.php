<?php

declare(strict_types=1);

namespace OCA\Video\Db;

/**
 * Persistence contract for playlists. Implemented by the Nextcloud-backed
 * PlaylistRepository; the service depends on this interface so it can be
 * tested standalone.
 */
interface IPlaylistRepository {
    public function findById(int $id): ?Playlist;

    /**
     * @return Playlist[]
     */
    public function findByUser(string $userId): array;

    public function create(string $userId, string $name): Playlist;

    public function rename(Playlist $playlist): void;

    public function deletePlaylist(Playlist $playlist): void;
}
