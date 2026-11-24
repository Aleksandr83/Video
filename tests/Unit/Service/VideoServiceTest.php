<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Service;

use OCA\Video\Db\FolderSetting;
use OCA\Video\Service\SettingsService;
use OCA\Video\Service\VideoService;
use OCP\Files\File;
use OCP\Files\Folder;
use PHPUnit\Framework\TestCase;

class VideoServiceTest extends TestCase {
    private SettingsService $settings;
    private Folder $userFolder;
    private Folder $fallbackFolder;
    private VideoService $service;

    protected function setUp(): void {
        $this->settings = $this->createMock(SettingsService::class);
        $this->userFolder = $this->createMock(Folder::class);
        $this->userFolder->method('nodeExists')->willReturn(true);
        $this->fallbackFolder = $this->createMock(Folder::class);

        $this->service = new VideoService($this->settings);
    }

    private function mockFile(string $name, string $internalPath, int $size = 100, int $mtime = 1000, int $id = 1, ?string $fullPath = null): File {
        $file = $this->createMock(File::class);
        $file->method('getId')->willReturn($id);
        $file->method('getName')->willReturn($name);
        $file->method('getInternalPath')->willReturn($internalPath);
        $file->method('getPath')->willReturn($fullPath ?? ('/user/files/' . $this->filesRelative($internalPath)));
        $file->method('getSize')->willReturn($size);
        $file->method('getMTime')->willReturn($mtime);
        return $file;
    }

    private function mockFolder(string $internalPath, array $listing, ?string $fullPath = null): Folder {
        $folder = $this->createMock(Folder::class);
        $folder->method('getInternalPath')->willReturn($internalPath);
        $folder->method('getPath')->willReturn($fullPath ?? ('/user/files/' . $this->filesRelative($internalPath)));
        $folder->method('getDirectoryListing')->willReturn($listing);
        return $folder;
    }

    private function filesRelative(string $path): string {
        return str_starts_with($path, 'files/') ? substr($path, strlen('files/')) : ltrim($path, '/');
    }

    /**
     * @param array<string, Folder> $map path => folder mock
     */
    private function setUserFolderMap(array $map): void {
        $fallback = $this->fallbackFolder;
        $this->userFolder->method('get')->willReturnCallback(
            static fn (string $path): Folder => $map[$path] ?? $fallback,
        );
    }

    public function testEmptyWhenNoFoldersConfigured(): void {
        $this->settings->method('getFolders')->willReturn([]);

        $this->assertSame([], $this->service->getVideos($this->userFolder));
    }

    public function testNonRecursiveRootListsOnlyTopLevelVideos(): void {
        $movies = $this->mockFolder('/Movies', [
            $this->mockFile('clip.mp4', '/Movies/clip.mp4'),
            $this->mockFile('readme.txt', '/Movies/readme.txt'),
            $this->mockFolder('/Movies/Sub', [
                $this->mockFile('nested.webm', '/Movies/Sub/nested.webm'),
            ]),
        ]);
        $this->setUserFolderMap(['/Movies' => $movies]);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Movies', false)]);

        $videos = $this->service->getVideos($this->userFolder);

        $this->assertCount(1, $videos);
        $this->assertSame('clip.mp4', $videos[0]->getName());
    }

    public function testVideoPathStripsTheFilesStoragePrefix(): void {
        $movies = $this->mockFolder('/Movies', [
            $this->mockFile('clip.mp4', 'files/Movies/clip.mp4'),
        ]);
        $this->setUserFolderMap(['/Movies' => $movies]);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Movies', false)]);

        $videos = $this->service->getVideos($this->userFolder);

        $this->assertCount(1, $videos);
        $this->assertSame('/Movies/clip.mp4', $videos[0]->getPath());
    }

    public function testVideoPathUsesFullPathForMountedFolders(): void {
        // /Video is an external mount: the internal path is relative to the
        // mount root ("Clips/x.mp4"), but the full path includes the mount
        // (".../files/Video/Clips/x.mp4"). The WebDAV path must be relative to
        // the user's files root, so the "Video/" segment must be preserved.
        $clips = $this->mockFolder('/Video/Clips', [
            $this->mockFile('clip.mp4', 'Clips/clip.mp4', 100, 1000, 1, '/user/files/Video/Clips/clip.mp4'),
        ]);
        $this->setUserFolderMap(['/Video/Clips' => $clips]);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Video/Clips', false)]);

        $videos = $this->service->getVideos($this->userFolder);

        $this->assertCount(1, $videos);
        $this->assertSame('/Video/Clips/clip.mp4', $videos[0]->getPath());
    }

    public function testVideoItemCarriesTheFileId(): void {
        $movies = $this->mockFolder('/Movies', [
            $this->mockFile('clip.mp4', '/Movies/clip.mp4', 100, 1000, 42),
        ]);
        $this->setUserFolderMap(['/Movies' => $movies]);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Movies', false)]);

        $videos = $this->service->getVideos($this->userFolder);

        $this->assertSame(42, $videos[0]->getFileId());
    }

    public function testRecursiveRootIncludesNestedVideosSorted(): void {
        $sub = $this->mockFolder('/Movies/Sub', [
            $this->mockFile('nested.webm', '/Movies/Sub/nested.webm'),
        ]);
        $movies = $this->mockFolder('/Movies', [
            $this->mockFile('clip.mp4', '/Movies/clip.mp4'),
            $sub,
        ]);
        $this->setUserFolderMap(['/Movies' => $movies]);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Movies', true)]);

        $videos = $this->service->getVideos($this->userFolder);

        $this->assertCount(2, $videos);
        $this->assertSame(
            ['/Movies/clip.mp4', '/Movies/Sub/nested.webm'],
            array_map(static fn ($v) => $v->getPath(), $videos),
        );
    }

    public function testNavigateIntoRecursiveSubfolderReturnsItsVideosRecursively(): void {
        $sub = $this->mockFolder('/Movies/Sub', [
            $this->mockFile('a.mp4', '/Movies/Sub/a.mp4'),
            $this->mockFolder('/Movies/Sub/Deep', [
                $this->mockFile('b.webm', '/Movies/Sub/Deep/b.webm'),
            ]),
        ]);
        $this->setUserFolderMap([
            '/Movies' => $this->mockFolder('/Movies', []),
            '/Movies/Sub' => $sub,
        ]);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Movies', true)]);

        $videos = $this->service->getVideos($this->userFolder, '/Movies/Sub');

        $this->assertCount(2, $videos);
    }

    public function testNavigateOutsideConfiguredRootsReturnsEmpty(): void {
        $this->setUserFolderMap(['/Movies' => $this->mockFolder('/Movies', [])]);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Movies', true)]);

        $this->assertSame([], $this->service->getVideos($this->userFolder, '/Other'));
    }

    public function testMissingRootFolderIsSkipped(): void {
        $this->userFolder->method('nodeExists')->willReturn(false);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Gone', true)]);

        $this->assertSame([], $this->service->getVideos($this->userFolder));
    }

    public function testSubfoldersTopLevelReturnsConfiguredRoots(): void {
        $this->setUserFolderMap([
            '/Movies' => $this->mockFolder('/Movies', []),
            '/Clips' => $this->mockFolder('/Clips', []),
        ]);
        $this->settings->method('getFolders')->willReturn([
            new FolderSetting('/Movies', true),
            new FolderSetting('/Clips', false),
        ]);

        $this->assertSame(['/Clips', '/Movies'], $this->service->getSubfolders($this->userFolder));
    }

    public function testSubfoldersInsideNonRecursiveRootAreEmpty(): void {
        $this->setUserFolderMap(['/Clips' => $this->mockFolder('/Clips', [])]);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Clips', false)]);

        $this->assertSame([], $this->service->getSubfolders($this->userFolder, '/Clips/Sub'));
    }

    public function testSubfoldersInsideRecursiveRootReturnsChildren(): void {
        $sub = $this->mockFolder('/Movies/Sub', []);
        $movies = $this->mockFolder('/Movies', [$sub]);
        $this->setUserFolderMap([
            '/Movies' => $movies,
            '/Movies/Sub' => $sub,
        ]);
        $this->settings->method('getFolders')->willReturn([new FolderSetting('/Movies', true)]);

        $this->assertSame(['/Movies/Sub'], $this->service->getSubfolders($this->userFolder, '/Movies'));
    }

    /**
     * The listing carries the category of the nearest configured folder, so the Videos screen can
     * filter by category without knowing anything about how folders and categories are linked.
     * A real SettingsService (over a stubbed IConfig) is used here on purpose: the category rule is
     * owned by that service, and duplicating it in a mock would test the mock instead of the app.
     */
    private function serviceWithStoredFolders(array $entries): VideoService {
        $config = $this->createMock(\OCP\IConfig::class);
        $config->method('getAppValue')->willReturn(json_encode($entries, JSON_UNESCAPED_SLASHES));

        return new VideoService(new SettingsService($config));
    }

    public function testListedVideosCarryTheCategoryOfTheirConfiguredFolder(): void {
        $movies = $this->mockFolder('/Movies', [
            $this->mockFile('clip.mp4', '/Movies/clip.mp4'),
            $this->mockFolder('/Movies/Sub', [
                $this->mockFile('nested.webm', '/Movies/Sub/nested.webm'),
            ]),
        ]);
        $this->setUserFolderMap(['/Movies' => $movies]);

        $videos = $this->serviceWithStoredFolders([
            ['path' => '/Movies', 'recursive' => true, 'categoryId' => 3],
        ])->getVideos($this->userFolder);

        $this->assertSame([3, 3], array_map(static fn ($v) => $v->toArray()['categoryId'], $videos));
    }

    public function testNestedVideosTakeTheCategoryOfTheNearestConfiguredFolder(): void {
        $concerts = $this->mockFolder('/Videos/Concerts', [
            $this->mockFile('live.mp4', '/Videos/Concerts/live.mp4'),
        ]);
        $videos = $this->mockFolder('/Videos', [
            $this->mockFile('clip.mp4', '/Videos/clip.mp4'),
            $concerts,
        ]);
        $this->setUserFolderMap([
            '/Videos' => $videos,
            '/Videos/Concerts' => $concerts,
        ]);

        $listed = $this->serviceWithStoredFolders([
            ['path' => '/Videos', 'recursive' => true, 'categoryId' => 1],
            ['path' => '/Videos/Concerts', 'recursive' => true, 'categoryId' => 2],
        ])->getVideos($this->userFolder);

        $byPath = [];
        foreach ($listed as $item) {
            $byPath[$item->getPath()] = $item->toArray()['categoryId'];
        }

        $this->assertSame(['/Videos/clip.mp4' => 1, '/Videos/Concerts/live.mp4' => 2], $byPath);
    }

    public function testVideoOutsideAnyCategoryCarriesZero(): void {
        $this->setUserFolderMap(['/Movies' => $this->mockFolder('/Movies', [
            $this->mockFile('clip.mp4', '/Movies/clip.mp4'),
        ])]);

        $listed = $this->serviceWithStoredFolders([
            ['path' => '/Movies', 'recursive' => false, 'categoryId' => 0],
        ])->getVideos($this->userFolder);

        $this->assertSame([0], array_map(static fn ($v) => $v->toArray()['categoryId'], $listed));
    }
}
