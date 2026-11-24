<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/**
 * @template-extends QBMapper<Category>
 */
class CategoryRepository extends QBMapper implements ICategoryRepository {
    public function __construct(IDBConnection $db) {
        // QBMapper would derive the entity class from a "…Mapper" class name; this class is named
        // CategoryRepository, so the entity is passed explicitly (see PlaylistRepository).
        parent::__construct($db, 'video_categories', Category::class);
    }

    /**
     * Creation order, not alphabetical: the editor shows the list in the order the user built it.
     *
     * @return Category[]
     */
    public function findAll(): array {
        $qb = $this->db->getQueryBuilder();
        $qb->select('*')
            ->from('video_categories')
            ->orderBy('id', 'ASC');

        return $this->findEntities($qb);
    }

    public function find(int $id): ?Category {
        $qb = $this->db->getQueryBuilder();
        $qb->select('*')
            ->from('video_categories')
            ->where($qb->expr()->eq('id', $qb->createNamedParameter($id, IQueryBuilder::PARAM_INT)));

        try {
            return $this->findEntity($qb);
        } catch (DoesNotExistException $e) {
            return null;
        }
    }

    public function create(string $name): Category {
        $category = new Category();
        $category->setName($name);

        return $this->insert($category);
    }

    public function rename(Category $category): void {
        $this->update($category);
    }

    /**
     * remove(), not delete(): QBMapper already declares delete(Entity): Entity, and redeclaring that name
     * with a narrower signature is a compile-time error that keeps the whole class from loading — which is
     * how the categories endpoint failed on a live instance, for guests included. The inherited delete() is
     * the method that issues the row DELETE; deleteEntity() does not exist in the mapper.
     */
    public function remove(Category $category): void {
        $this->delete($category);
    }
}
