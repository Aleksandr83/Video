<?php

declare(strict_types=1);

namespace Doctrine\DBAL;

/**
 * Standalone-mode stand-in for the Doctrine enum the OCP query builder references.
 *
 * The repo installs no Doctrine package (nextcloud/ocp ships interfaces only), yet OCP\DB\QueryBuilder\IQueryBuilder
 * declares constants such as PARAM_STR = ParameterType::STRING, which PHP evaluates when the interface is loaded.
 * The numbers below only have to exist for that load; no test hands one of them to a real driver.
 */
class ParameterType {
    public const NULL = 0;
    public const INTEGER = 1;
    public const STRING = 2;
    public const LARGE_OBJECT = 3;
}
