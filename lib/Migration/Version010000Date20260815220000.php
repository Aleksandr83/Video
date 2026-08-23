<?php

declare(strict_types=1);

namespace OCA\Video\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Create the playlist tables.
 */
class Version010000Date20260815220000 extends SimpleMigrationStep {
    public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
        /** @var ISchemaWrapper $schema */
        $schema = $schemaClosure();

        if (!$schema->hasTable('video_playlists')) {
            $table = $schema->createTable('video_playlists');
            $table->addColumn('id', 'bigint', [
                'autoincrement' => true,
                'notnull' => true,
            ]);
            $table->addColumn('user_id', 'string', [
                'length' => 64,
                'notnull' => true,
            ]);
            $table->addColumn('name', 'string', [
                'length' => 255,
                'notnull' => true,
            ]);
            $table->addColumn('created_at', 'bigint', [
                'notnull' => true,
                'unsigned' => true,
            ]);
            $table->setPrimaryKey(['id']);
            $table->addIndex(['user_id'], 'video_playlists_user_idx');
        }

        if (!$schema->hasTable('video_playlist_items')) {
            $table = $schema->createTable('video_playlist_items');
            $table->addColumn('id', 'bigint', [
                'autoincrement' => true,
                'notnull' => true,
            ]);
            $table->addColumn('playlist_id', 'bigint', [
                'notnull' => true,
            ]);
            $table->addColumn('path', 'string', [
                'length' => 4000,
                'notnull' => true,
            ]);
            $table->addColumn('sort_order', 'bigint', [
                'notnull' => true,
            ]);
            $table->setPrimaryKey(['id']);
            $table->addIndex(['playlist_id'], 'video_pl_items_playlist_idx');
        }

        return $schema;
    }
}
