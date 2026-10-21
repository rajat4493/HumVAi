# Repository preservation status

**Gate status: NOT satisfied on GitHub.** `git push` to `rajat4493/HumVAi` is refused (HTTP 403, "Claude doesn't have GitHub access to rajat4493/HumVAi for your organization") and has been retried in every session turn. `git ls-remote origin` also fails. The remote therefore holds nothing from this work.

What exists outside the container: the files I delivered into the chat (below). I cannot verify that you saved them; please confirm.

| Artifact | Contents | SHA-256 |
|---|---|---|
| `humans-vs-ai-m0-corrected-a65f405.zip` | Tracked files of commit `a65f405`: source, lockfile, tests, docs, screenshots (22), recordings (2) | `1d6bd9d8df040846ec1c54f4b926928a83da6c47135dad7748ae4c1ee48dd3c3` |
| `humans-vs-ai-m0-corrected-a65f405.bundle` | Same repository with full history (2 commits) | `c0e9b7414e7d9cd3f8099de3a87e6eed48497644833427885ed62965738b3172` |
| `humans-vs-ai-m0-ea3e9d8.zip` | Earlier snapshot (first M0 commit) | (superseded) |

The ZIP was restore-tested: unzipped to a clean directory, `npm ci`, typecheck, 47 unit tests and level verification all passed.

Restore:
```bash
git clone humans-vs-ai-m0-corrected-a65f405.bundle humans-vs-ai   # full history
# or: unzip humans-vs-ai-m0-corrected-a65f405.zip && cd humans-vs-ai
npm ci && npm run check
```

To fix GitHub: connect at https://claude.ai/connect-github and install the Claude GitHub App on `rajat4493/HumVAi` (or ask an organization owner). Then tell me and I will push the branch `claude/humans-vs-ai-plan-fz5yq0`.

Documentation-only commits made after `a65f405` (this gate) are included in the newest archive named in `docs/M1-PREP-HANDOVER.md`.
