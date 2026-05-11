1. **Add `verifyCsrf` check to `/api/discord/link`**
   - The `/api/discord/link` endpoint modifies database state (linking a discord ID to a user member record) but doesn't have the `verifyCsrf(req)` check. This means it is vulnerable to CSRF attacks.
   - I will use `replace_with_git_merge_diff` to add `verifyCsrf` import and check to `dashboard/src/app/api/discord/link/route.ts`.

2. **Add `verifyCsrf` check to `/api/discord/auto-assign`**
   - The `/api/discord/auto-assign` endpoint modifies database state (assigns panel roles, removes members) but doesn't have the `verifyCsrf(req)` check.
   - I will use `replace_with_git_merge_diff` to add `verifyCsrf` import and check to `dashboard/src/app/api/discord/auto-assign/route.ts`.

3. **Verify API fetch requests have `x-pow-request` or `x-csrf-check` header**
   - The `use-discord-role-sync.ts` hook uses standard `fetch` instead of `apiFetch`, meaning it won't automatically include the `x-pow-request` header required by `verifyCsrf`.
   - I'll check `dashboard/src/hooks/use-discord-role-sync.ts` and `dashboard/src/components/auth/role-sync-wrapper.tsx` to add `x-csrf-check: '1'` or `x-pow-request: '1'` to those raw fetch calls.

4. **Update `.jules/sentinel.md` journal**
   - I will append a new learning about Next.js API routes that update state but miss CSRF verification when called from client components.

5. **Run tests & linter**
   - Run `pnpm lint` and `pnpm test` (or `bun test`) in the dashboard folder to ensure code is sound.

6. **Complete pre-commit steps**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
