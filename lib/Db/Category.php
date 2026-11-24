<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\AppFramework\Db\Entity;

/**
 * A video category (Music, Films, …) stored in the app database.
 *
 * @method int getId()
 * @method void setId(int $id)
 * @method string getName()
 * @method void setName(string $name)
 */
class Category extends Entity {
    /** @var string */
    protected $name;

    public function __construct() {
        $this->addType('id', 'integer');
        $this->addType('name', 'string');
    }

    /**
     * @return array{id: ?int, name: string}
     */
    public function toArray(): array {
        return [
            'id' => $this->getId(),
            'name' => $this->getName(),
        ];
    }
}
