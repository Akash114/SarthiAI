# Decision record policy

This is an in-repo copy of the **Decision Record Policy** from the Sarthi program reference so links from `docs/` work for contributors who do not have local Cursor plan files (`.cursor/` is not tracked in git).

Any deviation from frozen product scope, public API contracts, or analytics taxonomy must include:

1. **Decision summary** — what changed and what stays the same.
2. **Rationale and alternatives considered** — why this option won.
3. **Impact on Android-first timeline** — schedule, scope, or risk effects.
4. **Migration / rollback implications** — data, clients, ops, and comms.

If a change conflicts with the frozen program intent until that intent is explicitly updated, **the frozen docs and contracts in `docs/` remain the default** for implementation.

For the full program vision and roadmap context, maintainers may keep an authoritative copy outside git or in maintainer-only storage; this file only captures the **change-control bar**.
