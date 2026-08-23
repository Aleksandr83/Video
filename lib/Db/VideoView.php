<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\AppFramework\Db\Entity;

/**
 * Number of times a user watched a video.
 *
 * @method int getId()
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method string getPath()
 * @method void setPath(string $path)
 * @method int getCount()
 * @method void setCount(int $count)
 */
class VideoView extends Entity {
    /** @var string */
    protected $userId;

    /** @var string */
    protected $path;

    /** @var int */
    protected $count;

    public function __construct() {
        $this->addType('id', 'integer');
        $this->addType('userId', 'string');
        $this->addType('path', 'string');
        $this->addType('count', 'integer');
    }

    public function toArray(): array {
        return [
            'id' => $this->getId(),
            'userId' => $this->getUserId(),
            'path' => $this->getPath(),
            'count' => $this->getCount(),
        ];
    }
}
