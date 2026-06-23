import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, User } from '../models/User';
import { Company } from '../models/Company';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  companyName: z.string().min(2).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

function authPayload(user: { _id: unknown; email: string; role: string; companyId?: unknown }) {
  return {
    sub: String(user._id),
    email: user.email,
    role: user.role,
    companyId: user.companyId ? String(user.companyId) : null,
  };
}

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, companyName } = req.body as z.infer<typeof registerSchema>;

    const existing = await User.findOne({ email });
    if (existing) throw ApiError.conflict('Email already registered');

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role: 'admin' });

    const company = await Company.create({ ownerId: user._id, name: companyName });
    user.companyId = company._id;
    await user.save();

    const accessToken = signAccessToken(authPayload(user));
    const refreshToken = signRefreshToken({ sub: String(user._id) });

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: String(company._id),
      },
      company: { id: String(company._id), name: company.name },
    });
  })
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) throw ApiError.unauthorized('Invalid credentials');

    const ok = await user.verifyPassword(password);
    if (!ok) throw ApiError.unauthorized('Invalid credentials');

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = signAccessToken(authPayload(user));
    const refreshToken = signRefreshToken({ sub: String(user._id) });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId ? String(user.companyId) : null,
      },
    });
  })
);

router.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }
    const user = await User.findById(decoded.sub);
    if (!user) throw ApiError.unauthorized('User not found');
    const accessToken = signAccessToken(authPayload(user));
    res.json({ accessToken });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.sub);
    if (!user) throw ApiError.notFound();
    const company = user.companyId ? await Company.findById(user.companyId) : null;
    res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId ? String(user.companyId) : null,
      },
      company: company
        ? { id: String(company._id), ...company.toObject(), _id: undefined, __v: undefined }
        : null,
    });
  })
);

export default router;
