<?php

declare(strict_types=1);

namespace OCA\Video\Db;

/**
 * Persistence contract for the category reference table. Implemented by the Nextcloud-backed
 * CategoryRepository; the service depends on this interface so it can be tested standalone
 * (same arrangement as IPlaylistRepository).
 */
interface ICategoryRepository {
    /**
     * All categories, in the order they were created.
     *
     * @return Category[]
     */
    public function findAll(): array;

    public function find(int $id): ?Category;

    public function create(string $name): Category;

    public function rename(Category $category): void;

    /**
     * Not named delete(): the mapper behind the implementation declares delete(Entity): Entity, and a child
     * method of the same name with a narrower signature is a compile-time error that stops the class from
     * loading. remove() follows PlaylistItemRepository, which took the same precaution.
     */
    public function remove(Category $category): void;
}
