<?php

declare(strict_types=1);

namespace OCA\Video\Controller;

use OCA\Video\Db\Category;
use OCA\Video\Service\CategoryNotFoundException;
use OCA\Video\Service\CategoryService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataResponse;
use OCP\IRequest;

/**
 * REST API for the video category reference data.
 *
 * Reading is open to every logged-in user (the list is what the folder rows and, later, the Videos
 * filter offer to pick from). Writing is restricted to admins: categories are instance-wide
 * reference data, edited on the same Settings screen as the search folders.
 */
class CategoryController extends Controller {
    public function __construct(
        string $appName,
        IRequest $request,
        private CategoryService $categories,
    ) {
        parent::__construct($appName, $request);
    }

    /**
     * @NoAdminRequired
     * @NoCSRFRequired
     */
    public function index(): DataResponse {
        return new DataResponse([
            'categories' => array_map(
                static fn (Category $category): array => $category->toArray(),
                $this->categories->getCategories(),
            ),
        ]);
    }

    /**
     * @AdminRequired
     */
    public function create(string $name = ''): DataResponse {
        try {
            $category = $this->categories->createCategory($name);

            return new DataResponse($category->toArray(), Http::STATUS_CREATED);
        } catch (\InvalidArgumentException $e) {
            return new DataResponse(['error' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
        }
    }

    /**
     * @AdminRequired
     */
    public function rename(int $id = 0, string $name = ''): DataResponse {
        try {
            $category = $this->categories->renameCategory($id, $name);

            return new DataResponse($category->toArray(), Http::STATUS_OK);
        } catch (CategoryNotFoundException $e) {
            return new DataResponse(['error' => $e->getMessage()], Http::STATUS_NOT_FOUND);
        } catch (\InvalidArgumentException $e) {
            return new DataResponse(['error' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
        }
    }

    /**
     * @AdminRequired
     */
    public function destroy(int $id = 0): DataResponse {
        try {
            $this->categories->deleteCategory($id);

            return new DataResponse(['status' => 'ok']);
        } catch (CategoryNotFoundException $e) {
            return new DataResponse(['error' => $e->getMessage()], Http::STATUS_NOT_FOUND);
        }
    }
}
