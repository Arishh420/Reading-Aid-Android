/**
 * The PreToolUse hook wire protocol, in one place.
 *
 * Both guards speak the same protocol and it is entirely docs-derived, so it
 * lives here rather than being written twice. This repo has recorded
 * value-duplication drift four times (AD2's settings-defaults.ts false
 * positive, AF8's hand-copied tsconfig exclude list, AD26's hand-copied theme
 * values, and AD32's correction to AD26), and a duplicated wire format whose
 * field names must agree exactly is the same hazard in a new place.
 *
 * VERIFIED AGAINST code.claude.com/docs/en/hooks, not from memory (AF56):
 *
 *   - EXIT CODE 2 BLOCKS. Exit 1 does NOT -- the docs are explicit that
 *     "Claude Code treats exit code 1 as a non-blocking error and proceeds
 *     with the action, even though 1 is the conventional Unix failure code."
 *     Getting this wrong yields a guard that prints a refusal and then lets
 *     the call through, which is worse than no guard because it reads as one.
 *
 *   - THE REASON TRAVELS TWO WAYS. On exit 2 the blocking reason comes from
 *     the JSON `permissionDecision` reason when stdout carries one, and from
 *     stderr when it does not. Emitting BOTH means the reason survives
 *     whichever path the harness takes.
 *
 *   - AN ALLOW MUST BE SILENT. Exit 0 with no output means "no decision; the
 *     normal permission flow applies". Printing permissionDecision "allow"
 *     would GRANT permission -- suppressing the operator's own prompts for
 *     every call the guard did not object to. That is the opposite of what a
 *     guardrail is for, so `allow()` writes nothing at all.
 *
 * FAIL-OPEN IS DELIBERATE, AND IT IS A DECISION RATHER THAN AN OVERSIGHT.
 * `readPayload` returns null on anything it cannot parse, and both guards
 * allow on null. A guard that hard-failed on an unrecognised payload shape
 * would block every edit or every Bash call in the repo the first time the
 * harness changed a field name -- a self-inflicted outage in exchange for
 * nothing, since these are guardrails against accident and not a security
 * boundary (AD45). The .githooks/ pair is the backstop that does not depend on
 * this process running at all. The suite asserts the fail-open path so it
 * cannot be "fixed" by accident.
 */

/** The event both guards are registered for. */
export const HOOK_EVENT = 'PreToolUse';

/** Exit code that blocks a tool call. NOT 1. See the docblock above. */
export const BLOCK_EXIT_CODE = 2;

/**
 * Read the hook payload from stdin.
 *
 * Returns the parsed object, or `null` if stdin was empty or not valid JSON.
 * Never throws: a throw here would exit non-zero with an unpredictable code.
 */
export async function readPayload() {
  try {
    const raw = await new Promise((resolve, reject) => {
      let buf = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        buf += chunk;
      });
      process.stdin.on('end', () => resolve(buf));
      process.stdin.on('error', reject);
    });
    if (raw.trim() === '') return null;
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Let the call proceed. Writes NOTHING and exits 0 -- "no decision", which
 * leaves the operator's normal permission flow in charge.
 */
export function allow() {
  process.exit(0);
}

/**
 * Block the call. Writes the structured decision to stdout, the same text to
 * stderr, and exits 2. See the docblock for why all three.
 */
export function deny(reason) {
  const decision = {
    hookSpecificOutput: {
      hookEventName: HOOK_EVENT,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(`${JSON.stringify(decision)}\n`);
  process.stderr.write(`${reason}\n`);
  process.exit(BLOCK_EXIT_CODE);
}
