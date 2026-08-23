<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/**
 * @template-extends QBMapper<Playlist>
 */
class PlaylistRepository extends QBMapper implements IPlaylistRepository {
    public function __construct(IDBConnection $db) {
        // QBMapper derives the entity class from the mapper class name by
        // stripping the "Mapper" suffix (PlaylistMapper -> Playlist). Our
        // class is named PlaylistRepository, so pass the entity explicitly.
        parent::__construct($db, 'video_playlists', Playlist::class);
    }

    public function findById(int $id): ?Playlist {
        $qb = $this->db->getQueryBuilder();
        $qb->select('*')
            ->from('video_playlists')
            ->where($qb->expr()->eq('id', $qb->createNamedParameter($id, IQueryBuilder::PARAM_INT)));

        try {
            return $this->findEntity($qb);
        } catch (DoesNotExistException $e) {
            return null;
        }
    }

    public function findByUser(string $userId): array {
        $qb = $this->db->getQueryBuilder();
        $qb->select('*')
            ->from('video_playlists')
            ->where($qb->expr()->eq('user_id', $qb->createNamedParameter($userId)));

        return $this->findEntities($qb);
    }

    public function create(string $userId, string $name): Playlist {
        $playlist = new Playlist();
        $playlist->setUserId($userId);
        $playlist->setName($name);
        $playlist->setCreatedAt(time());

        return $this->insert($playlist);
    }

    public function rename(Playlist $playlist): void {
        $this->update($playlist);
    }

    public function deletePlaylist(Playlist $playlist): void {
        $this->delete($playlist);
    }
}
