<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/**
 * @template-extends QBMapper<VideoView>
 */
class VideoViewRepository extends QBMapper implements IVideoViewRepository {
    public function __construct(IDBConnection $db) {
        // Pass the entity class explicitly (see PlaylistRepository for why).
        parent::__construct($db, 'video_views', VideoView::class);
    }

    public function findByUser(string $userId): array {
        $qb = $this->db->getQueryBuilder();
        $qb->select('*')
            ->from('video_views')
            ->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)));

        return $this->findEntities($qb);
    }

    public function increment(string $userId, string $path): VideoView {
        $existing = $this->findOne($userId, $path);
        if ($existing === null) {
            $view = new VideoView();
            $view->setUserId($userId);
            $view->setPath($path);
            $view->setCount(1);

            return $this->insert($view);
        }

        $existing->setCount($existing->getCount() + 1);

        return $this->update($existing);
    }

    private function findOne(string $userId, string $path): ?VideoView {
        $qb = $this->db->getQueryBuilder();
        $qb->select('*')
            ->from('video_views')
            ->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)))
            ->andWhere($qb->expr()->eq('path', $qb->createNamedParameter($path, IQueryBuilder::PARAM_STR)));

        try {
            return $this->findEntity($qb);
        } catch (DoesNotExistException $e) {
            return null;
        }
    }
}
