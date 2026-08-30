# OctaReader agent instructions

## Source of truth

- Before implementation or review, read `docs/pwa-reader-project.md` and `docs/implementation-plan.md`.
- Treat the specification as the product contract and the implementation plan as the required commit order.
- Each numbered plan step is one commit. Do not combine steps or start the next step in the same commit.
- Update the step status in `docs/implementation-plan.md` in the commit that completes it.
- If a required behavior is technically unreliable, especially in Safari/iOS or `epub.js`, report the limitation and request a decision instead of silently weakening the requirement.

## General review rules

- Review the requested diff only. If the range is not specified, use the current uncommitted diff; if the tree is clean, review the latest commit.
- Review as a reviewer, not as an implementer. Do not modify code during review unless the user explicitly asks to fix findings.
- Read the relevant specification section and plan step before judging the implementation.
- Focus on defects, regressions, security or privacy leaks, data-loss risks, incorrect edge-case behavior, missing error handling, and missing tests.
- Do not report formatting or style preferences already enforced by automated tooling unless they cause a functional or maintainability problem.
- Confirm that the diff contains only the current plan step and that its status and proposed commit message are accurate.
- Never approve solely because tests pass. Check that the tests assert the requirement and would fail for a plausible broken implementation.
- Do not claim a platform-specific behavior was verified unless the corresponding browser or real device test actually ran.
- Treat weakening strict TypeScript or ESLint rules, broad file-level disables, and unexplained inline disables as review findings. Prefer a typed adapter or the smallest documented exception.

## Required review workflow

1. Inspect `git status`, the requested diff, and nearby code needed to understand the change.
2. Identify the current step in `docs/implementation-plan.md` and its acceptance criteria.
3. Trace affected data and control flows, including failure and offline paths.
4. Run the smallest relevant tests first. When available, run `npm run validate` before the final verdict.
5. For browser-sensitive changes, run the relevant Playwright Chromium/WebKit test. Require a documented real iOS/Safari smoke-test where the plan calls for one.
6. Report findings before any summary, ordered by severity.
7. If there are no findings, say so explicitly and list residual risks or checks that could not be run.

## Severity and verdict

- **P0 — Critical:** data loss, secret disclosure, broken security boundary, or unusable primary flow. Blocks completion.
- **P1 — High:** incorrect required behavior, major regression, broken offline path, or common crash. Blocks completion.
- **P2 — Medium:** real edge-case defect, unreliable error recovery, incorrect state transition, or important missing test. Blocks completion unless explicitly accepted.
- **P3 — Low:** limited-impact robustness or maintainability issue with a concrete failure mode. Does not block completion by itself.

Use one of these verdicts:

- **Approved:** no blocking findings; required checks passed.
- **Approved with follow-ups:** only P3 findings remain and they are recorded.
- **Changes required:** at least one P0, P1, or P2 finding remains.
- **Review incomplete:** required evidence or environment is unavailable; state exactly what remains unchecked.

## Required review output

For every finding include:

- severity;
- concise title;
- exact file and line;
- failure scenario and user-visible impact;
- violated specification or plan requirement;
- smallest safe direction for a fix, without implementing it.

After findings, include:

1. assumptions or open questions;
2. commands and tests run with their results;
3. residual risks and unverified platforms;
4. final verdict.

## Project-specific review checklist

Apply only the checks relevant to the diff.

### EPUB and storage

- EPUB import is atomic; a failed or quota-limited write cannot leave a visible partial book.
- Duplicate detection uses the content hash and cannot create a second entry for the same file.
- Unsupported, damaged, DRM, and fixed-layout inputs fail with controlled Russian-language errors.
- Dexie schema changes are versioned, migrated, and covered by migration tests.
- Deleting a book preserves saved vocabulary and textual sentence contexts.
- Clearing all data removes every IndexedDB record, including the API key and translation cache.

### Reader and progress

- Position is stored as EPUB CFI with the required debounce and lifecycle flush.
- Overall progress comes from persisted `epub.js locations` and `percentageFromCfi`, not visual page count.
- Reader appearance changes do not reset CFI or logical progress.
- Chapter navigation and TOC degrade safely when EPUB metadata is incomplete.
- Tap handling works inside the `epub.js` document context and does not depend on desktop-only mouse behavior.

### Word and sentence detection

- Only a word and an automatically detected sentence are supported; manual text fragments must not be introduced.
- Word boundaries handle punctuation, inner apostrophes, and inner hyphens.
- Sentence extraction does not cross paragraph, heading, or list-item boundaries.
- Failure to determine a sentence still permits word-only translation and stores no invented context.

### AI and secrets

- The model comes from `DEFAULT_AI_MODEL`; model identifiers are not duplicated in business logic.
- AI responses are runtime-validated before caching or saving.
- Proper nouns are not translated or added to the vocabulary.
- Cache keys include normalized word, sentence or empty context, language pair, provider, and model.
- Only a temporary network error receives one automatic retry; all further retries are user initiated.
- The API key never appears in URLs, logs, analytics, telemetry, cache keys, error text, snapshots, or fixtures committed to Git.
- Provider errors are sanitized and mapped to the required Russian messages.

### Vocabulary and repetition

- Vocabulary identity includes normalized lemma, part of speech, source language, and target language.
- Repeated saves append non-duplicate contexts instead of creating duplicate entries.
- Context-specific translations remain attached to their corresponding sentences.
- SRS calculations match the specified minimum intervals and multipliers.
- `dueAt` handling is correct across local day boundaries and after an «Не помню» reset.

### Offline and PWA

- After the first online load, the app shell and all local-only flows work without a network.
- New AI translation fails cleanly offline while cached translations remain available.
- Service Worker updates do not clear or migrate IndexedDB destructively.
- Tests distinguish Chromium/WebKit automation from verification on a real iOS device.

## Review cadence

- Perform a focused self-review of the diff before every planned commit.
- Run an independent review in a fresh chat after each implementation stage, normally every 3–5 commits.
- Always run an independent review at the high-risk gates: atomic EPUB import, word/sentence detection on iOS, completion of the AI translation flow, completion of SRS, and release readiness.
- Run a full repository review after the cross-browser acceptance suite and before declaring the MVP complete.
- Re-review immediately after a fix for any P0 or P1 finding. P2 fixes may be reviewed together before the affected stage is closed.
