<?php

declare(strict_types=1);

namespace OCA\Video\AppInfo;

use OCA\Video\Db\IPlaylistItemRepository;
use OCA\Video\Db\IPlaylistRepository;
use OCA\Video\Db\PlaylistItemRepository;
use OCA\Video\Db\PlaylistRepository;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use OCP\IDBConnection;
use Psr\Container\ContainerInterface;

/**
 * Application entry point.
 *
 * APP_ID must match the <id> in appinfo/info.xml and the app folder name.
 *
 * The playlist service depends on repository interfaces; those bindings are
 * registered here (Bootstrap API) because Nextcloud cannot resolve interfaces
 * to concrete implementations automatically.
 */
class Application extends App implements IBootstrap {
    public const APP_ID = 'video';

    public function __construct(array $urlParams = []) {
        parent::__construct(self::APP_ID, $urlParams);
    }

    public function register(IRegistrationContext $context): void {
        $context->registerService(
            IPlaylistRepository::class,
            static function (ContainerInterface $c): PlaylistRepository {
                return new PlaylistRepository($c->get(IDBConnection::class));
            },
        );

        $context->registerService(
            IPlaylistItemRepository::class,
            static function (ContainerInterface $c): PlaylistItemRepository {
                return new PlaylistItemRepository($c->get(IDBConnection::class));
            },
        );
    }

    public function boot(IBootContext $context): void {
    }
}
