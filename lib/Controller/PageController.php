<?php

declare(strict_types=1);

namespace OCA\Video\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\Util;

/**
 * Serves the single-page app shell.
 */
class PageController extends Controller {
    public function __construct(string $appName, IRequest $request) {
        parent::__construct($appName, $request);
    }

    /**
     * Render the app page.
     *
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function index(): TemplateResponse {
        // Util::addScript/addStyle add the CSP nonce automatically, which is
        // required by Nextcloud's 'strict-dynamic' script-src policy. Manual
        // <script>/<link> tags without a nonce are blocked (blank page).
        Util::addScript('video', 'video-main');
        Util::addStyle('video', 'video-main');

        return new TemplateResponse('video', 'main', []);
    }
}
