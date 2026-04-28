# Release Process - Quick Guide

## 🚀 Release from Feature Branch (Recommended)

**All-in-one workflow: code + changeset + version + tag in feature branch**

```bash
# 1. Create feature branch
git checkout develop  # or main
git pull origin develop
git checkout -b feature/your-feature-name

# 2. Make code changes...

# 3. Create changeset (ONLY if code changes require version update)
npm run changeset
# Select packages:
#   [x] test-dashboard-server     ← ALWAYS together for Dashboard
#   [x] test-dashboard-web        ← ALWAYS together for Dashboard
#   [x] test-dashboard-core       ← ALWAYS together for Dashboard
#   [ ] playwright-dashboard-reporter  ← Only if reporter changed
# Select type: major/minor/patch (same type for all Dashboard packages)
# Write summary: First line short, then detailed changes

# 4. Commit changeset
git add .
git commit -m "feat(scope): description"

# 5. Apply changesets (updates versions, CHANGELOG, deletes changeset files)
npm run version

# 6. Review version changes
git status
git diff

# 7. Check versions (should be identical for server/web/core)
cat packages/server/package.json | grep version
cat packages/web/package.json | grep version
cat packages/core/package.json | grep version

# 8. Commit version changes
git add .
git commit -m "chore: release v1.4.0

- test-dashboard-server@1.4.0
- test-dashboard-web@1.4.0
- test-dashboard-core@1.4.0"

# 9. Create tags
git tag dashboard-v1.4.0 -m "Dashboard release 1.4.0"
# If reporter changed:
git tag reporter-v1.0.5 -m "Reporter release 1.0.5"

# 10. Push feature branch with tags
git push origin feature/your-feature-name --follow-tags

# 11. Merge to main or develop
# Option A: Via PR (recommended)
# Create PR: feature/your-feature-name → main (or develop)
# Merge PR → n8n automatically deploys (if merged to main)

# Option B: Direct merge
git checkout main
git merge feature/your-feature-name
git push origin main
# → n8n deploys

# 12. Sync develop (if merged to main)
git checkout develop
git merge main
git push origin develop

# 13. Delete feature branch (tags remain - tied to commits!)
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name

# 14. Publish reporter to NPM (if version changed)
npm whoami  # Check login
npm run release:reporter
```

---

## 🔄 Alternative: Release from Develop

**Traditional workflow: merge feature first, then release from develop**

```bash
# 1. Develop feature in branch
git checkout -b feature/my-feature
# ... code changes ...
git commit -m "feat: description"
git push origin feature/my-feature

# 2. Create PR and merge to develop (without changeset yet)

# 3. Release from develop
git checkout develop
git pull origin develop

# 4. Create changeset
npm run changeset

# 5. Apply changesets
npm run version

# 6. Commit + tag
git add .
git commit -m "chore: release v1.4.0"
git tag dashboard-v1.4.0 -m "Dashboard release 1.4.0"

# 7. Push with tags
git push origin develop --follow-tags

# 8. Create PR: develop → main
# Merge PR → n8n deploys
```

---

## ⚠️ Important Rules

### ✅ DO:

- **ALWAYS update server AND web together** (same version, same type)
- Create changeset for functional changes
- Use `npm run version` to update versions (never manually)
- Check versions before creating tags
- Sync develop after merging to main

### ❌ DON'T:

- Don't manually edit `package.json` versions (use `npm run version`)
- Don't manually edit `CHANGELOG.md` (changesets do it)
- Don't create different versions for server/web/core
- Don't delete changeset files manually (npm run version does it)
- Don't forget to publish reporter to NPM if changed

---

## 📝 Changeset Guidelines

### When to create:

- ✅ New feature
- ✅ Bug fix
- ✅ Breaking change

### When to skip:

- ❌ Documentation only
- ❌ Tests only (no functional changes)
- ❌ Routine tasks (chore)

### Summary format:

```
Add test notes feature for annotating tests

- Server: Add test_notes table, NoteController, NoteService, NoteRepository
- Web: Add TestNoteEditor component with edit/save/delete functionality
- Web: Display notes in TestOverviewTab and add 💬 indicator
```

---

## � Useful Commands

```bash
# Check what will be released
npm run changeset:status

# Apply changesets (updates versions, CHANGELOG, deletes changesets)
npm run version

# Check versions
cat packages/server/package.json | grep version
cat packages/web/package.json | grep version

# Publish reporter
npm run release:reporter

# Check NPM login
npm whoami
npm login
```

---

## 🎯 Version Synchronization

**Dashboard packages MUST have identical versions:**

```
server:   1.4.0 ✅
web:      1.4.0 ✅
core:     1.4.0 ✅
reporter: 1.0.5 (independent)
```

If versions diverged, select ALL packages in next changeset to sync them.

---

## ❓ Quick FAQ

**Q: Can I release from a feature branch?**  
A: Yes, technically from any branch. Tags are tied to commits, not branches.

**Q: What happens to tags when I delete a branch?**  
A: Tags remain - they're tied to commits.

**Q: Which version for dashboard tag?**  
A: Use version from `packages/server/package.json` after `npm run version`.

**Q: What does `npm run version` do?**  
A: Updates `package.json` versions, updates `CHANGELOG.md`, deletes changeset files.

**Q: Warning about test-dashboard-core "file:../core"?**
A: Normal for monorepo. Ignore it.

---

## � Pre-Release Checklist

```markdown
- [ ] All PRs merged to develop
- [ ] Changeset created for functional changes
- [ ] npm run version executed
- [ ] Versions synced (server = web = core)
- [ ] CHANGELOG.md updated
- [ ] Git tag created
- [ ] Pushed to develop with tags
- [ ] PR created: develop → main
- [ ] PR merged (n8n deploys automatically)
- [ ] Reporter published to NPM (if changed)
```

---

**Last Updated:** December 3, 2024  
**Document Version:** 3.0.0
