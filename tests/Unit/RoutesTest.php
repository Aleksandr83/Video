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

    /**
     * Categories are reference data in the database, edited through their own endpoints:
     * a list, a create, a rename (keeping the id, so folders stay attached) and a delete.
     */
    public function testRouteTableDefinesCategoryEndpoints(): void {
        $routes = require dirname(__DIR__, 2) . '/appinfo/routes.php';

        $this->assertContains([
            'name' => 'category#index',
            'url' => '/categories',
            'verb' => 'GET',
        ], $routes['routes']);

        $this->assertContains([
            'name' => 'category#create',
            'url' => '/categories',
            'verb' => 'POST',
        ], $routes['routes']);

        $this->assertContains([
            'name' => 'category#rename',
            'url' => '/categories/{id}',
            'verb' => 'PUT',
        ], $routes['routes']);

        $this->assertContains([
            'name' => 'category#destroy',
            'url' => '/categories/{id}',
            'verb' => 'DELETE',
        ], $routes['routes']);
    }

    /**
     * The About screen reads its numbers from the app itself, so the route has to exist for every logged-in
     * user: an instance whose admin is not the person looking at the screen still has to answer it.
     */
    public function testRouteTableDefinesAboutEndpoint(): void {
        $routes = require dirname(__DIR__, 2) . '/appinfo/routes.php';

        $this->assertContains([
            'name' => 'about#index',
            'url' => '/about',
            'verb' => 'GET',
        ], $routes['routes']);

        $aboutUrls = array_values(array_filter(
            $routes['routes'],
            static fn (array $route): bool => $route['url'] === '/about'
        ));
        $this->assertCount(1, $aboutUrls, 'the About route must be registered once');
    }
}
