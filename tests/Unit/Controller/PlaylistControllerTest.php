<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Controller;

use OCA\Video\Controller\PlaylistController;
use OCA\Video\Db\Playlist;
use OCA\Video\Service\PlaylistNotFoundException;
use OCA\Video\Service\PlaylistService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use PHPUnit\Framework\TestCase;

/**
 * Tests for PlaylistController (in-install; skipped in standalone mode).
 */
class PlaylistControllerTest extends TestCase {
    private function requireRuntime(): void {
        if (!defined('NEXTCLOUD_RUNTIME_AVAILABLE') || !NEXTCLOUD_RUNTIME_AVAILABLE) {
            $this->markTestSkipped('Requires the full Nextcloud runtime — run inside a Nextcloud installation.');
        }
    }

    private function playlist(int $id, string $userId, string $name): Playlist {
        $playlist = new Playlist();
        $playlist->setId($id);
        $playlist->setUserId($userId);
        $playlist->setName($name);
        $playlist->setCreatedAt(1000);
        return $playlist;
    }

    public function testIndexReturnsPlaylists(): void {
        $this->requireRuntime();

        $service = $this->createMock(PlaylistService::class);
        $service->method('getPlaylists')->willReturn([$this->playlist(1, 'alice', 'A')]);
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new PlaylistController('video', $request, $service, 'alice');
        $result = $controller->index();

        $this->assertInstanceOf(DataResponse::class, $result);
        $this->assertSame(['playlists' => [['id' => 1, 'name' => 'A', 'createdAt' => 1000]]], $result->getData());
    }

    public function testCreateReturnsCreatedStatus(): void {
        $this->requireRuntime();

        $service = $this->createMock(PlaylistService::class);
        $service->method('createPlaylist')->willReturn($this->playlist(1, 'alice', 'A'));
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new PlaylistController('video', $request, $service, 'alice');
        $result = $controller->create('A');

        $this->assertSame(Http::STATUS_CREATED, $result->getStatus());
    }

    public function testShowReturnsNotFoundForMissingPlaylist(): void {
        $this->requireRuntime();

        $service = $this->createMock(PlaylistService::class);
        $service->method('getPlaylist')->willThrowException(new PlaylistNotFoundException());
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new PlaylistController('video', $request, $service, 'alice');
        $result = $controller->show(99);

        $this->assertSame(Http::STATUS_NOT_FOUND, $result->getStatus());
    }
}
