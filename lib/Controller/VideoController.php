<?php

declare(strict_types=1);

namespace OCA\Video\Controller;

use OCA\Video\Db\VideoItem;
use OCA\Video\Service\SettingsService;
use OCA\Video\Service\VideoService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\DataResponse;
use OCP\Files\IRootFolder;
use OCP\IRequest;

/**
 * Video listing API for the current user.
 */
class VideoController extends Controller {
    public function __construct(
        string $appName,
        IRequest $request,
        private VideoService $videos,
        private SettingsService $settings,
        private IRootFolder $rootFolder,
        private ?string $userId,
    ) {
        parent::__construct($appName, $request);
    }

    /**
     * Return videos (and navigable subfolders) for the given folder.
     *
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function index(string $folder = ''): DataResponse {
        $userFolder = $this->rootFolder->getUserFolder($this->userId ?? '');

        return new DataResponse([
            'configured' => $this->settings->hasFolders(),
            'currentFolder' => $folder,
            'subfolders' => $this->videos->getSubfolders($userFolder, $folder),
            'videos' => array_map(
                static fn (VideoItem $video): array => $video->toArray(),
                $this->videos->getVideos($userFolder, $folder),
            ),
        ]);
    }
}
