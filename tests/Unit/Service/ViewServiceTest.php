<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit\Service;

use OCA\Video\Db\IVideoViewRepository;
use OCA\Video\Db\VideoView;
use OCA\Video\Service\ViewService;
use PHPUnit\Framework\TestCase;

class ViewServiceTest extends TestCase {
    public function testGetViewCountsBuildsPathMap(): void {
        $repo = $this->createMock(IVideoViewRepository::class);
        $a = new VideoView();
        $a->setPath('/Movies/a.mp4');
        $a->setCount(3);
        $b = new VideoView();
        $b->setPath('/Movies/b.mp4');
        $b->setCount(7);
        $repo->method('findByUser')->willReturn([$a, $b]);

        $service = new ViewService($repo);

        $this->assertSame(['/Movies/a.mp4' => 3, '/Movies/b.mp4' => 7], $service->getViewCounts('alice'));
    }

    public function testGetViewCountsReturnsEmptyForNoViews(): void {
        $repo = $this->createMock(IVideoViewRepository::class);
        $repo->method('findByUser')->willReturn([]);

        $service = new ViewService($repo);

        $this->assertSame([], $service->getViewCounts('alice'));
    }

    public function testIncrementViewDelegatesToRepository(): void {
        $repo = $this->createMock(IVideoViewRepository::class);
        $repo->expects($this->once())->method('increment')->with('alice', '/Movies/a.mp4');

        $service = new ViewService($repo);
        $service->incrementView('alice', '/Movies/a.mp4');
    }

    public function testIncrementViewRejectsEmptyPath(): void {
        $repo = $this->createMock(IVideoViewRepository::class);
        $repo->expects($this->never())->method('increment');

        $service = new ViewService($repo);
        $this->expectException(\InvalidArgumentException::class);
        $service->incrementView('alice', '   ');
    }
}
