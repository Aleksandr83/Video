<?php

declare(strict_types=1);

namespace OCA\Video\Controller;

use OCA\Video\Db\FolderSetting;
use OCA\Video\Service\SettingsService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\DataResponse;
use OCP\IRequest;

/**
 * Settings API.
 *
 * Reading is available to every logged-in user (the main view needs to know
 * whether folders are configured). Writing (update) is restricted to admins.
 */
class SettingsController extends Controller {
    public function __construct(
        string $appName,
        IRequest $request,
        private SettingsService $settings,
    ) {
        parent::__construct($appName, $request);
    }

    /**
     * Return the current search folder settings.
     *
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function index(): DataResponse {
        $folders = $this->settings->getFolders();

        return new DataResponse([
            'folders' => array_map(
                static fn (FolderSetting $folder): array => $folder->toArray(),
                $folders,
            ),
            'configured' => count($folders) > 0,
        ]);
    }

    /**
     * Replace the search folder settings.
     *
     * @AdminRequired
     *
     * @param list<array{path?: string, recursive?: bool}> $folders
     */
    public function update(array $folders = []): DataResponse {
        $settings = [];
        foreach ($folders as $folder) {
            if (is_array($folder)) {
                $settings[] = FolderSetting::fromArray($folder);
            }
        }

        $this->settings->setFolders($settings);

        return new DataResponse(['status' => 'ok']);
    }
}
