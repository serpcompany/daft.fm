import type { Config } from 'drizzle-kit';

export default {
  schema: './db/rich-comparison-schema.ts',
  out: './db',
  dialect: 'sqlite',
  dbCredentials: {
    url: './album-comparison-rich.db',
  },
} satisfies Config;