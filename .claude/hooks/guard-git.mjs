/**
 * PreToolUse guard: refuse git and gh WRITE operations from Claude Code.
 *
 * Registered in .claude/settings.json against Bash. CLAUDE.md §1 states the
 * rule -- every git-write operation is run by the operator in the terminal,
 * with `gh issue create` the one deliberate exception. AD45 records the
 * reasoning; AF56 holds the measurements.
 *
 * ALLOWLIST, NOT DENYLIST, FOR BOTH TOOLS. A denylist fails OPEN on everything
 * nobody thought of -- `git update-ref`, `git fast-import`, `git replace`,
 * `git filter-branch`, and whatever git ships next -- and each of those writes
 * refs. An allowlist fails CLOSED: an unrecognised subcommand is denied with a
 * message saying so, and the cost of a false denial is that the operator runs
 * the command themselves, which is what they were going to do anyway. gh's
 * surface is far larger than git's, so the argument is stronger there still.
 *
 * SEGMENTATION IS DELIBERATELY OVER-BROAD. The command string is split on
 * `&&`, `||`, `;`, `|`, `&`, newlines, and subshell punctuation, outside
 * quotes. Over-broad splitting can only ever produce MORE candidate commands
 * to inspect, never fewer, which is the safe direction for a detector -- the
 * same reasoning AF51 records for the over-broad secret sweep whose hits were
 * all read.
 *
 * HEREDOC BODIES ARE DATA AND ARE SKIPPED ENTIRELY. `gh issue create --body
 * "$(cat <<'EOF' ... EOF)"` routinely contains prose like "git push" or
 * "gh pr merge" inside the issue text. Treating those lines as commands would
 * block the one gh write this repo deliberately permits, precisely when the
 * issue being filed is about git workflow. `<<<` is a here-string, not a
 * heredoc, and is not treated as one.
 *
 * WHAT IT DOES NOT COVER, stated rather than implied away. Only the FIRST word
 * of each segment is inspected, so `sh -c "git commit"` and `xargs -I{} git
 * commit` pass. `--no-verify` is not something this guard can see. These are
 * guardrails against accident, NOT a security boundary (AD45); .githooks/ is
 * the backstop, and it does not depend on this process running.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { allow, deny, readPayload } from './hook-io.mjs';

/** Leading words that introduce another command and can be stepped over. */
const WRAPPERS = new Set([
  'command', 'env', 'sudo', 'doas', 'nohup', 'time', 'nice', 'stdbuf', 'xargs', 'builtin', 'exec',
]);

/** git global options that consume the following token as their value. */
const GIT_GLOBAL_VALUE_OPTS = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env',
  '--super-prefix', '--attr-source',
]);

/** git subcommands that only ever read. Allowed with no further inspection. */
const GIT_READ_ONLY = new Set([
  'status', 'log', 'show', 'diff', 'blame', 'rev-parse', 'rev-list', 'describe', 'cat-file',
  'ls-files', 'ls-tree', 'ls-remote', 'show-ref', 'for-each-ref', 'shortlog', 'grep',
  'check-ignore', 'check-attr', 'check-ref-format', 'merge-base', 'name-rev', 'var', 'version',
  'help', 'count-objects', 'verify-commit', 'verify-tag', 'diff-tree', 'diff-index', 'diff-files',
  'fsck', 'whatchanged', 'cherry', 'range-diff',
]);

/** Listing options of `branch`/`tag` that consume the following token. */
const REF_LIST_VALUE_OPTS = new Set([
  '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--format', '--sort',
  '--color', '--column',
]);

const BRANCH_WRITE_FLAGS = new Set([
  '-d', '-D', '--delete', '-m', '-M', '--move', '-c', '-C', '--copy', '-f', '--force',
  '-u', '--set-upstream', '--set-upstream-to', '--unset-upstream', '--edit-description',
]);

const TAG_WRITE_FLAGS = new Set([
  '-a', '--annotate', '-s', '--sign', '-u', '--local-user', '-d', '--delete', '-f', '--force',
  '-m', '--message', '-F', '--file', '--create-reflog',
]);

const CHECKOUT_WRITE_FLAGS = new Set([
  '-b', '-B', '--orphan', '--detach', '-t', '--track', '--no-track', '-f', '--force',
  '-m', '--merge', '--guess',
]);

const GIT_CONFIG_READ_OPTS = new Set([
  '--get', '--get-all', '--get-regexp', '--get-urlmatch', '--get-color', '--get-colorbool',
  '--list', '-l',
]);

/** gh command -> the subcommands that only read. `release` is empty on purpose. */
const GH_ALLOWED = new Map([
  // `create` is the one deliberate write: issues are filed through Claude Code
  // by design (CLAUDE.md §1).
  ['issue', new Set(['create', 'view', 'list', 'status'])],
  ['pr', new Set(['view', 'list', 'diff', 'checks', 'status'])],
  ['run', new Set(['list', 'view', 'watch'])],
  ['repo', new Set(['view', 'list'])],
  ['workflow', new Set(['list', 'view'])],
  ['secret', new Set(['list'])],
  ['variable', new Set(['list'])],
  ['auth', new Set(['status'])],
  ['label', new Set(['list'])],
  ['cache', new Set(['list'])],
  // `release` is deliberately absent: AD45 blocks `gh release *` outright,
  // including `view` and `list`, because a release is this project's UAT
  // distribution channel (AD39) and a read is cheap to run in the terminal.
]);

/** gh api flags that make gh default to POST even with no --method. */
const GH_API_BODY_FLAGS = new Set(['-f', '-F', '--field', '--raw-field', '--input']);

const HEREDOC_RE = /^<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2(?=\s|\)|"|'|$)/;

/**
 * Remove heredoc bodies, which are data rather than commands. Amendment A.
 * Returns the command with every body and its terminator line dropped.
 */
export function stripHeredocs(command) {
  const lines = String(command).split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    out.push(line);
    i += 1;
    for (const d of heredocDelimitersOn(line)) {
      // Only strip when a terminator actually exists. Without this, a false
      // heredoc detection (`echo "a << b"`) would swallow the rest of the
      // command, including a real `git push` -- a false ALLOW, which is the
      // unsafe direction. Finding no terminator means the lines were never a
      // heredoc body, so they are left in place to be classified normally.
      let end = -1;
      for (let j = i; j < lines.length; j += 1) {
        const body = d.strip ? lines[j].replace(/^\t+/, '') : lines[j];
        if (body.trim() === d.word) {
          end = j;
          break;
        }
      }
      if (end === -1) break;
      i = end + 1;
    }
  }
  return out.join('\n');
}

/**
 * Every heredoc delimiter declared on one line, in order.
 *
 * SINGLE-QUOTE AWARENESS ONLY, on purpose. Nothing is expanded inside single
 * quotes, so a `<<` there is certainly data. Double quotes are ignored because
 * the case this exists for -- `--body "$(cat <<'EOF'` -- puts the operator
 * inside a double-quoted span where a command substitution has reopened an
 * unquoted context, and modelling that precisely needs a real shell parser.
 * The terminator-must-exist rule above bounds what a false detection can cost.
 *
 * `<<<` is a here-string, not a heredoc, and is excluded.
 */
function heredocDelimitersOn(line) {
  const found = [];
  let inSingle = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (inSingle) continue;
    if (ch === '<' && line[i + 1] === '<' && line[i + 2] !== '<') {
      const m = HEREDOC_RE.exec(line.slice(i));
      if (m !== null) {
        found.push({ strip: m[1] === '-', word: m[3] });
        i += m[0].length - 1;
      }
    }
  }
  return found;
}

/**
 * Split a command string into simple commands, each an array of words with
 * quotes removed and redirections dropped. Quote-aware.
 */
export function splitSegments(command) {
  const src = stripHeredocs(command).replace(/\\\n/g, ' ');
  const segments = [];
  let words = [];
  let word = '';
  let hasWord = false;
  let quote = null;
  const subshellQuotes = [];

  const endWord = () => {
    if (hasWord) words.push(word);
    word = '';
    hasWord = false;
  };
  const endSegment = () => {
    endWord();
    if (words.length > 0) segments.push(words);
    words = [];
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];

    if (quote !== null) {
      if (ch === quote) {
        quote = null;
      } else if (quote === '"' && ch === '$' && src[i + 1] === '(') {
        // A command substitution runs even inside double quotes, so `"$(git
        // push)"` really does execute git. Reopen an unquoted context here or
        // the whole substitution is mistaken for literal text -- a false
        // ALLOW. Single quotes expand nothing, so this applies to `"` only.
        subshellQuotes.push(quote);
        quote = null;
        endSegment();
        i += 1;
      } else {
        word += ch;
        hasWord = true;
      }
      continue;
    }

    if (ch === '\\') {
      const next = src[i + 1];
      if (next !== undefined) {
        word += next;
        hasWord = true;
        i += 1;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      hasWord = true;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      endWord();
      continue;
    }
    // `$(` opens a command substitution; `$` elsewhere is an ordinary character.
    if (ch === '$' && src[i + 1] === '(') {
      subshellQuotes.push(null);
      endSegment();
      i += 1;
      continue;
    }
    if (ch === ')' && subshellQuotes.length > 0) {
      endSegment();
      quote = subshellQuotes.pop();
      continue;
    }
    if (ch === '&' || ch === '|' || ch === ';' || ch === '\n' || ch === '(' || ch === ')'
        || ch === '{' || ch === '}' || ch === '`') {
      endSegment();
      continue;
    }
    word += ch;
    hasWord = true;
  }
  endSegment();

  return segments.map(dropRedirections);
}

/** Drop `>`, `>>`, `<`, `2>` and friends, plus the target they consume. */
function dropRedirections(words) {
  const out = [];
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    const m = /^(\d*)(>>|>|<)(&?)(.*)$/.exec(w);
    if (m !== null) {
      if (m[4] === '') i += 1;
      continue;
    }
    out.push(w);
  }
  return out;
}

/** Strip leading env assignments and wrapper commands; return the rest. */
function stripPrefixes(words) {
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) {
      i += 1;
      continue;
    }
    if (WRAPPERS.has(path.basename(w))) {
      i += 1;
      continue;
    }
    break;
  }
  return words.slice(i);
}

/** Split git args into positional operands and the flags that were present. */
function partitionGitArgs(args, valueOpts) {
  const positionals = [];
  const flags = new Set();
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--') {
      flags.add('--');
      continue;
    }
    if (a.startsWith('-') && a !== '-') {
      const eq = a.indexOf('=');
      flags.add(eq === -1 ? a : a.slice(0, eq));
      if (eq === -1 && valueOpts.has(a)) i += 1;
      continue;
    }
    positionals.push(a);
  }
  return { positionals, flags };
}

const RUN_IT_YOURSELF =
  'Claude Code does not perform git or GitHub writes in this repo (CLAUDE.md §1) — run it yourself in the terminal.';

function denyGit(sub, why) {
  return { deny: true, reason: `BLOCKED: \`git ${sub}\` — ${why} ${RUN_IT_YOURSELF}` };
}

function classifyGit(args) {
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (!a.startsWith('-')) break;
    if (a.includes('=')) {
      i += 1;
      continue;
    }
    if (GIT_GLOBAL_VALUE_OPTS.has(a)) i += 2;
    else i += 1;
  }
  const sub = args[i];
  const rest = args.slice(i + 1);
  if (sub === undefined) return { deny: false };

  if (GIT_READ_ONLY.has(sub)) return { deny: false };

  if (sub === 'symbolic-ref') {
    const { positionals } = partitionGitArgs(rest, new Set());
    return positionals.length >= 2
      ? denyGit(sub, 'writing a symbolic ref changes where HEAD points.')
      : { deny: false };
  }

  if (sub === 'fetch') {
    const { positionals } = partitionGitArgs(rest, new Set(['--depth', '--jobs', '-j', '--recurse-submodules']));
    // positionals[0] is the remote; anything after it is a refspec, and a
    // refspec is the one way fetch writes a local ref.
    if (positionals.slice(1).some((p) => p.includes(':'))) {
      return denyGit('fetch', 'a refspec argument writes a local ref.');
    }
    return { deny: false };
  }

  if (sub === 'branch' || sub === 'tag') {
    const writeFlags = sub === 'branch' ? BRANCH_WRITE_FLAGS : TAG_WRITE_FLAGS;
    const { positionals, flags } = partitionGitArgs(rest, REF_LIST_VALUE_OPTS);
    for (const f of flags) {
      if (writeFlags.has(f)) {
        return denyGit(sub, `\`${f}\` creates, moves or deletes a ref.`);
      }
    }
    const listing = flags.has('-l') || flags.has('--list');
    if (positionals.length > 0 && !listing) {
      return denyGit(sub, `the operand \`${positionals[0]}\` creates a ref (listing needs --list).`);
    }
    return { deny: false };
  }

  if (sub === 'checkout') {
    const { flags } = partitionGitArgs(rest, new Set());
    for (const f of flags) {
      if (CHECKOUT_WRITE_FLAGS.has(f)) {
        return denyGit('checkout', `\`${f}\` creates a branch or moves HEAD.`);
      }
    }
    if (!flags.has('--')) {
      return denyGit('checkout', 'switching branches is a git write; only the `git checkout -- <path>` revert form is allowed.');
    }
    return { deny: false };
  }

  if (sub === 'restore') {
    const { flags } = partitionGitArgs(rest, new Set(['-s', '--source']));
    if (flags.has('--staged') || flags.has('-S')) {
      return denyGit('restore', '`--staged` writes the index.');
    }
    return { deny: false };
  }

  if (sub === 'stash') {
    const { positionals } = partitionGitArgs(rest, new Set());
    if (positionals[0] === 'list' || positionals[0] === 'show') return { deny: false };
    return denyGit('stash', 'it reverts the working tree and saves index state — the silent loss of in-progress edits AF37 records. Only `list` and `show` are reads.');
  }

  if (sub === 'config') {
    const { flags } = partitionGitArgs(rest, new Set());
    for (const f of flags) if (GIT_CONFIG_READ_OPTS.has(f)) return { deny: false };
    return denyGit('config', 'this form writes configuration; only the --get/--list read forms are allowed.');
  }

  if (sub === 'remote' || sub === 'reflog' || sub === 'worktree' || sub === 'submodule' || sub === 'notes') {
    const allowedFirst = {
      remote: new Set(['', 'show', 'get-url']),
      reflog: new Set(['', 'show']),
      worktree: new Set(['list']),
      submodule: new Set(['status', 'summary']),
      notes: new Set(['list', 'show']),
    }[sub];
    const { positionals } = partitionGitArgs(rest, new Set());
    const first = positionals[0] ?? '';
    if (allowedFirst.has(first)) return { deny: false };
    return denyGit(`${sub} ${first}`, 'only the read forms of this subcommand are allowed.');
  }

  if (sub === 'bisect') return denyGit('bisect', 'it writes bisect state and moves HEAD.');

  return denyGit(sub, 'it is not on the read-only allowlist. The allowlist fails closed on purpose: an unknown subcommand may write refs.');
}

function classifyGh(args) {
  const positionals = [];
  const flags = [];
  for (const a of args) {
    if (a.startsWith('-')) flags.push(a);
    else positionals.push(a);
  }
  const cmd = positionals[0];
  const sub = positionals[1];

  if (cmd === undefined) return { deny: false };
  if (cmd === 'version' || cmd === 'help') return { deny: false };

  if (cmd === 'api') {
    const idx = args.findIndex((a) => a === '-X' || a === '--method');
    const attached = args.find((a) => a.startsWith('--method='));
    const method = idx !== -1 ? args[idx + 1] : attached ? attached.slice('--method='.length) : 'GET';
    if (String(method).toUpperCase() !== 'GET') {
      return { deny: true, reason: `BLOCKED: \`gh api\` with method ${method} is a write. ${RUN_IT_YOURSELF}` };
    }
    for (const f of flags) {
      const name = f.includes('=') ? f.slice(0, f.indexOf('=')) : f;
      if (GH_API_BODY_FLAGS.has(name)) {
        return { deny: true, reason: `BLOCKED: \`gh api ${name}\` sends a body, which makes gh default to POST. ${RUN_IT_YOURSELF}` };
      }
    }
    return { deny: false };
  }

  const allowed = GH_ALLOWED.get(cmd);
  if (allowed !== undefined && sub !== undefined && allowed.has(sub)) return { deny: false };

  if (cmd === 'release') {
    return { deny: true, reason: `BLOCKED: all of \`gh release\` is blocked, reads included — a release is this project's UAT distribution channel (AD39). ${RUN_IT_YOURSELF}` };
  }
  return {
    deny: true,
    reason: `BLOCKED: \`gh ${cmd}${sub ? ` ${sub}` : ''}\` is not on the read-only allowlist (\`gh issue create\` is the one permitted write). ${RUN_IT_YOURSELF}`,
  };
}

/** Classify a whole Bash command string. Returns `{ deny, reason? }`. */
export function classifyCommand(command) {
  if (typeof command !== 'string' || command.trim() === '') return { deny: false };
  for (const segment of splitSegments(command)) {
    const words = stripPrefixes(segment);
    if (words.length === 0) continue;
    const program = path.basename(words[0]);
    let verdict = { deny: false };
    if (program === 'git') verdict = classifyGit(words.slice(1));
    else if (program === 'gh') verdict = classifyGh(words.slice(1));
    if (verdict.deny) return verdict;
  }
  return { deny: false };
}

async function main() {
  const payload = await readPayload();
  if (payload === null) {
    process.stderr.write('guard-git: unreadable hook payload; allowing (see hook-io.mjs).\n');
    allow();
    return;
  }
  const command = payload?.tool_input?.command;
  const verdict = classifyCommand(command);
  if (verdict.deny) deny(verdict.reason);
  allow();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
