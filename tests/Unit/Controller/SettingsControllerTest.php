<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Controller;

use OCA\Video\Controller\SettingsController;
use OCA\Video\Service\SettingsService;
use OCP\AppFramework\Http\DataResponse;
use PHPUnit\Framework\TestCase;

/**
 * Tests for SettingsController.
 *
 * Constructing controllers and responses requires the full Nextcloud runtime,
 * so these tests run inside a Nextcloud installation (…/apps/video) and are
 * skipped in standalone mode (see bootstrap).
 */
class SettingsControllerTest extends TestCase {
    private function requireRuntime(): void {
        if (!defined('NEXTCLOUD_RUNTIME_AVAILABLE') || !NEXTCLOUD_RUNTIME_AVAILABLE) {
            $this->markTestSkipped('Requires the full Nextcloud runtime — run inside a Nextcloud installation.');
        }
    }

    public function testIndexReturnsFoldersAndConfiguredFlag(): void {
        $this->requireRuntime();

        $settings = $this->createMock(SettingsService::class);
        $settings->method('getFolders')->willReturn([]);
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new SettingsController('video', $request, $settings);
        $result = $controller->index();

        $this->assertInstanceOf(DataResponse::class, $result);
        $this->assertSame(['folders' => [], 'configured' => false], $result->getData());
    }

    public function testUpdateStoresFolders(): void {
        $this->requireRuntime();

        $settings = $this->createMock(SettingsService::class);
        $settings->expects($this->once())->method('setFolders');
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new SettingsController('video', $request, $settings);
        $result = $controller->update([
            ['path' => '/Movies', 'recursive' => true],
        ]);

        $this->assertInstanceOf(DataResponse::class, $result);
        $this->assertSame(['status' => 'ok'], $result->getData());
    }
}
