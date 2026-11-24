<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The version declared in appinfo/info.xml is what Nextcloud compares with the version stored in the
 * app config to decide whether an app upgrade has to run; that upgrade is the only moment when the
 * pending files of lib/Migration/ are executed. Adding a migration without raising the declared version
 * therefore leaves the new table or column missing forever: on a Nextcloud instance whose core version
 * is already current, `occ upgrade` reports "No upgrade required" and never reaches the app.
 *
 * Our migration names carry a token derived from the app version with major, minor and patch rendered
 * as two digits each (1.2.0 -> Version010200Date...). Nextcloud only sorts migration files by that
 * numeric token and never checks it against the declared version, so the check lives here instead.
 */
class AppVersionCoversMigrationsTest extends TestCase {
    public function testInfoXmlDeclaresSemanticVersion(): void {
        $this->assertMatchesRegularExpression(
            '/<version>\s*\d+\.\d+\.\d+\s*<\/version>/',
            $this->infoXml(),
            'appinfo/info.xml must declare a three-part version'
        );
    }

    public function testMigrationFileNamesFollowVersionAndDateTokens(): void {
        foreach ($this->migrationFileNames() as $name) {
            $this->assertMatchesRegularExpression(
                '/^Version\d{6}Date\d{14}\.php$/',
                $name,
                'Migration file names must be Version{app version token}Date{14 digit timestamp}.php'
            );
        }
    }

    public function testMigrationTokensAreUnique(): void {
        $tokens = array_map([$this, 'migrationToken'], $this->migrationFileNames());

        $this->assertNotEmpty($tokens, 'lib/Migration/ must contain at least one migration');
        $this->assertSameSize($tokens, array_unique($tokens), 'Two migration files share the same version token');
    }

    public function testTheDeclaredMigrationsAreTheOnesAnUpgradingInstanceWillActuallyWalkThrough(): void {
        // A migration whose token equals the version an instance already reports is never selected: the
        // updater only runs migrations above installed_version. Version010200Date20261122133000 was exactly
        // that case (installed_version 1.2.0 against a declared version 1.2.0), so the file is withdrawn and
        // the same schema arrives as 010300. Leaving it behind would keep a file that no instance can ever
        // apply, and the About screen would report it as not applied forever.
        $tokens = array_map([$this, 'migrationToken'], $this->migrationFileNames());
        sort($tokens);

        $this->assertSame(
            ['010000', '010100', '010300'],
            $tokens,
            'lib/Migration/ must hold the intended set: 010000, 010100 and 010300'
        );
    }

    #[DataProvider('pendingMigrations')]
    public function testMigrationTokenIsNotAboveDeclaredAppVersion(string $name, string $token): void {
        $this->assertLessThanOrEqual(
            $this->appVersionToken(),
            (int)$token,
            sprintf(
                'Migration %s carries token %s, which is above the token %s derived from the declared app version %s: '
                . 'the updater never runs it, so its schema change is missing on installed instances.',
                $name,
                $token,
                $this->appVersionToken(),
                $this->declaredVersion()
            )
        );
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function pendingMigrations(): array {
        $rows = [];
        foreach (self::migrationFileNamesAtRoot() as $name) {
            $rows[$name] = [$name, self::migrationTokenAt($name)];
        }

        return $rows;
    }

    /**
     * @return list<string>
     */
    private function migrationFileNames(): array {
        return self::migrationFileNamesAtRoot();
    }

    /**
     * @return list<string>
     */
    private static function migrationFileNamesAtRoot(): array {
        $files = glob(self::rootPath() . '/lib/Migration/Version*Date*.php');

        return $files === false ? [] : array_map('basename', $files);
    }

    private function migrationToken(string $name): string {
        return self::migrationTokenAt($name);
    }

    private static function migrationTokenAt(string $name): string {
        $matched = preg_match('/^Version(\d{6})Date/', $name, $groups);

        return $matched === 1 ? $groups[1] : $name;
    }

    private function declaredVersion(): string {
        $matched = preg_match('/<version>\s*([^<\s]+)\s*<\/version>/', $this->infoXml(), $groups);
        $this->assertSame(1, $matched, 'appinfo/info.xml must contain a <version> element');

        return $groups[1];
    }

    private function appVersionToken(): int {
        $parts = array_map('intval', explode('.', $this->declaredVersion()));

        return (int)sprintf('%02d%02d%02d', $parts[0] ?? 0, $parts[1] ?? 0, $parts[2] ?? 0);
    }

    private function infoXml(): string {
        $contents = file_get_contents(self::rootPath() . '/appinfo/info.xml');
        $this->assertIsString($contents, 'appinfo/info.xml must be readable from the tests');

        return $contents;
    }

    private static function rootPath(): string {
        return dirname(__DIR__, 2);
    }
}
