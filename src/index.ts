import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`[server] Cold-Call Companion backend running on port ${config.PORT}`);
  console.log(`[server] Environment: ${config.NODE_ENV}`);
  console.log(`[server] CORS allowed origin: ${config.FRONTEND_ORIGIN}`);
  console.log(`[server] Groq model: ${config.GROQ_MODEL}`);
});
