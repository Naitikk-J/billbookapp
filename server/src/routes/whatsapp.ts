import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireCompany } from '../middleware/auth';
import {
  fetchStatus,
  getConfigStatus,
  logout,
} from '../services/whatsappBridge';

const router = Router();
router.use(requireAuth, requireCompany);

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const cfg = getConfigStatus();
    if (!cfg.configured) {
      res.json({
        configured: false,
        reason: cfg.reason,
        status: null,
      });
      return;
    }
    try {
      const status = await fetchStatus();
      res.json({ configured: true, status });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.json({
        configured: true,
        status: null,
        unreachable: true,
        reason: message,
      });
    }
  })
);

router.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    await logout();
    res.json({ ok: true });
  })
);

export default router;
