<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\AppFramework\Db\Entity;

/**
 * A playlist owned by a Nextcloud user.
 *
 * @method int getId()
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method string getName()
 * @method void setName(string $name)
 * @method int getCreatedAt()
 * @method void setCreatedAt(int $createdAt)
 */
class Playlist extends Entity {
    /** @var string */
    protected $userId;

    /** @var string */
    protected $name;

    /** @var int */
    protected $createdAt;

    public function __construct() {
        $this->addType('id', 'integer');
        $this->addType('userId', 'string');
        $this->addType('name', 'string');
        $this->addType('createdAt', 'integer');
    }

    /**
     * @return array{id: ?int, name: string, createdAt: int}
     */
    public function toArray(): array {
        return [
            'id' => $this->getId(),
            'name' => $this->getName(),
            'createdAt' => $this->getCreatedAt(),
        ];
    }
}
