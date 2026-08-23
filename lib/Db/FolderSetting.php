<?php

declare(strict_types=1);

namespace OCA\Video\Db;

/**
 * Value object describing one configured search folder.
 */
class FolderSetting {
    public function __construct(
        private string $path,
        private bool $recursive = false,
    ) {
    }

    public function getPath(): string {
        return $this->path;
    }

    public function isRecursive(): bool {
        return $this->recursive;
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self {
        return new self(
            trim((string)($data['path'] ?? '')),
            (bool)($data['recursive'] ?? false),
        );
    }

    /**
     * @return array{path: string, recursive: bool}
     */
    public function toArray(): array {
        return [
            'path' => $this->path,
            'recursive' => $this->recursive,
        ];
    }
}
