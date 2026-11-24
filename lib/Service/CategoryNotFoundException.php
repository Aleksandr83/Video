<?php

declare(strict_types=1);

namespace OCA\Video\Service;

/**
 * Thrown when a category id matches nothing in the reference table.
 */
class CategoryNotFoundException extends \Exception {
}
