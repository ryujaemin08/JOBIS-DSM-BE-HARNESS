# Release Workflow

## Branch Roles
- `develop`
  - development integration branch
- `main`
  - production release branch

## Release Direction
- Work is expected to land in `develop` first.
- `main` is used for production release flow.

## Release Steps
1. Sync local `main` with `origin/main`
2. Pull `develop`
3. Merge `develop` into `main`
4. Use the target version string as the merge commit message
5. Push `main`
6. Create the matching tag
7. Push the tag
8. Create the GitHub release notes

## Example Command Flow
```bash
git checkout main
git pull origin main
git pull origin develop
git commit -m "vX.Y.Z"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

## Release Constraints
- The merge commit message must equal the release version
- The tag must equal the release version
- Release notes should follow the repository's existing style
- Tag version should increment from the latest release
