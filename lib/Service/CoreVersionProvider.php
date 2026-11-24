<?php

declare(strict_types=1);

namespace OCA\Video\Service;

use OCP\Server;
use OCP\ServerVersion;

/**
 * Reads the core version from the service the core publishes for it.
 *
 * OCP\Util::getVersion() is deprecated since 31 and returns the same service, so the service is asked
 * directly. If an unusual build does not have it, the About screen shows an empty value instead of a number
 * nobody can check.
 */
class CoreVersionProvider implements ICoreVersionProvider {
    public function versionString(): string {
        try {
            return Server::get(ServerVersion::class)->getVersionString();
        } catch (\Exception $e) {
            return '';
        }
    }
}
