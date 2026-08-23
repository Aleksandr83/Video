<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Service;

use OCA\Video\Db\IPlaylistItemRepository;
use OCA\Video\Db\IPlaylistRepository;
use OCA\Video\Db\Playlist;
use OCA\Video\Db\PlaylistItem;
use OCA\Video\Service\PlaylistItemNotFoundException;
use OCA\Video\Service\PlaylistNotFoundException;
use OCA\Video\Service\PlaylistService;
use PHPUnit\Framework\TestCase;

class PlaylistServiceTest extends TestCase {
    private IPlaylistRepository $playlists;
    private IPlaylistItemRepository $items;
    private PlaylistService $service;

    protected function setUp(): void {
        $this->playlists = $this->createMock(IPlaylistRepository::class);
        $this->items = $this->createMock(IPlaylistItemRepository::class);
        $this->service = new PlaylistService($this->playlists, $this->items);
    }

    private function playlist(int $id, string $userId, string $name): Playlist {
        $playlist = new Playlist();
        $playlist->setId($id);
        $playlist->setUserId($userId);
        $playlist->setName($name);
        return $playlist;
    }

    private function item(int $id, int $playlistId, string $path, int $sortOrder): PlaylistItem {
        $item = new PlaylistItem();
        $item->setId($id);
        $item->setPlaylistId($playlistId);
        $item->setPath($path);
        $item->setSortOrder($sortOrder);
        return $item;
    }

    public function testCreatePlaylistTrimsAndDelegates(): void {
        $this->playlists->expects($this->once())
            ->method('create')
            ->with('alice', 'My List')
            ->willReturn($this->playlist(1, 'alice', 'My List'));

        $result = $this->service->createPlaylist('alice', '  My List  ');

        $this->assertSame('alice', $result->getUserId());
    }

    public function testCreatePlaylistRejectsEmptyName(): void {
        $this->expectException(\InvalidArgumentException::class);

        $this->service->createPlaylist('alice', '   ');
    }

    public function testGetPlaylistsReturnsUserPlaylists(): void {
        $this->playlists->method('findByUser')->willReturn([$this->playlist(1, 'alice', 'A')]);

        $this->assertCount(1, $this->service->getPlaylists('alice'));
    }

    public function testGetPlaylistReturnsPlaylistAndItems(): void {
        $playlist = $this->playlist(1, 'alice', 'A');
        $this->playlists->method('findById')->with(1)->willReturn($playlist);
        $this->items->method('findByPlaylist')->with(1)->willReturn([$this->item(10, 1, '/a.mp4', 1)]);

        [$result, $items] = $this->service->getPlaylist('alice', 1);

        $this->assertSame($playlist, $result);
        $this->assertCount(1, $items);
    }

    public function testGetPlaylistThrowsWhenNotFound(): void {
        $this->playlists->method('findById')->willReturn(null);

        $this->expectException(PlaylistNotFoundException::class);
        $this->service->getPlaylist('alice', 99);
    }

    public function testGetPlaylistThrowsWhenNotOwner(): void {
        $this->playlists->method('findById')->willReturn($this->playlist(1, 'bob', 'A'));

        $this->expectException(PlaylistNotFoundException::class);
        $this->service->getPlaylist('alice', 1);
    }

    public function testRenamePlaylist(): void {
        $playlist = $this->playlist(1, 'alice', 'A');
        $this->playlists->method('findById')->willReturn($playlist);
        $this->playlists->expects($this->once())->method('rename')->with($playlist);

        $result = $this->service->renamePlaylist('alice', 1, 'New Name');

        $this->assertSame($playlist, $result);
    }

    public function testRenamePlaylistRejectsEmptyName(): void {
        $this->playlists->method('findById')->willReturn($this->playlist(1, 'alice', 'A'));

        $this->expectException(\InvalidArgumentException::class);
        $this->service->renamePlaylist('alice', 1, '  ');
    }

    public function testDeletePlaylistRemovesItemsAndPlaylist(): void {
        $playlist = $this->playlist(1, 'alice', 'A');
        $this->playlists->method('findById')->willReturn($playlist);
        $this->items->expects($this->once())->method('deleteByPlaylist')->with(1);
        $this->playlists->expects($this->once())->method('deletePlaylist')->with($playlist);

        $this->service->deletePlaylist('alice', 1);
    }

    public function testAddItemAppendsAtTheEnd(): void {
        $this->playlists->method('findById')->willReturn($this->playlist(1, 'alice', 'A'));
        $this->items->method('findByPlaylist')->with(1)->willReturn([$this->item(10, 1, '/a.mp4', 1)]);
        $this->items->expects($this->once())
            ->method('add')
            ->with(1, '/b.mp4', 2)
            ->willReturn($this->item(11, 1, '/b.mp4', 2));

        $result = $this->service->addItem('alice', 1, '/b.mp4');

        $this->assertSame(11, $result->getId());
    }

    public function testAddItemRejectsEmptyPath(): void {
        $this->expectException(\InvalidArgumentException::class);

        $this->service->addItem('alice', 1, '   ');
    }

    public function testRemoveItem(): void {
        $this->playlists->method('findById')->willReturn($this->playlist(1, 'alice', 'A'));
        $this->items->expects($this->once())->method('remove')->with(1, 10)->willReturn(true);

        $this->service->removeItem('alice', 1, 10);
    }

    public function testRemoveItemThrowsWhenMissing(): void {
        $this->playlists->method('findById')->willReturn($this->playlist(1, 'alice', 'A'));
        $this->items->method('remove')->willReturn(false);

        $this->expectException(PlaylistItemNotFoundException::class);
        $this->service->removeItem('alice', 1, 999);
    }

    public function testReorderItemsAppliesNewOrder(): void {
        $this->playlists->method('findById')->willReturn($this->playlist(1, 'alice', 'A'));
        $this->items->method('findByPlaylist')->willReturn([
            $this->item(10, 1, '/a.mp4', 1),
            $this->item(11, 1, '/b.mp4', 2),
        ]);
        $this->items->expects($this->exactly(2))->method('setOrder');

        $this->service->reorderItems('alice', 1, [11, 10]);
    }

    public function testReorderItemsRejectsMismatchedOrder(): void {
        $this->playlists->method('findById')->willReturn($this->playlist(1, 'alice', 'A'));
        $this->items->method('findByPlaylist')->willReturn([
            $this->item(10, 1, '/a.mp4', 1),
            $this->item(11, 1, '/b.mp4', 2),
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->service->reorderItems('alice', 1, [11]);
    }

    public function testReorderItemsThrowsWhenNotOwner(): void {
        $this->playlists->method('findById')->willReturn($this->playlist(1, 'bob', 'A'));

        $this->expectException(PlaylistNotFoundException::class);
        $this->service->reorderItems('alice', 1, [10]);
    }
}
