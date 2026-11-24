<?php

declare(strict_types=1);

namespace OCA\Video\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Create the category reference table.
 *
 * This file replaces Version010200Date20261122133000, which has been withdrawn. Its token equalled the version
 * every running instance already reported, and the updater only selects migrations above the stored version,
 * so no instance was ever able to run it; the declared app version moved to 1.3.0 together with this token.
 *
 * One row per category name. A search folder keeps only the id of its category, so a rename in this table
 * cannot orphan the folder settings. The unique index is the last line of defence: two rows spelling 'Music'
 * and 'music' would render as two options nobody can tell apart.
 */
class Version010300Date20261123114500 extends SimpleMigrationStep {
    public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
        /** @var ISchemaWrapper $schema */
        $schema = $schemaClosure();

        // An instance where the withdrawn file did run already owns this table, so the guard keeps the
        // migration safe to run beside it.
        if (!$schema->hasTable('video_categories')) {
            $table = $schema->createTable('video_categories');
            $table->addColumn('id', 'bigint', [
                'autoincrement' => true,
                'notnull' => true,
            ]);
            $table->addColumn('name', 'string', [
                'length' => 255,
                'notnull' => true,
            ]);
            $table->setPrimaryKey(['id']);
            $table->addUniqueIndex(['name'], 'video_categories_name_idx');
        }

        return $schema;
    }
}
