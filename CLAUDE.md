# CLAUDE.md — AmakaFlow Agent Rules

## Before Committing
- Run `git status` — check for untracked files that should be included
- Add specific files by name — never use `git add .` or `git add -A`
- Verify `git diff --cached --stat` matches what you intend to commit

## Before Claiming Done
- Run the full test suite and confirm ALL tests pass
- Show test output as evidence — don't just say "tests pass"
- If tests fail, fix them before reporting completion

## After Pushing a PR
- Verify CI passes: `gh pr checks NUMBER --repo Amakaflow/REPO`
- If CI fails, investigate and fix — do not move on

## Code Standards
- Read existing files before modifying — match existing patterns
- Handle errors explicitly — no silent failures
- No hardcoded secrets or environment-specific values
- One logical change per commit with descriptive messages

## Testing
- Every bug fix needs a failing test first
- Every new feature ships with tests
- Use existing test helpers — don't create parallel ones
