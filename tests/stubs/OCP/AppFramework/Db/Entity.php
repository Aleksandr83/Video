<?php

declare(strict_types=1);

namespace OCP\AppFramework\Db;

/**
 * Minimal stub of the Nextcloud Entity base class.
 *
 * Used ONLY in standalone unit tests where the real Nextcloud runtime is not
 * available. PHPUnit mocks override the public methods, so a simplified
 * implementation is sufficient here. Inside a real Nextcloud installation the
 * actual Entity class is loaded instead.
 *
 * @psalm-suppress PropertyNotSetInConstructor
 */
class Entity {
    /** @var array<string, mixed> */
    protected array $_properties = [];

    /** @var array<string, bool> */
    protected array $_updatedFields = [];

    public function __call(string $methodName, array $args): mixed {
        if (str_starts_with($methodName, 'get')) {
            $field = lcfirst(substr($methodName, 3));
            return $this->getter($field);
        }
        if (str_starts_with($methodName, 'set')) {
            $field = lcfirst(substr($methodName, 3));
            $this->setter($field, $args[0] ?? null);
            return $this;
        }
        throw new \BadMethodCallException($methodName);
    }

    public function getter(string $name): mixed {
        return $this->_properties[$name] ?? null;
    }

    public function setter(string $name, mixed $value): void {
        $this->_properties[$name] = $value;
        $this->_updatedFields[$name] = true;
    }

    public function getId(): ?int {
        return isset($this->_properties['id']) ? (int)$this->_properties['id'] : null;
    }

    public function setId(int $id): void {
        $this->setter('id', $id);
    }

    public function addType(string $name, string $type): void {
        // No-op in the standalone stub; the real Entity keeps a type map.
    }

    public function getUpdatedFields(): array {
        return array_keys($this->_updatedFields);
    }

    public function resetUpdatedFields(): void {
        $this->_updatedFields = [];
    }

    public function markFieldUpdated(string $name): void {
        $this->_updatedFields[$name] = true;
    }
}
