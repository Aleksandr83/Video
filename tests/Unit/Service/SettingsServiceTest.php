<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Service;

use OCA\Video\Db\FolderSetting;
use OCA\Video\Service\SettingsService;
use OCP\IConfig;
use PHPUnit\Framework\TestCase;

class SettingsServiceTest extends TestCase {
    private IConfig $config;
    private SettingsService $service;

    protected function setUp(): void {
        $this->config = $this->createMock(IConfig::class);
        $this->service = new SettingsService($this->config);
    }

    public function testGetFoldersReturnsEmptyWhenNothingStored(): void {
        $this->config->method('getAppValue')->willReturn('');

        $this->assertSame([], $this->service->getFolders());
    }

    public function testHasFoldersIsFalseWhenNothingStored(): void {
        $this->config->method('getAppValue')->willReturn('');

        $this->assertFalse($this->service->hasFolders());
    }

    public function testSetAndGetRoundTrip(): void {
        $stored = '';
        $this->config->method('setAppValue')
            ->willReturnCallback(function (string $app, string $key, string $value) use (&$stored): void {
                $stored = $value;
            });
        $this->config->method('getAppValue')->willReturnCallback(
            function () use (&$stored): string {
                return $stored;
            }
        );

        $this->service->setFolders([
            new FolderSetting('/Movies', true),
            new FolderSetting('/Videos/Clips', false),
        ]);

        $folders = $this->service->getFolders();
        $this->assertCount(2, $folders);
        $this->assertSame('/Movies', $folders[0]->getPath());
        $this->assertTrue($folders[0]->isRecursive());
        $this->assertSame('/Videos/Clips', $folders[1]->getPath());
        $this->assertFalse($folders[1]->isRecursive());
        $this->assertTrue($this->service->hasFolders());
    }

    public function testSetFoldersSkipsEmptyPaths(): void {
        $stored = '';
        $this->config->method('setAppValue')
            ->willReturnCallback(function (string $app, string $key, string $value) use (&$stored): void {
                $stored = $value;
            });
        $this->config->method('getAppValue')->willReturnCallback(
            function () use (&$stored): string {
                return $stored;
            }
        );

        $this->service->setFolders([
            new FolderSetting('   ', true),
            new FolderSetting('/Clips', false),
        ]);

        $folders = $this->service->getFolders();
        $this->assertCount(1, $folders);
        $this->assertSame('/Clips', $folders[0]->getPath());
    }

    public function testGetFoldersIgnoresCorruptJson(): void {
        $this->config->method('getAppValue')->willReturn('{not valid json');

        $this->assertSame([], $this->service->getFolders());
    }

    /**
     * A folder keeps only the id of the chosen category: the reference data (names)
     * lives in the database, so renaming a category must not touch this list.
     */
    public function testFolderKeepsItsCategoryId(): void {
        $stored = '';
        $this->config->method('setAppValue')
            ->willReturnCallback(function (string $app, string $key, string $value) use (&$stored): void {
                $stored = $value;
            });
        $this->config->method('getAppValue')->willReturnCallback(
            function () use (&$stored): string {
                return $stored;
            }
        );

        $this->service->setFolders([
            new FolderSetting('/Movies', true, 7),
            new FolderSetting('/Clips', false),
        ]);

        $folders = $this->service->getFolders();
        $this->assertSame(7, $folders[0]->getCategoryId());
        $this->assertSame(0, $folders[1]->getCategoryId(), 'a folder without a category must read as none');
        $this->assertSame(
            [['path' => '/Movies', 'recursive' => true, 'categoryId' => 7],
                ['path' => '/Clips', 'recursive' => false, 'categoryId' => 0]],
            json_decode($stored, true),
        );
    }

    public function testCategoryIdOfUnknownShapeFallsBackToNone(): void {
        $this->config->method('getAppValue')->willReturn(json_encode([
            ['path' => '/A', 'recursive' => false, 'categoryId' => 'not a number'],
            ['path' => '/B', 'recursive' => false, 'categoryId' => null],
            ['path' => '/C', 'recursive' => false, 'categoryId' => 12],
        ]));

        $folders = $this->service->getFolders();

        $this->assertSame(0, $folders[0]->getCategoryId());
        $this->assertSame(0, $folders[1]->getCategoryId());
        $this->assertSame(12, $folders[2]->getCategoryId());
    }

    /** Deleting a category must not leave folders pointing at a row that is gone. */
    public function testClearCategoryReferencesResetsOnlyThatCategory(): void {
        $stored = json_encode([
            ['path' => '/A', 'recursive' => true, 'categoryId' => 4],
            ['path' => '/B', 'recursive' => true, 'categoryId' => 5],
            ['path' => '/C', 'recursive' => false, 'categoryId' => 4],
        ]);
        $this->config->method('getAppValue')->willReturnCallback(
            function () use (&$stored): string {
                return $stored;
            }
        );
        $this->config->method('setAppValue')
            ->willReturnCallback(function (string $app, string $key, string $value) use (&$stored): void {
                $stored = $value;
            });

        $this->service->clearCategoryReferences(4);

        $folders = $this->service->getFolders();
        $this->assertSame(0, $folders[0]->getCategoryId());
        $this->assertSame(5, $folders[1]->getCategoryId());
        $this->assertSame(0, $folders[2]->getCategoryId());
    }

    /**
     * Which category a stored path belongs to: the nearest (longest) configured folder wins, and
     * that is what the Videos screen filter relies on. The rules below are the ones the listing
     * service depends on, so they are pinned here rather than in the listing tests.
     */
    public function testCategoryIdComesFromTheConfiguredFolderItself(): void {
        $this->config->method('getAppValue')->willReturn(json_encode([
            ['path' => '/Movies', 'recursive' => true, 'categoryId' => 3],
        ]));

        $this->assertSame(3, $this->service->categoryIdForPath('/Movies/clip.mp4'));
    }

    public function testCategoryIdUsesTheLongestMatchingFolder(): void {
        $this->config->method('getAppValue')->willReturn(json_encode([
            ['path' => '/Videos', 'recursive' => true, 'categoryId' => 1],
            ['path' => '/Videos/Concerts', 'recursive' => true, 'categoryId' => 2],
        ]));

        $this->assertSame(2, $this->service->categoryIdForPath('/Videos/Concerts/live.mp4'));
        $this->assertSame(1, $this->service->categoryIdForPath('/Videos/Clips/a.mp4'));
    }

    public function testCategoryIdInheritsThroughAnyDepthOfSubfolders(): void {
        $this->config->method('getAppValue')->willReturn(json_encode([
            ['path' => '/Concerts', 'recursive' => true, 'categoryId' => 2],
        ]));

        $this->assertSame(
            2,
            $this->service->categoryIdForPath('/Concerts/2019/Studio/Записи/live.mp4'),
        );
    }

    public function testCategoryIdDoesNotMatchAWordPrefixOfAFolder(): void {
        $this->config->method('getAppValue')->willReturn(json_encode([
            ['path' => '/Videos', 'recursive' => true, 'categoryId' => 1],
        ]));

        // '/Videosion' merely starts with the same letters; it is a different directory.
        $this->assertSame(0, $this->service->categoryIdForPath('/Videosion/a.mp4'));
    }

    public function testNearestFolderWithoutACategoryWinsOverACategoryAboveIt(): void {
        $this->config->method('getAppValue')->willReturn(json_encode([
            ['path' => '/Videos', 'recursive' => true, 'categoryId' => 1],
            ['path' => '/Videos/Archive', 'recursive' => true, 'categoryId' => 0],
        ]));

        $this->assertSame(0, $this->service->categoryIdForPath('/Videos/Archive/a.mp4'));
    }

    public function testCategoryIdIsZeroOutsideTheConfiguredFolders(): void {
        $this->config->method('getAppValue')->willReturn(json_encode([
            ['path' => '/Movies', 'recursive' => true, 'categoryId' => 3],
        ]));

        $this->assertSame(0, $this->service->categoryIdForPath('/Other/a.mp4'));
    }

    public function testCategoryIdIgnoresATrailingSlashInTheStoredFolder(): void {
        $this->config->method('getAppValue')->willReturn(json_encode([
            ['path' => '/Movies/', 'recursive' => true, 'categoryId' => 3],
        ]));

        $this->assertSame(3, $this->service->categoryIdForPath('/Movies/clip.mp4'));
        $this->assertSame(3, $this->service->categoryIdForPath('/Movies'));
    }

    public function testCategoryIdDoesNotDependOnTheOrderOrTheRecursiveFlag(): void {
        $this->config->method('getAppValue')->willReturn(json_encode([
            ['path' => '/Videos/Concerts', 'recursive' => false, 'categoryId' => 2],
            ['path' => '/Videos', 'recursive' => true, 'categoryId' => 1],
        ]));

        $this->assertSame(2, $this->service->categoryIdForPath('/Videos/Concerts/live.mp4'));
        // 'recursive' decides what the listing shows, not what a listed path belongs to.
        $this->assertSame(1, $this->service->categoryIdForPath('/Videos/a.mp4'));
    }

    public function testCategoryIdIsZeroWhenNothingIsConfigured(): void {
        $this->config->method('getAppValue')->willReturn('');

        $this->assertSame(0, $this->service->categoryIdForPath('/Movies/clip.mp4'));
    }
}
