import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import {
  startCallBody,
  stageParams,
  callIdParam,
  saveStageBody,
  reachBody,
  closeBody,
} from '../schemas.js';
import {
  insertCall,
  listCalls,
  getCallById,
  getStageResults,
  upsertStageResult,
  reachStage,
  requireOpenCall,
  closeCall,
} from '../services/calls.js';
import { generateSummary } from '../services/summary.js';

const router = Router();

// ─── Rate limit for the summary endpoint (10 req/min/IP, TRD Section 9) ──────
const summaryRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many summary requests. Try again in a minute.' } },
});

// ─── Async wrapper — passes thrown errors to Express error middleware ─────────
function wrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// ─── POST /api/calls ──────────────────────────────────────────────────────────
router.post(
  '/',
  wrap(async (req, res) => {
    const body = startCallBody.parse(req.body);
    const call = await insertCall(body);
    res.status(201).json(call);
  })
);

// ─── GET /api/calls ───────────────────────────────────────────────────────────
router.get(
  '/',
  wrap(async (_req, res) => {
    const calls = await listCalls();
    res.status(200).json({ calls });
  })
);

// ─── GET /api/calls/:id ───────────────────────────────────────────────────────
router.get(
  '/:id',
  wrap(async (req, res) => {
    const { id } = callIdParam.parse(req.params);
    const call = await getCallById(id);
    const stage_results = await getStageResults(id);
    res.status(200).json({ call, stage_results });
  })
);

// ─── PUT /api/calls/:id/stages/:n ────────────────────────────────────────────
router.put(
  '/:id/stages/:n',
  wrap(async (req, res) => {
    const { id, n } = stageParams.parse(req.params);
    const call = await getCallById(id);

    if (call.ended_at) {
      res.status(409).json({ error: { code: 'CALL_CLOSED', message: 'This call has already been closed.' } });
      return;
    }

    const body = saveStageBody.parse(req.body);

    // Upsert stage result (option key validation happens inside)
    const result = await upsertStageResult({
      call_id: id,
      stage_number: n,
      option_key: body.option_key,
      prospect_words: body.prospect_words,
    });

    // Raise last_stage_reached if needed
    await reachStage(id, n);

    // Return the stage result (SaveStageBody response shape matches StageResult)
    res.status(200).json(result);
  })
);

// ─── POST /api/calls/:id/reach ───────────────────────────────────────────────
router.post(
  '/:id/reach',
  wrap(async (req, res) => {
    const { id } = callIdParam.parse(req.params);
    const { stage_number } = reachBody.parse(req.body);

    await requireOpenCall(id); // 404 or 409 if closed
    await reachStage(id, stage_number);
    const updatedCall = await getCallById(id);
    res.status(200).json(updatedCall);
  })
);

// ─── POST /api/calls/:id/close ───────────────────────────────────────────────
router.post(
  '/:id/close',
  wrap(async (req, res) => {
    const { id } = callIdParam.parse(req.params);
    await requireOpenCall(id); // 404 or 409 if already closed

    const body = closeBody.parse(req.body);
    const updatedCall = await closeCall(id, {
      outcome: body.outcome,
      next_action: body.next_action ?? null,
      follow_up_at: body.follow_up_at ?? null,
      follow_up_channel: body.follow_up_channel ?? null,
      closing_notes: body.closing_notes ?? null,
    });

    res.status(200).json(updatedCall);
  })
);

// ─── POST /api/calls/:id/summary ─────────────────────────────────────────────
router.post(
  '/:id/summary',
  summaryRateLimit,
  wrap(async (req, res) => {
    const { id } = callIdParam.parse(req.params);
    const force = req.query['force'] === 'true';

    const result = await generateSummary(id, force);
    res.status(200).json(result);
  })
);

export default router;
