# Claude Code Instructions

## Git Workflow

**NEVER push directly to main.** Always follow this workflow:

1. Create a feature branch: `git checkout -b feat/description` or `fix/description`
2. Make commits on the feature branch
3. Push the feature branch: `git push -u origin <branch-name>`
4. Create a PR using `gh pr create`

When the user says "push branch" or "push this", create a feature branch first if on main.
