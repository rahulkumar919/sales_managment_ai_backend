import { Router, type Request, type Response } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  // Cheap DB probe with 3-second timeout (TRD 5.7)
  let dbStatus: 'ok' | 'error' = 'error';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const { error } = await supabase
      .from('calls')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);

    dbStatus = error ? 'error' : 'ok';
  } catch {
    dbStatus = 'error';
  } finally {
    clearTimeout(timeout);
  }

  // Always 200 — DB blip must not restart the service (TRD 5.7)
  res.status(200).json({
    status: 'ok',
    service: 'cold-call-companion',
    time: new Date().toISOString(),
    db: dbStatus,
  });
});

export default router;
