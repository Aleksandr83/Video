<?php

declare(strict_types=1);

namespace OCA\Video\Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * Pure-PHP test that verifies the route table. Runs standalone without the
 * Nextcloud runtime, which keeps the test infrastructure verifiable anywhere.
 */
class RoutesTest extends TestCase {
    public function testRouteTableDefinesPageIndex(): void {
        $routes = require dirname(__DIR__, 2) . '/appinfo/routes.php';

        $this->assertIsArray($routes);
        $this->assertArrayHasKey('routes', $routes);

        $this->assertContains([
            'name' => 'page#index',
            'url' => '/',
            'verb' => 'GET',
        ], $routes['routes']);

        $this->assertContains([
            'name' => 'settings#index',
            'url' => '/settings',
            'verb' => 'GET',
        ], $routes['routes']);

        $this->assertContains([
            'name' => 'settings#update',
            'url' => '/settings',
            'verb' => 'PUT',
        ], $routes['routes']);

        $this->assertContains([
            'name' => 'video#index',
            'url' => '/videos',
            'verb' => 'GET',
        ], $routes['routes']);

        $this->assertContains([
            'name' => 'playlist#index',
            'url' => '/playlists',
            'verb' => 'GET',
        ], $routes['routes']);

        $this->assertContains([
            'name' => 'playlist#addItem',
            'url' => '/playlists/{id}/items',
            'verb' => 'POST',
        ], $routes['routes']);
    }
}
