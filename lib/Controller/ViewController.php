<?php

declare(strict_types=1);

namespace OCA\Video\Controller;

use OCA\Video\Service\ViewService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\IRequest;

/**
 * Per-user video view counters API.
 */
class ViewController extends Controller {
    public function __construct(
        string $appName,
        IRequest $request,
        private ViewService $views,
        private ?string $userId,
    ) {
        parent::__construct($appName, $request);
    }

    /**
     * Increment the view counter for the current user and video path.
     *
     * @NoAdminRequired
     */
    public function increment(string $path = ''): DataResponse {
        try {
            $this->views->incrementView($this->userId ?? '', $path);

            return new DataResponse(['status' => 'ok']);
        } catch (\InvalidArgumentException $e) {
            return new DataResponse(['error' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
        }
    }
}
