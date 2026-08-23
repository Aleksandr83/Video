<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\AppFramework\Db\QBMapper;
use OCP\DB\QueryBuilder\IQueryBuilder;
use OCP\IDBConnection;

/**
 * @template-extends QBMapper<PlaylistItem>
 */
class PlaylistItemRepository extends QBMapper implements IPlaylistItemRepository {
    public function __construct(IDBConnection $db) {
        // Pass the entity class explicitly (see PlaylistRepository).
        parent::__construct($db, 'video_playlist_items', PlaylistItem::class);
    }

    public function findByPlaylist(int $playlistId): array {
        $qb = $this->db->getQueryBuilder();
        $qb->select('*')
            ->from('video_playlist_items')
            ->where($qb->expr()->eq('playlist_id', $qb->createNamedParameter($playlistId, IQueryBuilder::PARAM_INT)))
            ->orderBy('sort_order', 'ASC');

        return $this->findEntities($qb);
    }

    public function add(int $playlistId, string $path, int $sortOrder): PlaylistItem {
        $item = new PlaylistItem();
        $item->setPlaylistId($playlistId);
        $item->setPath($path);
        $item->setSortOrder($sortOrder);

        return $this->insert($item);
    }

    public function remove(int $playlistId, int $itemId): bool {
        $qb = $this->db->getQueryBuilder();
        $qb->delete('video_playlist_items')
            ->where($qb->expr()->eq('id', $qb->createNamedParameter($itemId, IQueryBuilder::PARAM_INT)))
            ->andWhere($qb->expr()->eq('playlist_id', $qb->createNamedParameter($playlistId, IQueryBuilder::PARAM_INT)));

        return $qb->executeStatement() > 0;
    }

    public function setOrder(int $itemId, int $sortOrder): void {
        $qb = $this->db->getQueryBuilder();
        $qb->update('video_playlist_items')
            ->set('sort_order', $qb->createNamedParameter($sortOrder, IQueryBuilder::PARAM_INT))
            ->where($qb->expr()->eq('id', $qb->createNamedParameter($itemId, IQueryBuilder::PARAM_INT)));
        $qb->executeStatement();
    }

    public function deleteByPlaylist(int $playlistId): void {
        $qb = $this->db->getQueryBuilder();
        $qb->delete('video_playlist_items')
            ->where($qb->expr()->eq('playlist_id', $qb->createNamedParameter($playlistId, IQueryBuilder::PARAM_INT)));
        $qb->executeStatement();
    }
}
