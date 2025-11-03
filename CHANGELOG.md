## 0.2.1 (2025-11-03)

### Fixes
- Unify API base URL resolution for vars/secrets with all other commands; default to production Cloud Run URL.
- Update docs to remove api.vibescheck.io and reflect the Cloud Run default.

## 0.2.0 (2025-11-03)

### Breaking changes
- Required upgrade to 0.2.0 due to server-side API changes. Older CLI versions may fail authentication or return incompatible responses.
- Updated request/response handling to match the latest vibescheck.io API; older DSL fields and legacy endpoints are no longer supported.

### Vars and Secrets Features
- Added `vibe set var <name> <value>` and `vibe get vars` commands for runtime variables.
- Added `vibe set secret <name> <value>`, `vibe get secrets` (names only), and `vibe delete secret <name>` for secure secret management.
- Enforced write-only semantics for secrets; reading individual secret values is intentionally disallowed for security.

### DSL Cleanup
- Normalized evaluation YAML to the unified schema in `@vibecheck/shared` with clearer check types.
- Simplified conditional structure (AND by default, explicit `or:` arrays) and aligned naming for `match`, `not_match`, `min_tokens`, `max_tokens`, `semantic`, and `llm_judge`.
- Deprecated legacy/old-format fields and aliases; schema validation provides actionable errors.

### Runs filtering
- Enhanced `vibe get runs` with filters: `--suite <name>`, `--status <status>`, `--success-gt <n>`, `--time-lt <seconds>`, `--limit`, `--offset`.
- Output streamlined for scanning and piping in CI; consistent pagination defaults.

### Notes
- Requires Node.js 20+ and TypeScript 5.3+.
- If you scripted against pre-0.2.0 outputs, review the new flags and JSON shapes before upgrading CI pipelines.


