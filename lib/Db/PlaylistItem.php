<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\AppFramework\Db\Entity;

/**
 * A single video entry inside a playlist.
 *
 * @method int getId()
 * @method int getPlaylistId()
 * @method void setPlaylistId(int $playlistId)
 * @method string getPath()
 * @method void setPath(string $path)
 * @method int getSortOrder()
 * @method void setSortOrder(int $sortOrder)
 */
class PlaylistItem extends Entity {
    /** @var int */
    protected $playlistId;

    /** @var string */
    protected $path;

    /** @var int */
    protected $sortOrder;

    public function __construct() {
        $this->addType('id', 'integer');
        $this->addType('playlistId', 'integer');
        $this->addType('path', 'string');
        $this->addType('sortOrder', 'integer');
    }

    /**
     * @return array{id: ?int, playlistId: int, path: string, sortOrder: int}
     */
    public function toArray(): array {
        return [
            'id' => $this->getId(),
            'playlistId' => $this->getPlaylistId(),
            'path' => $this->getPath(),
            'sortOrder' => $this->getSortOrder(),
        ];
    }
}
