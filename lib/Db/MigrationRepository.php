<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\DB\Exception;
use OCP\IDBConnection;

/**
 * Reads the versions Nextcloud recorded as executed for our app.
 *
 * The table is the core one the updater writes ('migrations', columns "app" and "version", primary key over
 * both); the query builder adds the table prefix, so the name is given unprefixed here — the same way the
 * core migration service reads it.
 */
class MigrationRepository implements IMigrationRepository {
    public function __construct(private IDBConnection $db) {
    }

    /**
     * A missing table means the instance never ran an app upgrade, which is itself an answer the About screen
     * has to show rather than an error to hide behind.
     *
     * @return list<string>
     */
    public function findAppliedVersions(string $appId): array {
        $qb = $this->db->getQueryBuilder();
        $qb->select('version')
            ->from('migrations')
            ->where($qb->expr()->eq('app', $qb->createNamedParameter($appId)))
            ->orderBy('version', 'ASC');

        try {
            $result = $qb->executeQuery();
        } catch (\Exception $e) {
            // Table not created yet, or another storage error: reported as "nothing applied".
            return [];
        }

        $versions = [];
        while (($row = $result->fetch()) !== false) {
            $versions[] = (string)$row['version'];
        }
        // OCP\DB\IResult publishes closeCursor(); there is no close() on a Nextcloud result handle, and calling
        // one is a fatal error the unit tests would not otherwise see.
        $result->closeCursor();

        return $versions;
    }
}
