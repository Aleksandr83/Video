<?php

declare(strict_types=1);

namespace OCA\Video\Service;

use OCA\Video\Db\IPlaylistItemRepository;
use OCA\Video\Db\IPlaylistRepository;
use OCA\Video\Db\Playlist;
use OCA\Video\Db\PlaylistItem;

/**
 * Playlist business logic. Playlists are per-user: every operation validates
 * that the playlist belongs to the current user.
 */
class PlaylistService {
    public function __construct(
        private IPlaylistRepository $playlists,
        private IPlaylistItemRepository $items,
    ) {
    }

    public function createPlaylist(string $userId, string $name): Playlist {
        $name = trim($name);
        if ($name === '') {
            throw new \InvalidArgumentException('Playlist name is required');
        }

        return $this->playlists->create($userId, $name);
    }

    /**
     * @return Playlist[]
     */
    public function getPlaylists(string $userId): array {
        return $this->playlists->findByUser($userId);
    }

    /**
     * @return array{0: Playlist, 1: PlaylistItem[]}
     */
    public function getPlaylist(string $userId, int $id): array {
        $playlist = $this->requireOwned($userId, $id);
        $items = $this->items->findByPlaylist($id);

        return [$playlist, $items];
    }

    public function renamePlaylist(string $userId, int $id, string $name): Playlist {
        $name = trim($name);
        if ($name === '') {
            throw new \InvalidArgumentException('Playlist name is required');
        }

        $playlist = $this->requireOwned($userId, $id);
        $playlist->setName($name);
        $this->playlists->rename($playlist);

        return $playlist;
    }

    public function deletePlaylist(string $userId, int $id): void {
        $playlist = $this->requireOwned($userId, $id);
        $this->items->deleteByPlaylist($id);
        $this->playlists->deletePlaylist($playlist);
    }

    public function addItem(string $userId, int $playlistId, string $path): PlaylistItem {
        $path = trim($path);
        if ($path === '') {
            throw new \InvalidArgumentException('Video path is required');
        }

        $this->requireOwned($userId, $playlistId);
        $sortOrder = count($this->items->findByPlaylist($playlistId)) + 1;

        return $this->items->add($playlistId, $path, $sortOrder);
    }

    public function removeItem(string $userId, int $playlistId, int $itemId): void {
        $this->requireOwned($userId, $playlistId);

        if (!$this->items->remove($playlistId, $itemId)) {
            throw new PlaylistItemNotFoundException();
        }
    }

    /**
     * @param list<int> $orderedIds
     */
    public function reorderItems(string $userId, int $playlistId, array $orderedIds): void {
        $this->requireOwned($userId, $playlistId);

        $existing = $this->items->findByPlaylist($playlistId);
        $existingIds = array_map(static fn (PlaylistItem $item): int => (int)$item->getId(), $existing);

        $given = array_map('intval', $orderedIds);
        sort($existingIds);
        sort($given);

        if ($existingIds !== $given) {
            throw new \InvalidArgumentException('Order does not match the playlist items');
        }

        $order = 1;
        foreach ($orderedIds as $itemId) {
            $this->items->setOrder((int)$itemId, $order++);
        }
    }

    private function requireOwned(string $userId, int $id): Playlist {
        $playlist = $this->playlists->findById($id);
        if ($playlist === null || $playlist->getUserId() !== $userId) {
            throw new PlaylistNotFoundException();
        }

        return $playlist;
    }
}
