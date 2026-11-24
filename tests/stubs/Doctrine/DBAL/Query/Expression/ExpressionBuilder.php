<?php

declare(strict_types=1);

namespace Doctrine\DBAL\Query\Expression;

/**
 * Standalone-mode stand-in for the Doctrine expression builder the OCP interface copies constants from.
 *
 * IExpressionBuilder declares EQ/NEQ/LT/LTE/GT/GTE as copies of this class's constants, so the class has to be
 * loadable in the repo even though Doctrine is not a dependency here. The values are never compared in tests.
 */
class ExpressionBuilder {
    public const EQ = '= ';
    public const NEQ = '<> ';
    public const LT = '< ';
    public const LTE = '<= ';
    public const GT = '> ';
    public const GTE = '>= ';
}
