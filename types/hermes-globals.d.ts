/**
 * Ambient globals for the src/core/ portability guard (tsconfig.core.json).
 *
 * The guard typechecks core/ with a DOM-free lib, which is the whole point:
 * core/ must run under Hermes, where no DOM exists. That lib also omits
 * `console`, which is NOT a DOM API — it is a host global that Hermes does
 * provide. Declaring it here closes that lib-declaration gap without pulling
 * `lib.dom` (or `@types/node`) back in, either of which would re-admit the
 * exact types the guard exists to catch.
 *
 * Deliberately minimal: only the logging methods, no `Console` interface, no
 * other globals. Anything else a core module reaches for should fail the guard
 * and be reviewed against Hermes rather than quietly declared here.
 *
 * This file is guard-only. tsconfig.json excludes it so it cannot collide with
 * lib.dom's own `console` declaration in the main build.
 */

declare var console: {
  log(...data: unknown[]): void;
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
  debug(...data: unknown[]): void;
};
