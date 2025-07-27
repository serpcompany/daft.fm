# Drizzle Studio Usage

## Correct Syntax

To launch Drizzle Studio with a specific database:

```bash
npx drizzle-kit studio --config ./[CONFIG_FILE_NAME].config.ts
```

## Examples

```bash
# For the staging database
npx drizzle-kit studio --config ./drizzle.config.ts

# For the album comparison database
npx drizzle-kit studio --config ./drizzle-comparison.config.ts

# For the rich album comparison database
npx drizzle-kit studio --config ./drizzle-rich.config.ts
```

## Config File Structure

Each config file should export a configuration object:

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './db',
  dialect: 'sqlite',
  dbCredentials: {
    url: './database.db',
  },
} satisfies Config;
```