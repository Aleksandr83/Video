<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Db;

use OCA\Video\Db\MigrationRepository;
use OCP\DB\IResult;
use OCP\DB\QueryBuilder\IExpressionBuilder;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * The applied-migration list is read straight from the core table, so the only contract that matters
 * here is the one the core actually publishes: OCP\DB\IResult offers closeCursor(), not close(). The
 * doubles below are strict mocks of those interfaces, which is what keeps this test honest about the
 * API surface instead of about whatever the repository happens to call.
 */
class MigrationRepositoryTest extends TestCase {
    private IDBConnection&MockObject $db;
    private IQueryBuilder&MockObject $qb;
    private IExpressionBuilder&MockObject $expressions;
    private IResult&MockObject $result;
    private MigrationRepository $repository;

    protected function setUp(): void {
        $this->db = $this->createMock(IDBConnection::class);
        $this->qb = $this->createMock(IQueryBuilder::class);
        $this->expressions = $this->createMock(IExpressionBuilder::class);
        $this->result = $this->createMock(IResult::class);

        $this->db->method('getQueryBuilder')->willReturn($this->qb);
        // The builder is fluent: every clause returns the builder itself.
        $this->qb->method('select')->willReturnSelf();
        $this->qb->method('from')->willReturnSelf();
        $this->qb->method('where')->willReturnSelf();
        $this->qb->method('orderBy')->willReturnSelf();
        $this->qb->method('createNamedParameter')->willReturnSelf();
        // expr() hands out the expression builder, whose helpers return plain predicate strings.
        $this->qb->method('expr')->willReturn($this->expressions);
        $this->qb->method('executeQuery')->willReturn($this->result);

        $this->repository = new MigrationRepository($this->db);
    }

    public function testReturnsTheVersionsRecordedForOurApp(): void {
        $this->result->method('fetch')->willReturnOnConsecutiveCalls(
            ['version' => '010000Date20260815220000'],
            ['version' => '010100Date20260823000000'],
            false,
        );
        $this->result->expects($this->once())->method('closeCursor');

        $this->assertSame(
            ['010000Date20260815220000', '010100Date20260823000000'],
            $this->repository->findAppliedVersions('video'),
        );
    }

    public function testReturnsAnEmptyListWhenNothingIsRecordedYet(): void {
        $this->result->method('fetch')->willReturn(false);
        $this->result->expects($this->once())->method('closeCursor');

        $this->assertSame([], $this->repository->findAppliedVersions('video'));
    }

    public function testReadsTheCoreMigrationsTableOrderedByVersion(): void {
        $this->result->method('fetch')->willReturn(false);

        $this->qb->expects($this->once())->method('select')->with('version');
        $this->qb->expects($this->once())->method('from')->with('migrations');
        $this->qb->expects($this->once())->method('orderBy')->with('version', 'ASC');
        $this->qb->expects($this->once())->method('createNamedParameter')->with('video');

        $this->repository->findAppliedVersions('video');
    }

    public function testReportsNothingAppliedWhenTheStorageRefusesTheQuery(): void {
        // A table the instance never created has to show up on the About screen as "not applied", not as a
        // broken screen, so the storage error must be absorbed here.
        $this->qb->method('executeQuery')->willThrowException(new RuntimeException('no such table'));

        $this->assertSame([], $this->repository->findAppliedVersions('video'));
    }
}
