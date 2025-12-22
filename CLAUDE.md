# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun dev           # Start dev server at localhost:3000
bun run build     # Production build
bun run lint      # Run ESLint

# Database (Prisma)
bun prisma generate    # Generate Prisma client (outputs to prisma/generated/)
bun prisma migrate dev # Run migrations in development
bun prisma studio      # Open Prisma Studio
```

## Architecture

This is a Next.js 16 application using the App Router with:
- **React 19** with Server Components
- **Tailwind CSS v4** (via PostCSS)
- **Prisma 7** with Neon PostgreSQL adapter
- **TypeScript** with strict mode

### Key Directories

- `app/` - Next.js App Router pages and layouts
- `prisma/` - Database schema and generated client
  - `schema.prisma` - Database schema (generates to `prisma/generated/`)
  - `prisma.ts` - Singleton Prisma client instance with Neon adapter

### Path Alias

Use `~/` to import from project root (configured in tsconfig.json):
```typescript
import { env } from "~/env";
import prisma from "~/prisma/prisma";
```

### Environment Variables

Environment validation uses `@t3-oss/env-nextjs` with Zod in `env.ts`.

**Adding new server variables:** Add to the `server` object with Zod validation - they are automatically spread to `runtimeEnv`.

**Adding new client variables:** Must be added both to the `client` object AND manually to `runtimeEnv`:
```typescript
client: {
  NEXT_PUBLIC_APP_URL: z.string().url(),
},
runtimeEnv: {
  ...env,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
},
```

**Using env in code:**
```typescript
import { env } from "~/env";

export const GET = async () => {
  const response = await fetch("...", {
    headers: { Authorization: env.OPEN_AI_API_KEY },
  });
  // ...
};
```

### Code Formatting

Pre-commit hook runs `pretty-quick --staged` via bun. Prettier uses `prettier-plugin-tailwindcss` for class sorting.
