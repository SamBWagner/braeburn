# AGENTS.md
These are non-negotiable coding rules for this repository.
If a rule cannot be followed, document an explicit, justified exception.

- Use meaningful names only.
- Never use abstract placeholders (`a`, `b`, `x`, `'string'`, etc.) in real logic.
- Default to forbidding boolean parameters.
- Prefer two explicit functions over one flag-driven function.
- Allow boolean parameters only when a standard API shape is clearly simpler.
- If a clear concern barrier can exist it ought to be separated clearly. For example: Rendering vs Configuration editing vs Calling for Tool updates
- Keep rendering concerns isolated.
- Renderer/UI code renders state; it does not orchestrate update/business/service work.
- Prefer loose coupling where it helps.
- Favor request/command boundaries over deep direct cross-module calls.
- Do not add event/message infrastructure without a clear, specific payoff.
- Treat complexity as a cost.
- Add libraries or patterns only with concrete, meaningful benefit.
- Everything should be testable.
- Tooling integrations must be testable in isolation.
- If code is not testable, require:
- `WARN: NOT TESTABLE - <reason>. Follow-up: <plan>.`

Decision heuristic:
- Prefer explicitness over cleverness.
- Prefer simpler architecture over more concepts.
- When uncertain, choose the lower-complexity path.
