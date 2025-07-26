import type { Config } from 'drizzle-kit';

export default {
  schema: './db/schema.ts',
  out: './db',
  dialect: 'sqlite',
  dbCredentials: {
    url: './staging.db',
  },
} satisfies Config;