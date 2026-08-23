<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Controller;

use OCA\Video\Controller\VideoController;
use OCA\Video\Service\SettingsService;
use OCA\Video\Service\VideoService;
use OCP\AppFramework\Http\DataResponse;
use PHPUnit\Framework\TestCase;

/**
 * Tests for VideoController (in-install; skipped in standalone mode).
 */
class VideoControllerTest extends TestCase {
    private function requireRuntime(): void {
        if (!defined('NEXTCLOUD_RUNTIME_AVAILABLE') || !NEXTCLOUD_RUNTIME_AVAILABLE) {
            $this->markTestSkipped('Requires the full Nextcloud runtime — run inside a Nextcloud installation.');
        }
    }

    public function testIndexReturnsVideoList(): void {
        $this->requireRuntime();

        $videos = $this->createMock(VideoService::class);
        $videos->method('getVideos')->willReturn([]);
        $videos->method('getSubfolders')->willReturn([]);
        $settings = $this->createMock(SettingsService::class);
        $settings->method('hasFolders')->willReturn(false);
        $request = $this->createMock(\OCP\IRequest::class);
        $rootFolder = $this->createMock(\OCP\Files\IRootFolder::class);
        $rootFolder->method('getUserFolder')->willReturn($this->createMock(\OCP\Files\Folder::class));

        $controller = new VideoController('video', $request, $videos, $settings, $rootFolder, 'alice');
        $result = $controller->index();

        $this->assertInstanceOf(DataResponse::class, $result);
        $this->assertSame([
            'configured' => false,
            'currentFolder' => '',
            'subfolders' => [],
            'videos' => [],
        ], $result->getData());
    }

    public function testIndexPassesCurrentFolder(): void {
        $this->requireRuntime();

        $videos = $this->createMock(VideoService::class);
        $userFolder = $this->createMock(\OCP\Files\Folder::class);
        $videos->expects($this->once())->method('getVideos')->with($this->identicalTo($userFolder), '/Movies');
        $videos->expects($this->once())->method('getSubfolders')->with($this->identicalTo($userFolder), '/Movies');
        $settings = $this->createMock(SettingsService::class);
        $settings->method('hasFolders')->willReturn(true);
        $request = $this->createMock(\OCP\IRequest::class);
        $rootFolder = $this->createMock(\OCP\Files\IRootFolder::class);
        $rootFolder->method('getUserFolder')->willReturn($userFolder);

        $controller = new VideoController('video', $request, $videos, $settings, $rootFolder, 'alice');
        $result = $controller->index('/Movies');

        $this->assertInstanceOf(DataResponse::class, $result);
    }
}
