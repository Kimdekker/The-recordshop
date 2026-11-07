import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { env } from './lib/env.ts';
import { connectDb } from './lib/db.ts';
import { loadUser } from './lib/auth.ts';
import { HttpError } from './lib/http.ts';
import { auth } from './routes/auth.ts';
import { albums } from './routes/albums.ts';
import { listen } from './routes/listen.ts';
import { me } from './routes/me.ts';

await connectDb();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

app.get('/api/status', (_req, res) => res.json({ hasKey: Boolean(env.youtubeKey) }));
app.use('/api', (req, res, next) => loadUser(req, res, next).catch(next));
app.use('/api/auth', auth);
app.use('/api/albums', albums);
app.use('/api/listen', listen);
app.use('/api/me', me);
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Onbekend endpoint')));

if (env.production) {
  const dist = path.resolve(import.meta.dirname, '../dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({ error: status >= 500 && !(err instanceof HttpError) ? 'Er ging iets mis op de server' : err.message });
});

app.listen(env.port, () => {
  console.log(`[api] luistert op http://localhost:${env.port}${env.youtubeKey ? '' : ' — LET OP: geen YOUTUBE_API_KEY'}`);
});
