/**
 * ESLint flat config. See DECISIONS.md AD34 for every judgment call below, and
 * FINDINGS.md AF44 for the measurements; nothing is restated here (AD18).
 *
 * CommonJS on purpose: package.json declares no `"type": "module"`, so a `.js`
 * config is CJS. It is deliberately NOT named `eslint.config.mjs` — that would
 * fold a config file into AF14's tracked-`.mjs` framing and the "14 suites plus
 * 1 baseline check" accounting AD31 protects. Those counts have since moved (15
 * tracked `.mjs`, 14 suites): the fifteenth arrived as a behavioural suite,
 * `app.config-headless-test.mjs` (AD37), which is what that accounting is for.
 * This file stays `.js` for the same reason it always was.
 *
 * Three `files` overrides below are load-bearing rather than cosmetic. Each
 * exists because the alternative is editing a file pinned in
 * CORE-DIVERGENCE.md, which its §3 makes a same-PR row update plus an AD entry.
 */
const expoFlat = require('eslint-config-expo/flat');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'expo-env.d.ts',
      'example/**',
      'android/**',
      // AF16: every suite writes `.headless-<name>-<pid>.mjs` beside its
      // subject inside src/core/ while it runs. Lint must never see generated
      // code, and a suite killed mid-run leaves one behind.
      '**/.headless-*.mjs',
    ],
  },

  ...expoFlat,

  // Level 2, repo-wide. `no-console` allows `warn` on the TS side so the two
  // deliberate degradation warnings in src/core/parsers/epubStructure.ts
  // (manifest row 7) need no file edit.
  {
    rules: {
      'import/order': 'error',
      'no-console': ['error', { allow: ['warn'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
    },
  },

  // eslint-config-expo registers the @typescript-eslint plugin only inside a
  // TS-scoped block, so naming its rules anywhere else is a hard config error.
  // Stock sets no-unused-vars to `warn`; escalating it to `error` is the point.
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { vars: 'all', args: 'none', ignoreRestSiblings: true, caughtErrors: 'all' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // The 15 tracked .mjs files are Node CLI programs whose output IS their
  // result: `console.log` prints every PASS/FAIL line and every tally that
  // `npm run check` reports. Nine of the fifteen are manifest-pinned (rows
  // 13-20 and 25), so a style rule they cannot satisfy is one that would be
  // suppressed forever or would force an edit the manifest forbids.
  {
    files: ['**/*.mjs'],
    rules: {
      'no-console': 'off',
      'import/order': 'off',
    },
  },

  // `declare var` is the canonical ambient-global form -- lib.dom.d.ts uses
  // exactly it, and `declare const` would not be a fix. eslint-config-expo
  // already carries a `**/*.d.ts` block turning `import/order` off; this
  // extends that same exemption to the rule that actually fires here, on
  // types/hermes-globals.d.ts (AD4).
  {
    files: ['**/*.d.ts'],
    rules: { 'no-var': 'off' },
  },

  // src/pacer/usePacer.ts -- manifest row 21. Every rule disabled here objects
  // to the design CLAUDE.md §4 invariant 2 mandates and AF32/AF34 proved on
  // hardware. Inline eslint-disable comments were rejected: they change the
  // file's bytes and would cost a row-21 update to buy what a config rule buys
  // free. Refactoring was rejected: it would spend device evidence that is a
  // property of this exact implementation.
  {
    files: ['src/pacer/usePacer.ts'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];
