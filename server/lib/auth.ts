import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import { Session } from '../models/Session.ts';
import { User, type UserDoc } from '../models/User.ts';
import { HttpError } from './http.ts';
import { env } from './env.ts';
import type { User as UserDTO } from '../../shared/types.ts';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const COOKIE = 'rs_sid';

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pw, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [saltHex, hashHex] = stored.split(':');
  const hash = await scryptAsync(pw, Buffer.from(saltHex, 'hex'), 64);
  return timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

export async function startSession(res: Response, user: UserDoc) {
  const id = randomBytes(32).toString('base64url');
  await Session.create({ _id: id, user: user._id });
  res.cookie(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.production,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export const toUserDTO = (u: UserDoc): UserDTO => ({ id: String(u._id), username: u.username, tokens: u.tokens });

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDoc;
  }
}

/** Reads the session cookie and attaches req.user (if logged in). */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const sid = req.cookies?.[COOKIE];
  if (sid) {
    const session = await Session.findById(sid).lean();
    if (session) req.user = (await User.findById(session.user).lean<UserDoc>()) ?? undefined;
  }
  next();
}

export function requireUser(req: Request) {
  if (!req.user) throw new HttpError(401, 'Log in om dit te doen');
  return req.user;
}
