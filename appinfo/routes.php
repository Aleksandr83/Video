<?php

declare(strict_types=1);

/**
 * Route table for the Video app.
 *
 * Registered controllers use the OCA\Video\Controller namespace and are
 * addressed as <controller>#<method>, e.g. "page#index" -> PageController::index().
 */

return [
    'routes' => [
        ['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
        ['name' => 'settings#index', 'url' => '/settings', 'verb' => 'GET'],
        ['name' => 'settings#update', 'url' => '/settings', 'verb' => 'PUT'],

        ['name' => 'category#index', 'url' => '/categories', 'verb' => 'GET'],

        ['name' => 'category#create', 'url' => '/categories', 'verb' => 'POST'],

        ['name' => 'category#rename', 'url' => '/categories/{id}', 'verb' => 'PUT'],

        ['name' => 'category#destroy', 'url' => '/categories/{id}', 'verb' => 'DELETE'],

        ['name' => 'about#index', 'url' => '/about', 'verb' => 'GET'],
        ['name' => 'video#index', 'url' => '/videos', 'verb' => 'GET'],
        ['name' => 'view#increment', 'url' => '/views', 'verb' => 'POST'],
        ['name' => 'playlist#index', 'url' => '/playlists', 'verb' => 'GET'],
        ['name' => 'playlist#create', 'url' => '/playlists', 'verb' => 'POST'],
        ['name' => 'playlist#show', 'url' => '/playlists/{id}', 'verb' => 'GET'],
        ['name' => 'playlist#rename', 'url' => '/playlists/{id}', 'verb' => 'PUT'],
        ['name' => 'playlist#destroy', 'url' => '/playlists/{id}', 'verb' => 'DELETE'],
        ['name' => 'playlist#addItem', 'url' => '/playlists/{id}/items', 'verb' => 'POST'],
        ['name' => 'playlist#removeItem', 'url' => '/playlists/{id}/items/{itemId}', 'verb' => 'DELETE'],
        ['name' => 'playlist#reorder', 'url' => '/playlists/{id}/items', 'verb' => 'PUT'],
    ],
];
