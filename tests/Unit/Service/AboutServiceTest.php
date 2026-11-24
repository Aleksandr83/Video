<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Service;

use OCA\Video\Db\IMigrationRepository;
use OCA\Video\Service\AboutService;
use OCA\Video\Service\ICoreVersionProvider;
use OCP\App\IAppManager;
use PHPUnit\Framework\TestCase;

/**
 * The About screen is the place a user goes to check what is installed: the version Nextcloud reports for
 * the app, the version of Nextcloud itself, and whether the migration files the app ships with have actually
 * run. The last one matters because an app upgrade is the only moment migrations execute, so a pending
 * migration means the schema of a feature is missing — exactly the case that had to be diagnosed by hand.
 *
 * The version numbers are never taken from the JavaScript bundle: they are read from Nextcloud, which is
 * the same source `occ app:list` reads.
 */
class AboutServiceTest extends TestCase {
    private IAppManager|\PHPUnit\Framework\MockObject\MockObject $appManager;
    private IMigrationRepository|\PHPUnit\Framework\MockObject\MockObject $migrations;
    private ICoreVersionProvider|\PHPUnit\Framework\MockObject\MockObject $coreVersion;
    private AboutService $service;

    /** What the instance reports as its app version: the version that matches the newest shipped migration. */
    private string $appVersion;
    private string $coreVersionString = '34.0.4.2';
    /** Migration versions the storage says have already run. */
    private array $appliedVersions = [];
    private ?string $askedAppId = null;

    protected function setUp(): void {
        $this->appliedVersions = self::appliedVersions();
        $this->appVersion = self::versionOfNewestMigration();

        $this->appManager = $this->createMock(IAppManager::class);
        $this->appManager->method('getAppVersion')
            ->willReturnCallback(function (string $appId): string {
                $this->askedAppId = $appId;

                return $this->appVersion;
            });

        $this->migrations = $this->createMock(IMigrationRepository::class);
        $this->migrations->method('findAppliedVersions')
            ->willReturnCallback(fn (string $appId): array => $this->appliedVersions);

        $this->coreVersion = $this->createMock(ICoreVersionProvider::class);
        $this->coreVersion->method('versionString')
            ->willReturnCallback(fn (): string => $this->coreVersionString);

        $this->service = new AboutService($this->appManager, $this->migrations, $this->coreVersion);
    }

    /**
     * @return list<string>
     */
    private static function migrationFiles(): array {
        $files = glob(dirname(__DIR__, 3) . '/lib/Migration/Version*Date*.php');
        $names = $files === false ? [] : array_map('basename', $files);
        sort($names);

        return $names;
    }

    /**
     * The version key the core records for a migration file: its class name without the leading "Version".
     *
     * @return list<string>
     */
    private static function appliedVersions(): array {
        return array_map(
            static fn (string $name): string => substr($name, \strlen('Version'), -\strlen('.php')),
            self::migrationFiles()
        );
    }

    /**
     * The app version an instance would report once the newest shipped migration has run: the numeric token of
     * that migration read back as major.minor.patch (010300 -> 1.3.0). Deriving it keeps this test from going
     * stale the next time a migration is added.
     */
    private static function versionOfNewestMigration(): string {
        $files = self::migrationFiles();
        $thisNewest = $files === [] ? '' : (string)end($files);
        $token = substr($thisNewest, \strlen('Version'), 6);

        if (\strlen($token) !== 6 || !ctype_digit($token)) {
            self::fail('The newest migration in lib/Migration must be named Version{6 digit token}Date…');
        }

        return sprintf('%d.%d.%d', (int)substr($token, 0, 2), (int)substr($token, 2, 2), (int)substr($token, 4, 2));
    }

    public function testAppVersionComesFromNextcloudAndNamesOurApp(): void {
        $summary = $this->service->summary();

        $this->assertSame($this->appVersion, $summary['appVersion']);
        $this->assertSame('video', $this->askedAppId, 'the version must be asked for our own app');
        $this->assertSame('video', $summary['appId']);
    }

    public function testNextcloudVersionComesFromTheCoreVersionProvider(): void {
        $summary = $this->service->summary();

        $this->assertSame('34.0.4.2', $summary['nextcloudVersion']);
    }

    public function testMigrationsAreTheFilesTheAppActuallyShips(): void {
        $summary = $this->service->summary();
        $expected = self::migrationFiles();

        $this->assertNotEmpty($expected, 'lib/Migration must contain the migrations of the app');
        $this->assertSame($expected, array_column($summary['migrations'], 'file'));
        $this->assertSame(self::appliedVersions(), array_column($summary['migrations'], 'version'));
    }

    public function testMigrationTokenIsTheNumericPrefixOfItsVersion(): void {
        foreach ($this->service->summary()['migrations'] as $migration) {
            $this->assertMatchesRegularExpression('/^\d{6}$/', $migration['token']);
            $this->assertStringStartsWith($migration['token'], $migration['version']);
        }
    }

    public function testMigrationIsMarkedAppliedWhenTheDatabaseRecordedIt(): void {
        foreach ($this->service->summary()['migrations'] as $migration) {
            $this->assertTrue($migration['applied'], $migration['version'] . ' should be reported as applied');
        }

        $this->assertSame([], $this->service->summary()['warnings']);
    }

    public function testMigrationIsMarkedNotAppliedWhenTheDatabaseMissedIt(): void {
        $pending = $this->appliedVersions[\count($this->appliedVersions) - 1];
        unset($this->appliedVersions[\count($this->appliedVersions) - 1]);
        $this->appliedVersions = array_values($this->appliedVersions);

        $summary = $this->service->summary();
        $byVersion = array_column($summary['migrations'], null, 'version');

        $this->assertArrayHasKey($pending, $byVersion);
        $this->assertFalse($byVersion[$pending]['applied']);

        $pendingRows = array_values(array_filter(
            $summary['migrations'],
            static fn (array $migration): bool => !$migration['applied']
        ));
        $this->assertCount(1, $pendingRows);
        $this->assertSame($pending, $pendingRows[0]['version']);
    }

    public function testPendingMigrationProducesAWarning(): void {
        array_pop($this->appliedVersions);

        $this->assertContains('migration_not_applied', $this->service->summary()['warnings']);
    }

    public function testNothingIsWarnedWhileEveryMigrationIsApplied(): void {
        $this->assertSame([], $this->service->summary()['warnings']);
    }

    public function testDeclaredVersionBelowNewestMigrationTokenIsWarnedAbout(): void {
        $this->appVersion = '1.1.0';

        $this->assertContains('version_below_migrations', $this->service->summary()['warnings']);
    }

    public function testDeclaredVersionMatchingTheNewestMigrationTokenIsNotWarnedAbout(): void {
        $this->appVersion = self::versionOfNewestMigration();

        $this->assertNotContains('version_below_migrations', $this->service->summary()['warnings']);
    }

    public function testAMissingMigrationsTableIsReportedAsPendingInsteadOfBreakingTheScreen(): void {
        $this->appliedVersions = [];

        $summary = $this->service->summary();

        $this->assertCount(\count(self::migrationFiles()), $summary['migrations']);
        $this->assertSame([], array_filter($summary['migrations'], static fn (array $m): bool => $m['applied']));
        $this->assertContains('migration_not_applied', $summary['warnings']);
    }

    public function testSummaryCarriesExactlyTheFieldsTheAboutScreenReads(): void {
        $this->assertSame(
            ['appId', 'appVersion', 'nextcloudVersion', 'migrations', 'warnings'],
            array_keys($this->service->summary())
        );
    }
}
