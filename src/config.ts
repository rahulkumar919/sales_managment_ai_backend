import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(10, { message: 'SUPABASE_SERVICE_ROLE_KEY is required' }),
  GROQ_API_KEY: z.string().min(1, { message: 'GROQ_API_KEY is required' }),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  FRONTEND_ORIGIN: z
    .string()
    .min(1, { message: 'FRONTEND_ORIGIN is required (CORS allow-list)' }),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Print field-level errors without ever printing the secret values
    const messages = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(
      `\n[config] Environment validation failed — fix the following and restart:\n${messages}\n`
    );
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
