<?php

declare(strict_types=1);

namespace OCA\Video\AppInfo;

use OCA\Video\Db\ICategoryRepository;
use OCA\Video\Db\IMigrationRepository;
use OCA\Video\Db\IPlaylistItemRepository;
use OCA\Video\Db\IPlaylistRepository;
use OCA\Video\Db\IVideoViewRepository;
use OCA\Video\Db\CategoryRepository;
use OCA\Video\Db\MigrationRepository;
use OCA\Video\Db\PlaylistItemRepository;
use OCA\Video\Db\PlaylistRepository;
use OCA\Video\Db\VideoViewRepository;
use OCA\Video\Service\ICoreVersionProvider;
use OCA\Video\Service\CoreVersionProvider;
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

        $context->registerService(
            IVideoViewRepository::class,
            static function (ContainerInterface $c): VideoViewRepository {
                return new VideoViewRepository($c->get(IDBConnection::class));
            },
        );

        // Category names are instance-wide reference data; the search folder list stores only ids.
        $context->registerService(
            ICategoryRepository::class,
            static function (ContainerInterface $c): CategoryRepository {
                return new CategoryRepository($c->get(IDBConnection::class));
            },
        );

        // The About screen reports what the updater actually applied; that state lives in the core table.
        $context->registerService(
            IMigrationRepository::class,
            static function (ContainerInterface $c): MigrationRepository {
                return new MigrationRepository($c->get(IDBConnection::class));
            },
        );

        // The core version is published by the core as a consumable service; the app reaches it through one
        // small adapter so the About screen itself stays testable.
        $context->registerService(
            ICoreVersionProvider::class,
            static function (ContainerInterface $c): CoreVersionProvider {
                return new CoreVersionProvider();
            },
        );
    }

    public function boot(IBootContext $context): void {
    }
}
