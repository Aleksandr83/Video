<?php

declare(strict_types=1);

/**
 * PHPUnit bootstrap.
 *
 * Operating modes:
 *  1. Inside a Nextcloud installation (…/apps/video): loads the real Nextcloud
 *     runtime (lib/base.php) so OCP classes are fully available.
 *  2. Standalone repo: only composer autoload is used (app classes + the
 *     nextcloud/ocp stubs). Tests that need the full runtime are skipped via
 *     the NEXTCLOUD_RUNTIME_AVAILABLE constant.
 */

$nextcloudBase = __DIR__ . '/../../../lib/base.php';
if (file_exists($nextcloudBase)) {
    require_once $nextcloudBase;
    define('NEXTCLOUD_RUNTIME_AVAILABLE', true);
} else {
    define('NEXTCLOUD_RUNTIME_AVAILABLE', false);

    // Standalone mode: the nextcloud/ocp package ships no autoload (it is meant
    // for static analysis). Register a PSR-4 loader that first looks in
    // tests/stubs/ (our minimal stubs, e.g. OCP Entity) and then in the ocp
    // stubs, so interfaces/classes can be loaded for unit tests.
    $testStubs = __DIR__ . '/stubs';
    $ocpStubs = __DIR__ . '/../vendor/nextcloud/ocp/OCP';
    spl_autoload_register(static function (string $class) use ($testStubs, $ocpStubs): void {
        $relative = str_replace('\\', '/', $class) . '.php';

        $stubPath = $testStubs . '/' . $relative;
        if (file_exists($stubPath)) {
            require_once $stubPath;
            return;
        }

        if (str_starts_with($class, 'OCP\\') && is_dir($ocpStubs)) {
            $path = $ocpStubs . '/' . str_replace('\\', '/', substr($class, 4)) . '.php';
            if (file_exists($path)) {
                require_once $path;
            }
        }
    });
}

require_once __DIR__ . '/../vendor/autoload.php';
