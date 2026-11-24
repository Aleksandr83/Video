<?php

declare(strict_types=1);

namespace Doctrine\DBAL\Types;

/**
 * Standalone-mode stand-in for the Doctrine type registry the OCP query classes name in their constants.
 *
 * Only the constant names matter here: IQueryBuilder writes PARAM_BOOL = Types::BOOLEAN while the interface
 * is loaded, and QBMapper::getParameterTypeForProperty names the rest while it maps an entity column to a
 * parameter type. This repo installs nextcloud/ocp without Doctrine, and no test hands a type name to a
 * driver, so the values only have to be distinct strings.
 */
class Types {
    public const BIGINT = 'bigint';
    public const BLOB = 'blob';
    public const BOOLEAN = 'boolean';
    public const DATE_IMMUTABLE = 'date_immutable';
    public const DATE_MUTABLE = 'date';
    public const DATETIME_IMMUTABLE = 'datetime_immutable';
    public const DATETIME_MUTABLE = 'datetime';
    public const DATETIMETZ_IMMUTABLE = 'datetimetz_immutable';
    public const DATETIMETZ_MUTABLE = 'datetimetz';
    public const INTEGER = 'integer';
    public const JSON = 'json';
    public const SMALLINT = 'smallint';
    public const STRING = 'string';
    public const TIME_IMMUTABLE = 'time_immutable';
    public const TIME_MUTABLE = 'time';

    // Spellings the core mapper itself writes out, next to the Doctrine names that replaced them.
    public const DATE = 'date';
    public const DATETIME = 'datetime';
    public const DATETIME_TZ = 'datetimetz';
    public const DATETIME_TZ_IMMUTABLE = 'datetimetz_immutable';
    public const TIME = 'time';
}
