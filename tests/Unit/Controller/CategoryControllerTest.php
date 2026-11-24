<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Controller;

use OCA\Video\Controller\CategoryController;
use OCA\Video\Db\Category;
use OCA\Video\Service\CategoryNotFoundException;
use OCA\Video\Service\CategoryService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use PHPUnit\Framework\TestCase;

/**
 * Tests for CategoryController.
 *
 * Constructing controllers and responses requires the full Nextcloud runtime, so these tests run
 * inside a Nextcloud installation (…/apps/video) and are skipped in standalone mode (see bootstrap).
 */
class CategoryControllerTest extends TestCase {
    private function requireRuntime(): void {
        if (!defined('NEXTCLOUD_RUNTIME_AVAILABLE') || !NEXTCLOUD_RUNTIME_AVAILABLE) {
            $this->markTestSkipped('Requires the full Nextcloud runtime — run inside a Nextcloud installation.');
        }
    }

    private function category(int $id, string $name): Category {
        $category = new Category();
        $category->setId($id);
        $category->setName($name);

        return $category;
    }

    public function testIndexReturnsCategories(): void {
        $this->requireRuntime();

        $service = $this->createMock(CategoryService::class);
        $service->method('getCategories')->willReturn([$this->category(1, 'Music')]);
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new CategoryController('video', $request, $service);
        $result = $controller->index();

        $this->assertInstanceOf(DataResponse::class, $result);
        $this->assertSame(['categories' => [['id' => 1, 'name' => 'Music']]], $result->getData());
    }

    public function testCreateReturnsCreatedCategory(): void {
        $this->requireRuntime();

        $service = $this->createMock(CategoryService::class);
        $service->method('createCategory')->with('Films')->willReturn($this->category(2, 'Films'));
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new CategoryController('video', $request, $service);
        $result = $controller->create('Films');

        $this->assertSame(Http::STATUS_CREATED, $result->getStatus());
        $this->assertSame(['id' => 2, 'name' => 'Films'], $result->getData());
    }

    public function testCreateRejectsAnInvalidNameWithBadRequest(): void {
        $this->requireRuntime();

        $service = $this->createMock(CategoryService::class);
        $service->method('createCategory')
            ->willThrowException(new \InvalidArgumentException('Category name is required'));
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new CategoryController('video', $request, $service);
        $result = $controller->create('   ');

        $this->assertSame(Http::STATUS_BAD_REQUEST, $result->getStatus());
        $this->assertSame(['error' => 'Category name is required'], $result->getData());
    }

    public function testRenameReturnsTheRenamedCategory(): void {
        $this->requireRuntime();

        $service = $this->createMock(CategoryService::class);
        $service->method('renameCategory')->with(3, 'Live music')
            ->willReturn($this->category(3, 'Live music'));
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new CategoryController('video', $request, $service);
        $result = $controller->rename(3, 'Live music');

        $this->assertSame(Http::STATUS_OK, $result->getStatus());
        $this->assertSame(['id' => 3, 'name' => 'Live music'], $result->getData());
    }

    public function testRenameOfAnUnknownCategoryIsNotFound(): void {
        $this->requireRuntime();

        $service = $this->createMock(CategoryService::class);
        $service->method('renameCategory')->willThrowException(new CategoryNotFoundException());
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new CategoryController('video', $request, $service);
        $result = $controller->rename(99, 'Music');

        $this->assertSame(Http::STATUS_NOT_FOUND, $result->getStatus());
    }

    public function testDestroyReportsOk(): void {
        $this->requireRuntime();

        $service = $this->createMock(CategoryService::class);
        $service->expects($this->once())->method('deleteCategory')->with(5);
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new CategoryController('video', $request, $service);
        $result = $controller->destroy(5);

        $this->assertSame(['status' => 'ok'], $result->getData());
    }

    public function testDestroyOfAnUnknownCategoryIsNotFound(): void {
        $this->requireRuntime();

        $service = $this->createMock(CategoryService::class);
        $service->method('deleteCategory')->willThrowException(new CategoryNotFoundException());
        $request = $this->createMock(\OCP\IRequest::class);

        $controller = new CategoryController('video', $request, $service);
        $result = $controller->destroy(99);

        $this->assertSame(Http::STATUS_NOT_FOUND, $result->getStatus());
    }
}
