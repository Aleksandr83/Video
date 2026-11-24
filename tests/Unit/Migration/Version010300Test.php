<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Migration;

use Closure;
use OCA\Video\Migration\Version010300Date20261123114500;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;
use PHPUnit\Framework\TestCase;

/**
 * Records what a schema migration asks for, standing in for the schema object the core hands to a migration.
 * ISchemaWrapper::createTable() has no declared return type, so a plain double is enough to observe columns,
 * the primary key and the unique index without pulling a database engine into the unit test.
 */
final class RecordedTable {
    /** @var list<array{0: string, 1: string, 2: array<string, mixed>}> */
    public array $columns = [];

    /** @var list<string> */
    public array $primaryKey = [];

    /** @var list<array{0: list<string>, 1: string|null}> */
    public array $uniqueIndexes = [];

    public function addColumn(string $name, string $type, array $options = []): void {
        $this->columns[] = [$name, $type, $options];
    }

    /** @param list<string> $columns */
    public function setPrimaryKey(array $columns): void {
        $this->primaryKey = $columns;
    }

    /** @param list<string> $columns */
    public function addUniqueIndex(array $columns, ?string $name = null): void {
        $this->uniqueIndexes[] = [$columns, $name];
    }
}

/**
 * The categories table reached the app twice: once as Version010200Date20261122133000, which a running
 * instance could never pick up (its token equals the version that instance already reports, and the updater
 * only executes migrations above that version), and once as this file, whose token sits above it.
 *
 * This migration therefore has to be safe to run next to an instance where the earlier file did create the
 * table — that is what the hasTable() guard is for, and what the second test below pins down.
 */
class Version010300Test extends TestCase {
    private Version010300Date20261123114500 $migration;

    protected function setUp(): void {
        $this->migration = new Version010300Date20261123114500();
    }

    public function testItIsMigratedByTheCoreMigrationPipeline(): void {
        $this->assertInstanceOf(SimpleMigrationStep::class, $this->migration);
    }

    public function testCreatesTheCategoryTableWithAUniqueNameIndexWhenItIsAbsent(): void {
        $table = new RecordedTable();
        $schema = $this->createMock(ISchemaWrapper::class);
        $schema->method('hasTable')->with('video_categories')->willReturn(false);
        $schema->expects($this->once())->method('createTable')->with('video_categories')->willReturn($table);

        $result = $this->migration->changeSchema(
            $this->createMock(IOutput::class),
            Closure::fromCallable(static fn (): ISchemaWrapper => $schema),
            [],
        );

        $this->assertSame($schema, $result, 'A migration has to hand the schema back, or the change is dropped.');
        $this->assertSame([
            ['id', 'bigint', ['autoincrement' => true, 'notnull' => true]],
            ['name', 'string', ['length' => 255, 'notnull' => true]],
        ], $table->columns);
        $this->assertSame(['id'], $table->primaryKey);
        // Two spellings of the same category would render as two options nobody can tell apart.
        $this->assertSame([[['name'], 'video_categories_name_idx']], $table->uniqueIndexes);
    }

    public function testLeavesAnExistingCategoryTableAlone(): void {
        // Instances where the withdrawn 010200 file did run already own the table; rerunning the schema here
        // would fail on a duplicate table instead of upgrading the app.
        $schema = $this->createMock(ISchemaWrapper::class);
        $schema->method('hasTable')->with('video_categories')->willReturn(true);
        $schema->expects($this->never())->method('createTable');

        $result = $this->migration->changeSchema(
            $this->createMock(IOutput::class),
            Closure::fromCallable(static fn (): ISchemaWrapper => $schema),
            [],
        );

        $this->assertSame($schema, $result);
    }
}
