import { Router } from 'express';
import { User } from '../models/User.ts';
import { Session } from '../models/Session.ts';
import { COOKIE, hashPassword, startSession, toUserDTO, verifyPassword } from '../lib/auth.ts';
import { HttpError, route } from '../lib/http.ts';

export const auth = Router();

function credentials(body: any) {
  const username = String(body?.username ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!/^[a-z0-9_.-]{3,24}$/.test(username))
    throw new HttpError(400, 'Username: 3–24 characters, letters, numbers, periods, hyphens, or underscores.');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
  return { username, password };
}

auth.post(
  '/register',
  route(async (req, res) => {
    const { username, password } = credentials(req.body);
    if (await User.exists({ username })) throw new HttpError(409, 'That username is already taken.');
    const user = await User.create({ username, passwordHash: await hashPassword(password) });
    await startSession(res, user);
    res.status(201).json({ user: toUserDTO(user) });
  }),
);

auth.post(
  '/login',
  route(async (req, res) => {
    const { username, password } = credentials(req.body);
    const user = await User.findOne({ username });
    if (!user || !(await verifyPassword(password, user.passwordHash)))
      throw new HttpError(401, 'Incorrect username or password.');
    await startSession(res, user);
    res.json({ user: toUserDTO(user) });
  }),
);

auth.post(
  '/logout',
  route(async (req, res) => {
    const sid = req.cookies?.[COOKIE];
    if (sid) await Session.deleteOne({ _id: sid });
    res.clearCookie(COOKIE, { path: '/' }).json({ ok: true });
  }),
);

auth.get('/me', (req, res) => {
  res.json({ user: req.user ? toUserDTO(req.user) : null });
});
