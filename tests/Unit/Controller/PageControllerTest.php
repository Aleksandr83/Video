<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Controller;

use OCA\Video\Controller\PageController;
use OCP\AppFramework\Http\TemplateResponse;
use PHPUnit\Framework\TestCase;

/**
 * Tests for PageController.
 *
 * Constructing a TemplateResponse requires the full Nextcloud runtime, which is
 * only available when the tests run inside a Nextcloud installation
 * (…/apps/video). In standalone mode these tests are skipped (see bootstrap).
 */
class PageControllerTest extends TestCase {
    public function testIndexReturnsTemplateResponse(): void {
        if (!defined('NEXTCLOUD_RUNTIME_AVAILABLE') || !NEXTCLOUD_RUNTIME_AVAILABLE) {
            $this->markTestSkipped('Requires the full Nextcloud runtime — run inside a Nextcloud installation.');
        }

        $request = $this->createMock(\OCP\IRequest::class);
        $controller = new PageController('video', $request);

        $result = $controller->index();

        $this->assertInstanceOf(TemplateResponse::class, $result);
    }
}
