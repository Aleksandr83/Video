<?php

declare(strict_types=1);

namespace OCA\Video\Service;

use OCA\Video\Db\Category;
use OCA\Video\Db\ICategoryRepository;

/**
 * Video categories are reference data shared by the whole instance: they live in one table, and a
 * search folder stores only the id of its category.
 *
 * Storing the id (not the name) is what makes renaming safe: an editor may rename a category and
 * every folder that uses it keeps pointing at the same row. Deleting a category therefore has to
 * unbind the folders instead of leaving them with a dangling reference — that is done here, because
 * this service is the only place where a category row disappears.
 */
class CategoryService {
    /** Column length of `video_categories.name`. */
    public const MAX_NAME_LENGTH = 255;

    public function __construct(
        private ICategoryRepository $categories,
        private SettingsService $settings,
    ) {
    }

    /**
     * @return Category[]
     */
    public function getCategories(): array {
        return $this->categories->findAll();
    }

    public function createCategory(string $name): Category {
        $name = $this->requireUsableName($name);
        $this->requireUniqueName($name, null);

        return $this->categories->create($name);
    }

    /**
     * Renames a category in place: the row keeps its id, so the folders referencing it are not touched.
     */
    public function renameCategory(int $id, string $name): Category {
        $name = $this->requireUsableName($name);

        $category = $this->categories->find($id);
        if ($category === null) {
            throw new CategoryNotFoundException("Category {$id} does not exist");
        }

        $this->requireUniqueName($name, $id);

        $category->setName($name);
        $this->categories->rename($category);

        return $category;
    }

    public function deleteCategory(int $id): void {
        $category = $this->categories->find($id);
        if ($category === null) {
            throw new CategoryNotFoundException("Category {$id} does not exist");
        }

        $this->categories->remove($category);
        $this->settings->clearCategoryReferences($id);
    }

    /**
     * Names are compared case-insensitively: on the Settings screen 'Music' and 'music' would render
     * as two options nobody can tell apart.
     */
    private function requireUniqueName(string $name, ?int $keepId): void {
        $wanted = mb_strtolower($name);

        foreach ($this->categories->findAll() as $category) {
            if ($keepId !== null && $category->getId() === $keepId) {
                continue;
            }
            if (mb_strtolower((string)$category->getName()) === $wanted) {
                throw new \InvalidArgumentException("Category name \"{$name}\" is already used");
            }
        }
    }

    private function requireUsableName(string $name): string {
        $name = trim($name);

        if ($name === '') {
            throw new \InvalidArgumentException('Category name is required');
        }

        if (mb_strlen($name) > self::MAX_NAME_LENGTH) {
            throw new \InvalidArgumentException(
                'Category name is too long (' . self::MAX_NAME_LENGTH . ' characters maximum)',
            );
        }

        return $name;
    }
}
