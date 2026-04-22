# Assistant Commands

This repo includes a lightweight “slash command” convention you can use in any new chat to quickly load a high-signal snapshot of the codebase.

## /explore

Goal: produce and read a single, shareable file that summarizes the repository structure and key entrypoints without dumping full source.

### What to run locally

```bash
npm run explore
```

This generates:

- `CODEBASE_CONTEXT.md` (committable if you want, but optional)

### What to say in a new chat

Paste this into a new chat:

```
/explore

1) Run `npm run explore`
2) Read `CODEBASE_CONTEXT.md`
3) Confirm the stack, entrypoints, and tool surface area before making changes
```

## /explore-deep

Goal: go beyond the snapshot when you need richer context.

In a new chat, after `/explore`, ask for any of:

- “Scan how tools are registered and how schemas are defined”
- “Map all Trading212 API endpoints and where they are called”
- “Summarize error handling and retry logic paths”
- “Find where auth headers are added and where live vs demo mode is decided”

These are good candidates for splitting into focused sub-tasks (API client, tool surface, types/schemas, error utilities) rather than reading every file line-by-line.

