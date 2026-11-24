<?php

declare(strict_types=1);

namespace OCA\Video\Db;

/**
 * Reads which migration versions the instance has already executed for an app.
 *
 * Nextcloud keeps this in its own table: an entry is written the moment a migration class has run. There is
 * no public API for it, so the About screen reads the same table the updater writes to.
 */
interface IMigrationRepository {
    /**
     * @return list<string> version strings (as carried by the migration class names), oldest first
     */
    public function findAppliedVersions(string $appId): array;
}
