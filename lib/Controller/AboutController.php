<?php

declare(strict_types=1);

namespace OCA\Video\Controller;

use OCA\Video\Service\AboutService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\DataResponse;
use OCP\IRequest;

/**
 * About API: the versions of the app and of Nextcloud, and the state of the app migrations.
 *
 * Reading is open to every logged-in user — the person looking at the screen is often the one reporting a
 * problem, not the admin who fixes it.
 */
class AboutController extends Controller {
    public function __construct(
        string $appName,
        IRequest $request,
        private AboutService $about,
    ) {
        parent::__construct($appName, $request);
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function index(): DataResponse {
        return new DataResponse($this->about->summary());
    }
}
