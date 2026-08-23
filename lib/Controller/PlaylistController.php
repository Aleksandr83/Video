<?php

declare(strict_types=1);

namespace OCA\Video\Controller;

use OCA\Video\Db\Playlist;
use OCA\Video\Db\PlaylistItem;
use OCA\Video\Service\PlaylistItemNotFoundException;
use OCA\Video\Service\PlaylistNotFoundException;
use OCA\Video\Service\PlaylistService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\IRequest;

/**
 * REST API for user playlists.
 */
class PlaylistController extends Controller {
    public function __construct(
        string $appName,
        IRequest $request,
        private PlaylistService $playlists,
        private ?string $userId,
    ) {
        parent::__construct($appName, $request);
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function index(): DataResponse {
        $playlists = $this->playlists->getPlaylists($this->userId ?? '');

        return new DataResponse([
            'playlists' => array_map(
                static fn (Playlist $playlist): array => $playlist->toArray(),
                $playlists,
            ),
        ]);
    }

    /**
     * @NoAdminRequired
     */
    public function create(string $name = ''): DataResponse {
        try {
            $playlist = $this->playlists->createPlaylist($this->userId ?? '', $name);

            return new DataResponse($playlist->toArray(), Http::STATUS_CREATED);
        } catch (\InvalidArgumentException $e) {
            return new DataResponse(['error' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
        }
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function show(int $id): DataResponse {
        try {
            [$playlist, $items] = $this->playlists->getPlaylist($this->userId ?? '', $id);

            return new DataResponse([
                'playlist' => $playlist->toArray(),
                'items' => array_map(
                    static fn (PlaylistItem $item): array => $item->toArray(),
                    $items,
                ),
            ]);
        } catch (PlaylistNotFoundException $e) {
            return new DataResponse(['error' => 'Playlist not found'], Http::STATUS_NOT_FOUND);
        }
    }

    /**
     * @NoAdminRequired
     */
    public function rename(int $id, string $name = ''): DataResponse {
        try {
            $playlist = $this->playlists->renamePlaylist($this->userId ?? '', $id, $name);

            return new DataResponse($playlist->toArray());
        } catch (\InvalidArgumentException $e) {
            return new DataResponse(['error' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
        } catch (PlaylistNotFoundException $e) {
            return new DataResponse(['error' => 'Playlist not found'], Http::STATUS_NOT_FOUND);
        }
    }

    /**
     * @NoAdminRequired
     */
    public function destroy(int $id): DataResponse {
        try {
            $this->playlists->deletePlaylist($this->userId ?? '', $id);

            return new DataResponse([], Http::STATUS_NO_CONTENT);
        } catch (PlaylistNotFoundException $e) {
            return new DataResponse(['error' => 'Playlist not found'], Http::STATUS_NOT_FOUND);
        }
    }

    /**
     * @NoAdminRequired
     */
    public function addItem(int $id, string $path = ''): DataResponse {
        try {
            $item = $this->playlists->addItem($this->userId ?? '', $id, $path);

            return new DataResponse($item->toArray(), Http::STATUS_CREATED);
        } catch (\InvalidArgumentException $e) {
            return new DataResponse(['error' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
        } catch (PlaylistNotFoundException $e) {
            return new DataResponse(['error' => 'Playlist not found'], Http::STATUS_NOT_FOUND);
        }
    }

    /**
     * @NoAdminRequired
     */
    public function removeItem(int $id, int $itemId): DataResponse {
        try {
            $this->playlists->removeItem($this->userId ?? '', $id, $itemId);

            return new DataResponse([]);
        } catch (PlaylistNotFoundException $e) {
            return new DataResponse(['error' => 'Playlist not found'], Http::STATUS_NOT_FOUND);
        } catch (PlaylistItemNotFoundException $e) {
            return new DataResponse(['error' => 'Item not found'], Http::STATUS_NOT_FOUND);
        }
    }

    /**
     * @NoAdminRequired
     *
     * @param list<int> $order
     */
    public function reorder(int $id, array $order = []): DataResponse {
        try {
            $this->playlists->reorderItems($this->userId ?? '', $id, $order);

            return new DataResponse(['status' => 'ok']);
        } catch (\InvalidArgumentException $e) {
            return new DataResponse(['error' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
        } catch (PlaylistNotFoundException $e) {
            return new DataResponse(['error' => 'Playlist not found'], Http::STATUS_NOT_FOUND);
        }
    }
}
