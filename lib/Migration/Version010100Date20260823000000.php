<?php

declare(strict_types=1);

namespace OCA\Video\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Create the per-user video view counters table.
 */
class Version010100Date20260823000000 extends SimpleMigrationStep {
    public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
        /** @var ISchemaWrapper $schema */
        $schema = $schemaClosure();

        if (!$schema->hasTable('video_views')) {
            $table = $schema->createTable('video_views');
            $table->addColumn('id', 'bigint', [
                'autoincrement' => true,
                'notnull' => true,
            ]);
            $table->addColumn('user_id', 'string', [
                'length' => 64,
                'notnull' => true,
            ]);
            $table->addColumn('path', 'string', [
                'length' => 4000,
                'notnull' => true,
            ]);
            $table->addColumn('count', 'bigint', [
                'notnull' => true,
                'default' => 0,
            ]);
            $table->setPrimaryKey(['id']);
            $table->addUniqueIndex(['user_id', 'path'], 'video_views_user_path_idx');
        }

        return $schema;
    }
}
