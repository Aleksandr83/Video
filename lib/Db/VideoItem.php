<?php

declare(strict_types=1);

namespace OCA\Video\Db;

use OCP\Files\Node;

/**
 * Value object describing one video file found in the storage.
 */
class VideoItem {
    public function __construct(
        private int $fileId,
        private string $path,
        private string $name,
        private int $size,
        private int $mtime,
    ) {
    }

    public static function fromNode(Node $node): self {
        return new self(
            $node->getId(),
            self::pathFromNode($node),
            $node->getName(),
            $node->getSize(),
            $node->getMTime(),
        );
    }

    /**
     * The WebDAV path of a node relative to the user's files root.
     *
     * Node::getPath() returns the full path including the user mount, e.g.
     * "/admin/files/Video/Clips/clip.mp4". We keep everything after "/files/",
     * yielding "Video/Clips/clip.mp4". This works even for external storage
     * mounts, whose getInternalPath() is relative to the mount root (and would
     * otherwise produce broken WebDAV URLs).
     */
    public static function pathFromNode(Node $node): string {
        $path = $node->getPath();
        $filesPos = strpos($path, '/files/');
        if ($filesPos !== false) {
            return '/' . substr($path, $filesPos + strlen('/files/'));
        }
        return '/' . ltrim($path, '/');
    }

    public function getFileId(): int {
        return $this->fileId;
    }

    public function getPath(): string {
        return $this->path;
    }

    public function getName(): string {
        return $this->name;
    }

    public function getSize(): int {
        return $this->size;
    }

    public function getMTime(): int {
        return $this->mtime;
    }

    /**
     * @return array{fileId: int, path: string, name: string, size: int, mtime: int}
     */
    public function toArray(): array {
        return [
            'fileId' => $this->fileId,
            'path' => $this->path,
            'name' => $this->name,
            'size' => $this->size,
            'mtime' => $this->mtime,
        ];
    }
}
