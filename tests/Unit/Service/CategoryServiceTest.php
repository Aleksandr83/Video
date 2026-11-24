<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Service;

use OCA\Video\Db\Category;
use OCA\Video\Db\ICategoryRepository;
use OCA\Video\Service\CategoryNotFoundException;
use OCA\Video\Service\CategoryService;
use OCA\Video\Service\SettingsService;
use PHPUnit\Framework\TestCase;

/**
 * Categories live in the database (one row per name); the search folder list keeps only the id of a
 * category, so renaming a category must not touch the folders that use it and deleting one must
 * unbind those folders instead of leaving them pointing at a row that is gone.
 */
class CategoryServiceTest extends TestCase {
    private ICategoryRepository|\PHPUnit\Framework\MockObject\MockObject $repo;
    private SettingsService|\PHPUnit\Framework\MockObject\MockObject $settings;
    private CategoryService $service;

    protected function setUp(): void {
        $this->repo = $this->createMock(ICategoryRepository::class);
        $this->settings = $this->createMock(SettingsService::class);
        $this->service = new CategoryService($this->repo, $this->settings);
    }

    private function category(int $id, string $name): Category {
        $category = new Category();
        $category->setId($id);
        $category->setName($name);

        return $category;
    }

    public function testGetCategoriesReturnsRepositoryRows(): void {
        $this->repo->method('findAll')
            ->willReturn([$this->category(1, 'Music'), $this->category(2, 'Films')]);

        $categories = $this->service->getCategories();

        $this->assertCount(2, $categories);
        $this->assertSame('Music', $categories[0]->getName());
        $this->assertSame(2, $categories[1]->getId());
    }

    public function testCreateCategoryTrimsTheNameBeforeStoringIt(): void {
        $this->repo->method('findAll')->willReturn([]);
        $this->repo->expects($this->once())->method('create')
            ->with('Music')
            ->willReturn($this->category(1, 'Music'));

        $created = $this->service->createCategory('  Music  ');

        $this->assertSame('Music', $created->getName());
    }

    public function testCreateCategoryRejectsAnEmptyName(): void {
        $this->repo->method('findAll')->willReturn([]);
        $this->repo->expects($this->never())->method('create');

        $this->expectException(\InvalidArgumentException::class);
        $this->service->createCategory('   ');
    }

    public function testCreateCategoryRejectsANameAnotherCategoryAlreadyUses(): void {
        $this->repo->method('findAll')->willReturn([$this->category(1, 'Music')]);
        $this->repo->expects($this->never())->method('create');

        $this->expectException(\InvalidArgumentException::class);
        // Case is ignored: 'music' and 'Music' would render as two indistinguishable options.
        $this->service->createCategory('music');
    }

    public function testCreateCategoryRejectsANameLongerThanTheColumn(): void {
        $this->repo->method('findAll')->willReturn([]);
        $this->repo->expects($this->never())->method('create');

        $this->expectException(\InvalidArgumentException::class);
        $this->service->createCategory(str_repeat('x', CategoryService::MAX_NAME_LENGTH + 1));
    }

    public function testRenameKeepsTheExistingRowIdSoFoldersStayAttached(): void {
        $existing = $this->category(4, 'Films');
        $this->repo->method('find')->with(4)->willReturn($existing);
        $this->repo->method('findAll')->willReturn([$existing]);
        $this->repo->expects($this->once())->method('rename')
            ->with($this->callback(static function (Category $category): bool {
                return $category->getId() === 4 && $category->getName() === 'Movies';
            }));

        $renamed = $this->service->renameCategory(4, '  Movies  ');

        $this->assertSame(4, $renamed->getId());
        $this->assertSame('Movies', $renamed->getName());
    }

    public function testRenameRejectsAnUnknownId(): void {
        $this->repo->method('find')->willReturn(null);
        $this->repo->expects($this->never())->method('rename');

        $this->expectException(CategoryNotFoundException::class);
        $this->service->renameCategory(99, 'Music');
    }

    public function testRenameRejectsANameAnotherCategoryAlreadyUses(): void {
        $existing = $this->category(4, 'Films');
        $this->repo->method('find')->with(4)->willReturn($existing);
        $this->repo->method('findAll')->willReturn([$existing, $this->category(5, 'Music')]);
        $this->repo->expects($this->never())->method('rename');

        $this->expectException(\InvalidArgumentException::class);
        $this->service->renameCategory(4, 'music');
    }

    public function testRenameRejectsAnEmptyName(): void {
        $this->repo->method('find')->willReturn($this->category(4, 'Films'));
        $this->repo->expects($this->never())->method('rename');

        $this->expectException(\InvalidArgumentException::class);
        $this->service->renameCategory(4, '  ');
    }

    public function testDeleteRemovesTheRowAndUnbindsTheFoldersThatUsedIt(): void {
        $existing = $this->category(4, 'Films');
        $this->repo->method('find')->with(4)->willReturn($existing);
        $this->repo->expects($this->once())->method('remove')->with($existing);
        $this->settings->expects($this->once())->method('clearCategoryReferences')->with(4);

        $this->service->deleteCategory(4);
    }

    public function testDeleteRejectsAnUnknownId(): void {
        $this->repo->method('find')->willReturn(null);
        $this->settings->expects($this->never())->method('clearCategoryReferences');

        $this->expectException(CategoryNotFoundException::class);
        $this->service->deleteCategory(99);
    }
}
