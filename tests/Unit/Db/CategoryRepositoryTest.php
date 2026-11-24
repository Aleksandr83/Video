<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Db;

use OCA\Video\Db\Category;
use OCA\Video\Db\CategoryRepository;
use OCA\Video\Db\ICategoryRepository;
use OCP\DB\IResult;
use OCP\DB\QueryBuilder\IExpressionBuilder;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * These tests load the real repository class and let the real OCP query mapper run against strict doubles.
 *
 * That matters because the category repository is the one place in the app where a method of ours shares a
 * name with a method of OCP\AppFramework\Db\QBMapper. The core declares delete(Entity): Entity, so a child
 * method called delete(Category): void does not compile: the class fails to load, and every request that
 * builds a controller depending on it dies before the handler runs. The app therefore names such methods
 * differently (PlaylistRepository::deletePlaylist, PlaylistItemRepository::remove) and only this class broke
 * the pattern.
 */
class CategoryRepositoryTest extends TestCase {
    private IDBConnection&MockObject $db;
    private IQueryBuilder&MockObject $qb;
    private IExpressionBuilder&MockObject $expressions;
    private IResult&MockObject $result;

    /** @var list<array{0: mixed, 1: mixed}> parameter values handed to the builder, with their types */
    private array $parameters = [];

    private CategoryRepository $repository;

    protected function setUp(): void {
        $this->db = $this->createMock(IDBConnection::class);
        $this->qb = $this->createMock(IQueryBuilder::class);
        $this->expressions = $this->createMock(IExpressionBuilder::class);
        $this->result = $this->createMock(IResult::class);

        $this->db->method('getQueryBuilder')->willReturn($this->qb);

        // Every clause of the builder hands back the builder itself, including the write statements.
        foreach (['select', 'from', 'where', 'orderBy', 'delete', 'insert', 'update', 'setValue', 'set'] as $clause) {
            $this->qb->method($clause)->willReturnSelf();
        }
        $this->qb->method('expr')->willReturn($this->expressions);
        $this->qb->method('getSQL')->willReturn('SELECT * FROM video_categories');
        $this->qb->method('executeQuery')->willReturn($this->result);
        $this->qb->method('executeStatement')->willReturn(1);
        $this->qb->method('getLastInsertId')->willReturn(12);

        // Recording the handed parameters keeps the test honest about which type each column is sent as.
        $this->parameters = [];
        $this->qb->method('createNamedParameter')->willReturnCallback(
            function ($value, $type = null) {
                $this->parameters[] = [$value, $type];
                return ':' . (is_scalar($value) ? (string)$value : 'param');
            },
        );

        $this->repository = new CategoryRepository($this->db);
    }

    public function testTheRepositoryExtendsTheMapperWithoutShadowingItsDelete(): void {
        // The app-facing method has to carry a different name than the mapper method it delegates to.
        $remove = new ReflectionMethod(CategoryRepository::class, 'remove');
        $this->assertSame(CategoryRepository::class, $remove->getDeclaringClass()->getName());
        $this->assertInstanceOf(ICategoryRepository::class, $this->repository);

        $delete = new ReflectionMethod(CategoryRepository::class, 'delete');
        $this->assertSame(
            'OCP\AppFramework\Db\QBMapper',
            $delete->getDeclaringClass()->getName(),
            'delete() must stay the mapper method, not a narrowed copy of it',
        );
    }

    public function testRemoveDeletesTheRowOfTheGivenCategoryById(): void {
        $category = new Category();
        $category->setId(7);
        $category->setName('Music');
        $category->resetUpdatedFields();

        $this->qb->expects($this->once())->method('delete')->with('video_categories');
        $this->qb->expects($this->once())->method('executeStatement');
        $this->result->expects($this->never())->method('fetch');

        $this->repository->remove($category);

        $this->assertSame([[7, IQueryBuilder::PARAM_INT]], $this->parameters);
    }

    public function testFindAllMapsRowsToCategoriesInCreationOrder(): void {
        $this->result->method('fetch')->willReturnOnConsecutiveCalls(
            ['id' => 1, 'name' => 'Music'],
            ['id' => 2, 'name' => 'Films'],
            false,
        );
        $this->result->expects($this->once())->method('closeCursor');

        $this->qb->expects($this->once())->method('select')->with('*');
        $this->qb->expects($this->once())->method('from')->with('video_categories');
        $this->qb->expects($this->once())->method('orderBy')->with('id', 'ASC');

        $categories = $this->repository->findAll();

        $this->assertCount(2, $categories);
        $this->assertSame([1, 2], array_map(static fn (Category $c): int => $c->getId(), $categories));
        $this->assertSame(['Music', 'Films'], array_map(static fn (Category $c): string => $c->getName(), $categories));
    }

    public function testFindReturnsNullWhenNoCategoryCarriesThatId(): void {
        $this->result->method('fetch')->willReturn(false);
        $this->result->expects($this->once())->method('closeCursor');

        $this->assertNull($this->repository->find(99));
    }

    public function testCreateInsertsTheNameAndTakesOverTheGeneratedId(): void {
        $this->qb->expects($this->once())->method('insert')->with('video_categories');
        $this->qb->expects($this->once())->method('setValue')->with('name', ':Music');
        $this->qb->expects($this->once())->method('executeStatement');

        $category = $this->repository->create('Music');

        $this->assertSame(12, $category->getId());
        $this->assertSame('Music', $category->getName());
        $this->assertSame([['Music', IQueryBuilder::PARAM_STR]], $this->parameters);
    }

    public function testRenameUpdatesOnlyTheChangedColumnsAndKeepsTheId(): void {
        $category = new Category();
        $category->setId(4);
        $category->setName('Music');
        $category->resetUpdatedFields();
        $category->setName('Jazz');

        $this->qb->expects($this->once())->method('update')->with('video_categories');
        $this->qb->expects($this->once())->method('set')->with('name', ':Jazz');
        $this->qb->expects($this->once())->method('executeStatement');

        $this->repository->rename($category);

        // The changed column first, then the identifier the mapper uses to address the row.
        $this->assertSame([['Jazz', IQueryBuilder::PARAM_STR], [4, IQueryBuilder::PARAM_INT]], $this->parameters);
    }
}
