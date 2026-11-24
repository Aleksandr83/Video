<?php

declare(strict_types=1);

namespace OCA\Video\Db;

/**
 * Value object describing one configured search folder.
 *
 * `categoryId` is 0 when the folder has no category: the category names themselves live in the
 * `video_categories` table, and only the id travels with the folder so that renaming a category
 * cannot orphan the folders that use it.
 */
class FolderSetting {
    public function __construct(
        private string $path,
        private bool $recursive = false,
        private int $categoryId = 0,
    ) {
    }

    public function getPath(): string {
        return $this->path;
    }

    public function isRecursive(): bool {
        return $this->recursive;
    }

    public function getCategoryId(): int {
        return $this->categoryId;
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self {
        $categoryId = $data['categoryId'] ?? 0;

        return new self(
            trim((string)($data['path'] ?? '')),
            (bool)($data['recursive'] ?? false),
            // Only a real number is accepted: a stray string or null must read as "no category".
            is_int($categoryId) ? $categoryId : (ctype_digit((string)$categoryId) ? (int)$categoryId : 0),
        );
    }

    /**
     * @return array{path: string, recursive: bool, categoryId: int}
     */
    public function toArray(): array {
        return [
            'path' => $this->path,
            'recursive' => $this->recursive,
            'categoryId' => $this->categoryId,
        ];
    }
}
