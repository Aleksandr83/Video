<?php

declare(strict_types=1);

namespace OCA\Video\Service;

/**
 * Gives the version of the Nextcloud instance the app runs on.
 *
 * Kept behind an interface so the About screen can be tested without a running core, and so the single call
 * into the core service container lives in one place.
 */
interface ICoreVersionProvider {
    /**
     * @return string human readable core version ('34.0.4.2'), or an empty string when the core cannot say
     */
    public function versionString(): string;
}
