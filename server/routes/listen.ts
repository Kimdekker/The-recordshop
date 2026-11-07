import { Router } from 'express';
import { Types } from 'mongoose';
import { Album, type AlbumDoc } from '../models/Album.ts';
import { Listen, type ListenDoc } from '../models/Listen.ts';
import { User } from '../models/User.ts';
import { requireUser } from '../lib/auth.ts';
import { HttpError, route } from '../lib/http.ts';
import { MIN_COVERAGE, payout, rewardFor } from '../lib/tokens.ts';
import { getOrImportAlbum } from '../lib/youtube.ts';
import type { ListenResult, ListenStart } from '../../shared/types.ts';

export const listen = Router();

/**
 * Counts how many seconds were "naturally" heard since the previous
 * heartbeat. Playback is natural when the position advanced no more than
 * the time that actually passed — needle jumps don't count.
 */
function accrue(session: ListenDoc, album: AlbumDoc, track: number, position: number, now: Date) {
  const last = session.last;
  let heard = 0;
  let seek = false;
  if (last) {
    const wall = (now.getTime() - new Date(last.at).getTime()) / 1000 + 2; // 2 s tolerance
    if (track === last.track) {
      const d = position - last.position;
      if (d >= -1 && d <= wall) heard = Math.max(0, d);
      else seek = true;
    } else if (track === last.track + 1) {
      const rest = (album.tracks[last.track]?.duration ?? 0) - last.position;
      const d = rest + position;
      if (rest >= -2 && d <= wall) heard = Math.max(0, d);
      else seek = true;
    } else {
      seek = true;
    }
  }
  return { heard, seek };
}

function readBeat(body: any, album: AlbumDoc) {
  const track = Number(body?.track);
  const position = Number(body?.position);
  if (!Number.isInteger(track) || track < 0 || track >= album.tracks.length) throw new HttpError(400, 'Invalid track');
  if (!Number.isFinite(position) || position < 0) throw new HttpError(400, 'Invalid position');
  return { track, position: Math.min(position, album.tracks[track].duration) };
}

async function loadSession(id: string, userId: Types.ObjectId) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Session not found');
  const session = await Listen.findOne({ _id: id, user: userId, ended: false }).lean<ListenDoc>();
  if (!session) throw new HttpError(404, 'This listening session has ended');
  const album = await Album.findById(session.album).lean<AlbumDoc>();
  if (!album) throw new HttpError(404, 'Album not found');
  return { session, album };
}

/** Put the record on: starts a new listen session. */
listen.post(
  '/',
  route(async (req, res) => {
    const user = requireUser(req);
    const album = await getOrImportAlbum(String(req.body?.albumId ?? ''));
    // One turntable at a time: earlier open sessions are closed.
    await Listen.updateMany({ user: user._id, ended: false }, { $set: { ended: true } });
    const isRepeat = Boolean(await Listen.exists({ user: user._id, album: album._id, finishedAt: { $ne: null } }));
    const reward = rewardFor(album.rarity);
    const potentialTokens = isRepeat ? reward.repeat : reward.first;
    const session = await Listen.create({ user: user._id, album: album._id, isRepeat, potentialTokens });
    const body: ListenStart = { sessionId: String(session._id), isRepeat, potentialTokens };
    res.status(201).json(body);
  }),
);

/** Heartbeat from the player (every ~10 s, and right before/after a needle jump). */
listen.post(
  '/:id/beat',
  route(async (req, res) => {
    const user = requireUser(req);
    const { session, album } = await loadSession(req.params.id, user._id);
    const { track, position } = readBeat(req.body, album);
    const now = new Date();
    const { heard, seek } = accrue(session, album, track, position, now);
    const total = Math.min(album.totalDuration, session.heard + heard);
    await Listen.updateOne(
      { _id: session._id },
      { $set: { heard: total, last: { at: now, track, position } }, $inc: { seeks: seek ? 1 : 0 } },
    );
    res.json({ heard: Math.round(total), coverage: total / album.totalDuration });
  }),
);

/** Record is done (or the listener stops): settle the tokens. */
listen.post(
  '/:id/finish',
  route(async (req, res) => {
    const user = requireUser(req);
    const { session, album } = await loadSession(req.params.id, user._id);
    const now = new Date();
    let heardTotal = session.heard;
    if (req.body?.track !== undefined) {
      const { track, position } = readBeat(req.body, album);
      heardTotal = Math.min(album.totalDuration, heardTotal + accrue(session, album, track, position, now).heard);
    }
    const coverage = heardTotal / album.totalDuration;
    const qualified = coverage >= MIN_COVERAGE;
    const tokensAwarded = payout(session.potentialTokens, coverage);

    // ended:false in the filter makes this idempotent: pay out only once.
    const closed = await Listen.findOneAndUpdate(
      { _id: session._id, ended: false },
      { $set: { ended: true, heard: heardTotal, coverage, tokensAwarded, finishedAt: qualified ? now : null } },
    );
    if (!closed) throw new HttpError(409, 'This session has already been settled');

    let balance = user.tokens;
    if (qualified) {
      const [updated] = await Promise.all([
        User.findByIdAndUpdate(user._id, { $inc: { tokens: tokensAwarded } }, { new: true }).lean(),
        Album.updateOne({ _id: album._id }, { $inc: { listenCount: 1 }, $set: { lastListenedAt: now } }),
      ]);
      balance = updated?.tokens ?? balance;
    }
    const body: ListenResult = {
      coverage,
      tokensAwarded,
      potentialTokens: session.potentialTokens,
      qualified,
      balance,
    };
    res.json(body);
  }),
);
