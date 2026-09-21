/**
 * Headless checks for the four branching-model guards (the sixteenth suite).
 *
 * Subjects: .claude/hooks/guard-branch.mjs, .claude/hooks/guard-git.mjs,
 * .claude/hooks/hook-io.mjs, .githooks/pre-commit and .githooks/pre-push, plus
 * the registration in .claude/settings.json. AD45 holds the reasoning, AF56 the
 * measurements; neither is restated here (AD18).
 *
 * WHY IT LIVES IN scripts/ RATHER THAN BESIDE ITS SUBJECT. The other fifteen
 * suites sit next to the one module they bundle. This one covers five files
 * across two directories, so "beside its subject" has no single answer, and
 * scripts/ is already the home for repo-tooling programs
 * (check-core-baseline.mjs). It also keeps .claude/ and .githooks/ holding only
 * what those tools consume.
 *
 * NO esbuild, DELIBERATELY. Every other suite bundles TypeScript because that
 * is the only way to execute it. These subjects are already executable .mjs and
 * POSIX sh, so this runs THEM -- importing the hook modules for the large
 * decision tables, and spawning them as real processes for the wire protocol
 * and exit codes. Spawning is what makes the exit-code assertions meaningful:
 * exit 2 blocks a tool call and exit 1 does not, and only a real process exit
 * proves which one a guard produces.
 *
 * THE GIT HOOKS ARE RUN BY GIT, NOT CALLED AS SCRIPTS. Section 7 builds a
 * throwaway repository with `git init`, points ITS core.hooksPath at this
 * repo's .githooks, and then performs real commits and real pushes to a real
 * local bare remote. That exercises the hooks exactly as git invokes them --
 * including feeding pre-push its stdin format -- which a direct invocation
 * would only approximate. Nothing here is on the network.
 *
 * SCOPE NOTE ON core.hooksPath: it is set on the THROWAWAY repository only,
 * inside a temp directory that is deleted at the end. This suite never
 * configures the repository it lives in; that is the operator's own one-time
 * setup step (README).
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyPath, nearestExistingDir, targetFromPayload } from '../.claude/hooks/guard-branch.mjs';
import { classifyCommand, splitSegments, stripHeredocs } from '../.claude/hooks/guard-git.mjs';
import { BLOCK_EXIT_CODE, HOOK_EVENT } from '../.claude/hooks/hook-io.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_BRANCH = path.join(REPO_ROOT, '.claude', 'hooks', 'guard-branch.mjs');
const GUARD_GIT = path.join(REPO_ROOT, '.claude', 'hooks', 'guard-git.mjs');
const GITHOOKS_DIR = path.join(REPO_ROOT, '.githooks');
const SETTINGS = path.join(REPO_ROOT, '.claude', 'settings.json');

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${label}: ${err.message}`);
    failed++;
  }
}

function ok(label, cond, msg) {
  try {
    assert.ok(cond, msg);
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${label}: ${err.message}`);
    failed++;
  }
}

/**
 * Evaluate `fn`, returning a marker string if it threw. A negative-control run
 * drives a deliberately broken guard through every case below, and an
 * unexpected throw in an argument position would abort the file and hide every
 * later check -- the fail-fast masking AF17 records and this repo avoids.
 */
function value(fn) {
  try {
    return fn();
  } catch (err) {
    return `THREW: ${err.message}`;
  }
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** Run a hook as a real process with a JSON payload on stdin. */
function runHook(script, payload) {
  const res = spawnSync(process.execPath, [script], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
  });
  return { status: res.status, stdout: String(res.stdout ?? ''), stderr: String(res.stderr ?? '') };
}

function git(dir, args, opts = {}) {
  return spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', ...opts });
}

/** A throwaway repository with one commit, HEAD on `branch`. */
function makeRepo(root, name, branch) {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  spawnSync('git', ['init', '-q', dir], { encoding: 'utf8' });
  git(dir, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  git(dir, ['config', 'user.email', 'guards@example.invalid']);
  git(dir, ['config', 'user.name', 'Guards Suite']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(path.join(dir, 'seed.txt'), 'seed\n');
  git(dir, ['add', 'seed.txt']);
  git(dir, ['commit', '-q', '-m', 'seed']);
  if (branch !== 'main') git(dir, ['checkout', '-q', '-b', branch]);
  return dir;
}

console.log('\nbranching-model guards — headless checks\n');

const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'guards-suite-'));

try {
  // ─── 1. The shared wire protocol ─────────────────────────────────────────
  {
    check('the guards target the PreToolUse event', HOOK_EVENT, 'PreToolUse');
    check('the blocking exit code is 2, not 1', BLOCK_EXIT_CODE, 2);

    const repoMain = makeRepo(tmpRoot, 'proto-main', 'main');
    const denied = runHook(GUARD_BRANCH, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: path.join(repoMain, 'a.txt') },
    });

    check('a denial exits with the blocking code', denied.status, 2);
    ok('a denial writes the reason to stderr too, so it survives a harness that reads no JSON',
      denied.stderr.includes('BLOCKED'), `stderr was ${JSON.stringify(denied.stderr)}`);

    const parsed = value(() => JSON.parse(denied.stdout));
    ok('a denial writes parseable JSON to stdout', typeof parsed === 'object' && parsed !== null,
      `stdout was ${JSON.stringify(denied.stdout)}`);
    check('the JSON uses the documented hookEventName', parsed?.hookSpecificOutput?.hookEventName, 'PreToolUse');
    check('the JSON uses the documented permissionDecision', parsed?.hookSpecificOutput?.permissionDecision, 'deny');
    ok('the JSON carries a non-empty permissionDecisionReason',
      typeof parsed?.hookSpecificOutput?.permissionDecisionReason === 'string'
        && parsed.hookSpecificOutput.permissionDecisionReason.length > 0,
      'permissionDecisionReason missing or empty');

    const repoWork = makeRepo(tmpRoot, 'proto-work', 'feature/x');
    const allowed = runHook(GUARD_BRANCH, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: path.join(repoWork, 'a.txt') },
    });
    check('an allow exits 0', allowed.status, 0);
    check('AN ALLOW WRITES NOTHING TO STDOUT — printing permissionDecision "allow" would grant permission and suppress the operator\'s own prompts',
      allowed.stdout, '');
  }

  // ─── 2. guard-branch: which branch blocks an edit ────────────────────────
  {
    const onMain = makeRepo(tmpRoot, 'b-main', 'main');
    const onDev = makeRepo(tmpRoot, 'b-dev', 'dev');
    const onWork = makeRepo(tmpRoot, 'b-work', 'chore/thing');
    const onDetached = makeRepo(tmpRoot, 'b-detached', 'main');
    const head = git(onDetached, ['rev-parse', 'HEAD']).stdout.trim();
    git(onDetached, ['checkout', '-q', '--detach', head]);

    const notRepo = path.join(tmpRoot, 'not-a-repo');
    mkdirSync(notRepo, { recursive: true });

    check('editing on main is denied', value(() => classifyPath(path.join(onMain, 'f.txt')).deny), true);
    check('editing on dev is denied', value(() => classifyPath(path.join(onDev, 'f.txt')).deny), true);
    check('editing on a work branch is allowed', value(() => classifyPath(path.join(onWork, 'f.txt')).deny), false);
    check('editing on a DETACHED HEAD is denied', value(() => classifyPath(path.join(onDetached, 'f.txt')).deny), true);
    check('a path outside any work tree is allowed — the scratchpad must keep working',
      value(() => classifyPath(path.join(notRepo, 'f.txt')).deny), false);

    check('a not-yet-existing NESTED path still resolves to its repo',
      value(() => classifyPath(path.join(onMain, 'new', 'deeper', 'f.txt')).deny), true);

    const reason = value(() => classifyPath(path.join(onMain, 'f.txt')).reason);
    ok('the denial names the branch', typeof reason === 'string' && reason.includes('`main`'), reason);
    ok('the denial names the fix', typeof reason === 'string' && reason.includes('checkout -b'), reason);
    ok('the detached denial says so',
      String(value(() => classifyPath(path.join(onDetached, 'f.txt')).reason)).includes('detached'), 'no mention');

    check('nearestExistingDir walks up past directories that do not exist yet',
      value(() => nearestExistingDir(path.join(onWork, 'no', 'such', 'dir', 'f.txt'))), onWork);

    check('the edit target is read from tool_input.file_path',
      value(() => targetFromPayload({ tool_input: { file_path: '/x/y.txt' } })), '/x/y.txt');
    check('a notebook path is honoured too',
      value(() => targetFromPayload({ tool_input: { notebook_path: '/x/y.ipynb' } })), '/x/y.ipynb');
    check('with no path, cwd is the fallback',
      value(() => targetFromPayload({ cwd: '/x', tool_input: {} })), '/x');
  }

  // ─── 3. guard-branch: payloads through a real process ────────────────────
  {
    const onDev = makeRepo(tmpRoot, 'p-dev', 'dev');
    const editOnDev = runHook(GUARD_BRANCH, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: path.join(onDev, 'README.md') },
    });
    check('Edit on dev is blocked end to end', editOnDev.status, 2);

    check('MALFORMED STDIN FAILS OPEN, deliberately — a guard that hard-failed on a payload-shape change would block every edit in the repo',
      runHook(GUARD_BRANCH, 'not json at all').status, 0);
    check('empty stdin fails open too', runHook(GUARD_BRANCH, '').status, 0);
  }

  // ─── 4. guard-git: the decision table ────────────────────────────────────
  {
    // [command, expect deny, label]
    const rows = [
      // -- reads that must keep working --------------------------------------
      ['git status -sb', false, 'git status -sb'],
      ['git branch --show-current', false, 'git branch --show-current'],
      ['git branch --list', false, 'git branch --list'],
      ['git branch -vv', false, 'git branch -vv'],
      ['git branch -a', false, 'git branch -a'],
      ["git branch --list 'feature/*'", false, 'git branch --list with a pattern'],
      ['git branch --contains HEAD', false, 'git branch --contains HEAD (value is not an operand)'],
      ['git log --oneline origin/main..origin/dev', false, 'git log with a range'],
      ['git diff --stat', false, 'git diff'],
      ['git show HEAD', false, 'git show'],
      ['git rev-parse --abbrev-ref HEAD', false, 'git rev-parse'],
      ['git ls-files', false, 'git ls-files'],
      ['git check-ignore -v .claude/settings.local.json', false, 'git check-ignore'],
      ['git tag --list', false, 'git tag --list'],
      ['git stash list', false, 'git stash list'],
      ['git config --get core.hooksPath', false, 'git config --get'],
      ['git remote -v', false, 'git remote -v'],
      ['git reflog show', false, 'git reflog show'],
      ['git worktree list', false, 'git worktree list'],
      ['git submodule status', false, 'git submodule status'],
      ['git fetch', false, 'git fetch (bare)'],
      ['git fetch origin', false, 'git fetch origin'],
      ['git diff > /tmp/out.txt', false, 'a redirection is not an operand'],
      ['npm run check', false, 'a non-git command is none of our business'],

      // -- the writes the model forbids --------------------------------------
      ['git add .', true, 'git add'],
      ['git commit -m "x"', true, 'git commit'],
      ['git push', true, 'git push'],
      ['git push --force origin main', true, 'git push --force'],
      ['git pull', true, 'git pull'],
      ['git merge dev', true, 'git merge'],
      ['git rebase -i HEAD~3', true, 'git rebase'],
      ['git cherry-pick abc123', true, 'git cherry-pick'],
      ['git revert HEAD', true, 'git revert'],
      ['git reset --hard HEAD', true, 'git reset'],
      ['git clean -fd', true, 'git clean'],
      ['git rm README.md', true, 'git rm'],
      ['git tag v1.0.0', true, 'git tag <name> creates a tag'],
      ['git tag -d v1.0.0', true, 'git tag -d'],
      ['git branch feature/x', true, 'git branch <name> creates a branch'],
      ['git branch -d feature/x', true, 'git branch -d'],
      ['git branch -m old new', true, 'git branch -m'],
      ['git branch -u origin/dev', true, 'git branch -u'],
      ['git checkout main', true, 'git checkout <branch> switches branches'],
      ['git checkout -b feature/x', true, 'git checkout -b'],
      ['git switch dev', true, 'git switch'],
      ['git config core.hooksPath .githooks', true, 'git config <key> <value> writes'],
      ['git update-ref refs/heads/main HEAD', true, 'an UNLISTED subcommand fails closed'],
      ['git bisect start', true, 'git bisect writes state'],
      ['git remote add origin git@example.com:o/r.git', true, 'git remote add'],
      ['git worktree add ../wt', true, 'git worktree add'],
      ['git reflog delete HEAD@{0}', true, 'git reflog delete'],

      // -- the revert pattern the negative controls in FINDINGS rely on ------
      ['git checkout -- README.md', false, 'git checkout -- <path> is the revert pattern'],
      ['git checkout -- .', false, 'git checkout -- .'],
      ['git restore README.md', false, 'git restore <path>'],
      ['git restore --staged README.md', true, 'git restore --staged writes the index'],

      // -- git stash, ruled on in AD45 ---------------------------------------
      ['git stash', true, 'bare git stash reverts the working tree'],
      ['git stash pop', true, 'git stash pop'],
      ['git stash drop', true, 'git stash drop'],

      // -- fetch writes a local ref only through a refspec --------------------
      ['git fetch origin main:main', true, 'git fetch with a refspec writes a local ref'],
      ['git fetch https://example.com/o/r.git', false, 'a URL colon is not a refspec'],

      // -- evasion shapes -----------------------------------------------------
      ['npm run check && git commit -m x', true, 'chained with &&'],
      ['git status; git push', true, 'chained with ;'],
      ['npm run check || git reset --hard', true, 'chained with ||'],
      ['git log | head -5 && git push', true, 'chained through a pipe'],
      ['git -C /tmp/elsewhere commit -m x', true, 'git -C <dir> is stepped over'],
      ['git -c user.name=x commit -m y', true, 'git -c <cfg> is stepped over'],
      ['FOO=1 BAR=2 git push', true, 'leading env assignments are stepped over'],
      ['sudo git commit -m x', true, 'a sudo wrapper is stepped over'],
      ['env git push', true, 'an env wrapper is stepped over'],
      ['xargs git commit', true, 'an xargs wrapper is stepped over'],
      ['echo $(git commit -m x)', true, 'inside a command substitution'],
      ['echo "$(git push)"', true, 'a substitution inside DOUBLE quotes still runs'],
      ["echo '$(git push)'", false, 'a substitution inside SINGLE quotes does not'],
      ['/usr/bin/git push', true, 'an absolute path to git'],

      // -- gh -----------------------------------------------------------------
      ['gh issue create --title x --body y', false, 'gh issue create is the one permitted write'],
      ['gh issue view 12 --comments', false, 'gh issue view'],
      ['gh issue list --state open', false, 'gh issue list'],
      ['gh pr view 3', false, 'gh pr view'],
      ['gh pr list', false, 'gh pr list'],
      ['gh pr diff 3', false, 'gh pr diff'],
      ['gh pr checks 3', false, 'gh pr checks'],
      ['gh run list --workflow=uat-build.yml', false, 'gh run list'],
      ['gh run view 123 --log', false, 'gh run view --log'],
      ['gh api repos/OWNER/REPO/branches/main/protection', false, 'gh api GET'],
      ['gh secret list', false, 'gh secret list'],
      ['gh auth status', false, 'gh auth status'],
      ['gh pr create --fill', true, 'gh pr create'],
      ['gh pr merge 3 --squash', true, 'gh pr merge'],
      ['gh pr close 3', true, 'gh pr close'],
      ['gh pr edit 3 --title x', true, 'gh pr edit'],
      ['gh pr ready 3', true, 'gh pr ready'],
      ['gh pr review 3 --approve', true, 'gh pr review'],
      ['gh pr checkout 3', true, 'gh pr checkout switches branches'],
      ['gh issue close 12', true, 'gh issue close'],
      ['gh release create v1', true, 'gh release create'],
      ['gh release upload uat f.apk', true, 'gh release upload'],
      ['gh release view uat', true, 'ALL of gh release is blocked, reads included (AD45)'],
      ['gh repo edit --visibility private', true, 'gh repo edit'],
      ['gh api -X POST repos/o/r/issues', true, 'gh api with an explicit non-GET method'],
      ['gh api --method DELETE repos/o/r/x', true, 'gh api --method DELETE'],
      ['gh api repos/o/r/issues -f title=x', true, 'gh api -f sends a body, so gh defaults to POST'],
      ['gh api repos/o/r/issues --field title=x', true, 'gh api --field'],
      ['gh workflow run uat-build.yml', true, 'gh workflow run'],
      ['gh secret set FOO', true, 'gh secret set'],
    ];

    for (const [command, expected, label] of rows) {
      check(`${expected ? 'DENY ' : 'allow'} — ${label}`, value(() => classifyCommand(command).deny), expected);
    }
  }

  // ─── 5. Heredoc bodies are data, not commands ────────────────────────────
  {
    const issueBody = [
      'gh issue create --title "Branching model" --body "$(cat <<\'EOF\'',
      'Claude Code must never run these:',
      'git push',
      'git commit -m x',
      'gh pr merge 7',
      'EOF',
      ')"',
    ].join('\n');

    check('a heredoc issue body naming git push / git commit / gh pr merge is ALLOWED',
      value(() => classifyCommand(issueBody).deny), false);
    ok('the heredoc body is genuinely stripped, not merely out-quoted',
      !value(() => stripHeredocs(issueBody)).includes('git push'),
      'the body survived stripHeredocs');

    const indented = ['cat <<-EOT', '\tgit push', '\tEOT'].join('\n');
    check('a <<- heredoc with a tab-indented terminator is stripped',
      value(() => classifyCommand(indented).deny), false);

    check('<<< is a here-string, not a heredoc, and is not stripped',
      value(() => classifyCommand('grep -q x <<< "git push"').deny), false);

    check('a real command AFTER a heredoc is still classified',
      value(() => classifyCommand(['cat <<\'EOF\'', 'text', 'EOF', 'git commit -m x'].join('\n')).deny), true);

    check('a FALSE heredoc with no terminator must not swallow the rest of the command',
      value(() => classifyCommand(['echo "a << b"', 'git push'].join('\n')).deny), true);

    check('segmentation splits a chain into its simple commands',
      value(() => splitSegments('git status && git push').length), 2);
  }

  // ─── 6. guard-git through a real process ─────────────────────────────────
  {
    const denied = runHook(GUARD_GIT, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "x"' },
    });
    check('a blocked git write exits 2', denied.status, 2);
    check('its stdout JSON denies', value(() => JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision), 'deny');
    ok('its reason points at CLAUDE.md §1', denied.stderr.includes('CLAUDE.md §1'), denied.stderr);

    const allowed = runHook(GUARD_GIT, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
    });
    check('a read exits 0', allowed.status, 0);
    check('a read writes nothing to stdout', allowed.stdout, '');

    check('guard-git also fails open on malformed stdin', runHook(GUARD_GIT, '{{{').status, 0);
  }

  // ─── 7. .claude/settings.json registration ───────────────────────────────
  {
    ok('.claude/settings.json exists', existsSync(SETTINGS), `${SETTINGS} is missing`);
    const settings = value(() => JSON.parse(readFileSync(SETTINGS, 'utf8')));
    ok('it is valid JSON', typeof settings === 'object' && settings !== null, String(settings));

    const groups = Array.isArray(settings?.hooks?.PreToolUse) ? settings.hooks.PreToolUse : [];
    check('it registers exactly two PreToolUse matcher groups', groups.length, 2);

    const byMatcher = new Map(groups.map((g) => [g.matcher, g]));
    ok('one group matches the file-editing tools',
      [...byMatcher.keys()].some((m) => typeof m === 'string' && m.includes('Edit') && m.includes('Write')),
      `matchers were ${JSON.stringify([...byMatcher.keys()])}`);
    ok('one group matches Bash', byMatcher.has('Bash'), `matchers were ${JSON.stringify([...byMatcher.keys()])}`);

    // The docs make a matcher an EXACT pipe-list only while it contains
    // nothing but letters, digits, _, -, spaces, commas and pipes. Any other
    // character silently turns it into an unanchored regex.
    for (const m of byMatcher.keys()) {
      ok(`the matcher ${JSON.stringify(m)} is literal-list syntax, not an accidental regex`,
        typeof m === 'string' && /^[A-Za-z0-9_\-, |]+$/.test(m), `matcher ${JSON.stringify(m)}`);
    }

    const handlers = groups.flatMap((g) => (Array.isArray(g.hooks) ? g.hooks : []));
    check('every group registers exactly one handler', handlers.length, groups.length);
    for (const h of handlers) {
      ok(`handler type is "command" (got ${JSON.stringify(h?.type)})`, h?.type === 'command', 'wrong handler type');
      ok('the handler command is project-root relative via ${CLAUDE_PROJECT_DIR}',
        typeof h?.command === 'string' && h.command.includes('${CLAUDE_PROJECT_DIR}'),
        `command was ${JSON.stringify(h?.command)}`);
    }

    const referenced = handlers
      .map((h) => /\$\{CLAUDE_PROJECT_DIR\}\/([^"']+)/.exec(String(h?.command ?? ''))?.[1])
      .filter((x) => typeof x === 'string');
    check('both handler scripts are referenced', referenced.length, 2);
    for (const rel of referenced) {
      ok(`the referenced script exists: ${rel}`, existsSync(path.join(REPO_ROOT, rel)), `${rel} is missing`);
    }
  }

  // ─── 8. .githooks, run by git in a throwaway repository ──────────────────
  {
    for (const name of ['pre-commit', 'pre-push']) {
      const file = path.join(GITHOOKS_DIR, name);
      ok(`.githooks/${name} exists`, existsSync(file), `${file} is missing`);
      // git records 100755 for any file whose owner-execute bit is set.
      ok(`.githooks/${name} is executable in the working tree`,
        existsSync(file) && (statSync(file).mode & 0o111) !== 0,
        `mode is ${existsSync(file) ? (statSync(file).mode & 0o777).toString(8) : 'n/a'}`);
    }

    const repo = makeRepo(tmpRoot, 'hooks-live', 'main');
    git(repo, ['config', 'core.hooksPath', GITHOOKS_DIR]);

    // -- pre-commit -------------------------------------------------------
    // Each attempt stages its OWN file. Reusing one staged change would make a
    // later `git commit` exit non-zero for "nothing to commit" rather than for
    // the guard, so a broken hook could still look refused -- a check passing
    // for the wrong reason. Found by running this suite's negative control
    // before trusting it (AF56).
    const stage = (name) => {
      writeFileSync(path.join(repo, name), `${name}\n`);
      git(repo, ['add', name]);
    };

    stage('a.txt');
    const commitOnMain = git(repo, ['commit', '-m', 'on main']);
    check('git commit on main is refused by pre-commit', commitOnMain.status !== 0, true);
    ok('and it says which branch', String(commitOnMain.stderr).includes("refusing to commit on 'main'"),
      String(commitOnMain.stderr));

    git(repo, ['checkout', '-q', '-b', 'dev']);
    stage('b.txt');
    const commitOnDev = git(repo, ['commit', '-m', 'on dev']);
    check('git commit on dev is refused too', commitOnDev.status !== 0, true);
    ok('and that refusal is the guard, not an empty index',
      String(commitOnDev.stderr).includes("refusing to commit on 'dev'"), String(commitOnDev.stderr));

    git(repo, ['checkout', '-q', '-b', 'feature/allowed']);
    stage('c.txt');
    const commitOnWork = git(repo, ['commit', '-m', 'on a work branch']);
    check('git commit on a work branch SUCCEEDS — the guard must not block ordinary work',
      commitOnWork.status, 0);

    // -- pre-push, against a real local bare remote, no network -----------
    const remote = path.join(tmpRoot, 'remote.git');
    spawnSync('git', ['init', '-q', '--bare', remote], { encoding: 'utf8' });
    git(repo, ['remote', 'add', 'origin', remote]);

    const pushToMain = git(repo, ['push', '-q', 'origin', 'HEAD:refs/heads/main']);
    check('git push to refs/heads/main is refused by pre-push', pushToMain.status !== 0, true);
    ok('and it names main', String(pushToMain.stderr).includes("refusing to push to 'main'"),
      String(pushToMain.stderr));

    const pushToDev = git(repo, ['push', '-q', 'origin', 'HEAD:refs/heads/dev']);
    check('git push to refs/heads/dev is refused too', pushToDev.status !== 0, true);

    const pushWork = git(repo, ['push', '-q', 'origin', 'HEAD:refs/heads/feature/allowed']);
    check('pushing a WORK BRANCH succeeds — promotions happen as PR merges, not local pushes',
      pushWork.status, 0);

    // Pushing a local branch named anything to refs/heads/main is still main.
    const sneaky = git(repo, ['push', '-q', 'origin', 'feature/allowed:refs/heads/main']);
    check('a local branch pushed ONTO main is still refused — the remote ref is what is tested',
      sneaky.status !== 0, true);
  }

  // ─── 9. The guards are not silently identical to nothing ─────────────────
  {
    ok('guard-branch.mjs is non-empty and imports the shared protocol',
      sha256(GUARD_BRANCH).length === 64 && readFileSync(GUARD_BRANCH, 'utf8').includes("from './hook-io.mjs'"),
      'guard-branch does not use hook-io');
    ok('guard-git.mjs imports the same shared protocol',
      readFileSync(GUARD_GIT, 'utf8').includes("from './hook-io.mjs'"),
      'guard-git does not use hook-io');
  }
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
