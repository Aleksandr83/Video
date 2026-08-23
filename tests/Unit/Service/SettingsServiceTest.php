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
}
