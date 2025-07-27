import type { Config } from 'drizzle-kit';

export default {
  schema: './db/comparison-schema.ts',
  out: './db',
  dialect: 'sqlite',
  dbCredentials: {
    url: './album-comparison.db',
  },
} satisfies Config;