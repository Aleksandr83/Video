<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Controller;

use OCA\Video\Controller\AboutController;
use OCA\Video\Service\AboutService;
use OCP\AppFramework\Http\DataResponse;
use PHPUnit\Framework\TestCase;

/**
 * Tests for AboutController.
 *
 * The access rules of the endpoint are read from the controller itself, so those checks run anywhere;
 * building a response needs the full Nextcloud runtime, so those tests are skipped in standalone mode
 * (see bootstrap).
 */
class AboutControllerTest extends TestCase {
    private function requireRuntime(): void {
        if (!defined('NEXTCLOUD_RUNTIME_AVAILABLE') || !NEXTCLOUD_RUNTIME_AVAILABLE) {
            $this->markTestSkipped('Requires the full Nextcloud runtime — run inside a Nextcloud installation.');
        }
    }

    public function testIndexIsOpenToRegularUsers(): void {
        $docBlock = (new \ReflectionMethod(AboutController::class, 'index'))->getDocComment();

        $this->assertIsString($docBlock);
        $this->assertStringContainsString('@NoAdminRequired', $docBlock, 'the About screen is for every user, not only for admins');
    }

    public function testIndexDoesNotNeedCsrfToken(): void {
        $docBlock = (new \ReflectionMethod(AboutController::class, 'index'))->getDocComment();

        $this->assertIsString($docBlock);
        $this->assertStringContainsString('@NoCSRFRequired', $docBlock, 'a plain read of the About data must work from the SPA');
    }

    public function testIndexReturnsWhatTheServiceCollected(): void {
        $this->requireRuntime();

        $summary = [
            'appId' => 'video',
            'appVersion' => '1.2.0',
            'nextcloudVersion' => '34.0.4.2',
            'migrations' => [['version' => '010300Date20261123114500', 'token' => '010300', 'file' => 'Version010300Date20261123114500.php', 'applied' => true]],
            'warnings' => [],
        ];

        $service = $this->createMock(AboutService::class);
        $service->method('summary')->willReturn($summary);
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new AboutController('video', $request, $service);
        $result = $controller->index();

        $this->assertInstanceOf(DataResponse::class, $result);
        $this->assertSame($summary, $result->getData());
    }
}
