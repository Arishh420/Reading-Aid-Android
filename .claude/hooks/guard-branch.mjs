/**
 * PreToolUse guard: refuse to edit a file while the repo that would commit it
 * is on `main` or `dev`, or has a detached HEAD.
 *
 * Registered in .claude/settings.json against the file-editing tools. CLAUDE.md
 * §1 states the rule; AD45 records the reasoning; AF56 holds the measurements.
 *
 * WHY THE TARGET FILE DECIDES THE REPO, NOT `cwd`. An edit should be judged by
 * the repository that would end up committing it. The payload's `cwd` follows
 * Claude and can point somewhere else entirely, and CLAUDE_PROJECT_DIR is the
 * session's project root rather than the file's. So this resolves the nearest
 * EXISTING ancestor directory of the file being written -- existing, because a
 * Write can create nested directories that are not there yet -- and asks git
 * about that. `cwd` and CLAUDE_PROJECT_DIR are fallbacks for a payload that
 * names no path at all.
 *
 * A PATH OUTSIDE ANY WORK TREE IS ALLOWED, AND THAT IS LOAD-BEARING. The
 * session scratchpad lives under /private/tmp, which is not a git repository.
 * Keying off the project root instead would block every scratchpad write while
 * on `dev` -- a false positive on the most common temporary-file operation
 * there is, and the fastest way to make a guard something people route around.
 *
 * DETACHED HEAD IS DENIED, using `git symbolic-ref --quiet --short HEAD`
 * rather than `git rev-parse --abbrev-ref HEAD`. The latter prints the literal
 * string "HEAD" when detached, which is indistinguishable from a branch
 * actually named HEAD; symbolic-ref exits non-zero instead, which is an
 * unambiguous signal. An edit made on a detached HEAD is almost always an
 * accident and is easy to lose.
 *
 * WHAT THIS DOES NOT COVER, stated plainly rather than implied away. It sees
 * the file-editing tools only. A write performed through Bash -- `sed -i`, a
 * heredoc redirect, `cp` -- is invisible to it, and no attempt is made to
 * parse shell redirections, because `>`, `tee`, `dd` and friends are unbounded
 * and blocking `>` would break scratchpad writes. The layering is what closes
 * it: guard-git.mjs denies `add`/`commit`/`push` outright, so a Bash-mediated
 * edit cannot reach a commit from Claude Code at all, and .githooks/pre-commit
 * refuses the commit afterwards whatever wrote the file. See AD45.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { allow, deny, readPayload } from './hook-io.mjs';

/** Branches no work may be done on directly. CLAUDE.md §1. */
export const PROTECTED_BRANCHES = ['main', 'dev'];

/** Run a git command, returning trimmed stdout or null if it failed. */
function git(dir, args) {
  const res = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  if (res.error || res.status !== 0) return null;
  return String(res.stdout).trim();
}

/**
 * Walk up from `target` to the nearest directory that exists, so a Write to a
 * not-yet-created nested path still resolves to a real repository.
 */
export function nearestExistingDir(target) {
  let dir = path.resolve(target);
  if (existsSync(dir) && statSync(dir).isDirectory()) return dir;
  dir = path.dirname(dir);
  for (let i = 0; i < 64; i += 1) {
    if (existsSync(dir) && statSync(dir).isDirectory()) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/**
 * Decide on a single edit target.
 *
 * Returns `{ deny: false }` or `{ deny: true, reason, branch }`.
 */
export function classifyPath(target) {
  const dir = target ? nearestExistingDir(target) : null;
  if (dir === null) return { deny: false };

  const inWorkTree = git(dir, ['rev-parse', '--is-inside-work-tree']);
  if (inWorkTree !== 'true') return { deny: false };

  const branch = git(dir, ['symbolic-ref', '--quiet', '--short', 'HEAD']);

  if (branch === null) {
    return {
      deny: true,
      branch: null,
      reason:
        'BLOCKED: HEAD is detached in ' +
        `${dir}, so this edit belongs to no branch and is easy to lose. ` +
        'Check out a work branch first: ' +
        'git checkout dev && git pull && git checkout -b <type>/<name> ' +
        '(CLAUDE.md §1).',
    };
  }

  if (PROTECTED_BRANCHES.includes(branch)) {
    return {
      deny: true,
      branch,
      reason:
        `BLOCKED: the branch is \`${branch}\`, and nobody works directly on ` +
        '`main` or `dev` (CLAUDE.md §1). ' +
        `The file is ${target}. ` +
        'Cut a work branch from dev first: ' +
        'git checkout dev && git pull && git checkout -b <type>/<name> — ' +
        'feature/, fix/, docs/ or chore/. A hotfix, and only a hotfix, is cut ' +
        'from main instead.',
    };
  }

  return { deny: false };
}

/** Pull the edit target out of a PreToolUse payload, or null if it names none. */
export function targetFromPayload(payload) {
  const input = payload && typeof payload.tool_input === 'object' && payload.tool_input !== null
    ? payload.tool_input
    : {};
  const candidates = [input.file_path, input.notebook_path, input.path];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate !== '') return candidate;
  }
  if (typeof payload?.cwd === 'string' && payload.cwd !== '') return payload.cwd;
  if (typeof process.env.CLAUDE_PROJECT_DIR === 'string' && process.env.CLAUDE_PROJECT_DIR !== '') {
    return process.env.CLAUDE_PROJECT_DIR;
  }
  return null;
}

async function main() {
  const payload = await readPayload();
  if (payload === null) {
    process.stderr.write('guard-branch: unreadable hook payload; allowing (see hook-io.mjs).\n');
    allow();
    return;
  }
  const verdict = classifyPath(targetFromPayload(payload));
  if (verdict.deny) deny(verdict.reason);
  allow();
}

// Only run when executed as the hook. Importing this module -- which the suite
// does, to exercise classifyPath without spawning a process per case -- must
// not consume stdin or exit.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
