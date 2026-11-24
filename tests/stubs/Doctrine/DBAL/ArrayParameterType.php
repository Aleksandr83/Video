<?php

declare(strict_types=1);

namespace Doctrine\DBAL;

/**
 * Standalone-mode stand-in for the Doctrine enum the OCP query builder references for list parameters.
 *
 * Same reason as ParameterType: IQueryBuilder names ArrayParameterType::INTEGER and ::STRING in its constant
 * declarations, so the class has to be loadable even though the tests never talk to a database driver.
 */
class ArrayParameterType {
    public const INTEGER = 16;
    public const STRING = 17;
}
