<?php

declare(strict_types=1);

namespace OCA\Video\Service;

use OCA\Video\Db\IMigrationRepository;
use OCP\App\IAppManager;

/**
 * Collects what the About screen shows: the version Nextcloud reports for this app, the version of Nextcloud
 * itself, and the state of the migration files the app ships with.
 *
 * The version is asked from Nextcloud rather than written into the JavaScript bundle: the screen must agree
 * with what `occ app:list` says, otherwise it reports a number nobody can act on.
 */
class AboutService {
    public const APP_ID = 'video';

    /** Migration file names carry a token of six digits: major, minor and patch as two digits each. */
    private const VERSION_TOKEN_PATTERN = '/^Version(\d{6})Date(\d{14})/';

    public function __construct(
        private IAppManager $appManager,
        private IMigrationRepository $migrations,
        private ICoreVersionProvider $coreVersion,
    ) {
    }

    /**
     * @return array{appId: string, appVersion: string, nextcloudVersion: string, migrations: list<array{version: string, token: string, file: string, applied: bool}>, warnings: list<string>}
     */
    public function summary(): array {
        $declared = self::declaredMigrations();
        $appliedVersions = array_fill_keys($this->migrations->findAppliedVersions(self::APP_ID), true);

        $migrations = [];
        $pending = 0;
        foreach ($declared as $migration) {
            $applied = isset($appliedVersions[$migration['version']]);
            if (!$applied) {
                $pending += 1;
            }
            $migrations[] = [
                'version' => $migration['version'],
                'token' => $migration['token'],
                'file' => $migration['file'],
                'applied' => $applied,
            ];
        }

        $appVersion = $this->appManager->getAppVersion(self::APP_ID);
        $newestToken = $migrations === [] ? 0 : (int)$migrations[\count($migrations) - 1]['token'];

        $warnings = [];
        if ($pending > 0) {
            // A migration file that never ran means the schema of a feature is missing on this instance.
            $warnings[] = 'migration_not_applied';
        }
        if ($newestToken > self::versionToken($appVersion)) {
            // The updater only runs migrations that are not above the declared version, so such a migration
            // is not merely pending: it will stay pending until the declared version is raised.
            $warnings[] = 'version_below_migrations';
        }

        return [
            'appId' => self::APP_ID,
            'appVersion' => $appVersion,
            'nextcloudVersion' => $this->coreVersion->versionString(),
            'migrations' => $migrations,
            'warnings' => $warnings,
        ];
    }

    /**
     * The migrations this build of the app can run, read from the file names Nextcloud itself sorts by.
     *
     * @return list<array{version: string, token: string, file: string}>
     */
    public static function declaredMigrations(): array {
        $directory = \dirname(__DIR__, 2) . '/lib/Migration';
        $files = glob($directory . '/Version*Date*.php');
        $names = $files === false ? [] : array_map('basename', $files);
        sort($names);

        $declared = [];
        foreach ($names as $name) {
            if (!\preg_match(self::VERSION_TOKEN_PATTERN, $name, $groups)) {
                continue;
            }
            $declared[] = [
                // The core derives the version key from the class name by dropping the leading "Version".
                'version' => substr($name, \strlen('Version'), -\strlen('.php')),
                'token' => $groups[1],
                'file' => $name,
            ];
        }

        return $declared;
    }

    /**
     * Turns a declared app version into the migration token that belongs to it (1.3.0 -> 010300).
     */
    public static function versionToken(string $version): int {
        $parts = array_map('intval', explode('.', $version));

        return (int)sprintf('%02d%02d%02d', $parts[0] ?? 0, $parts[1] ?? 0, $parts[2] ?? 0);
    }
}
