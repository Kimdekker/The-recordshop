import mongoose from 'mongoose';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { env } from './env.ts';

/**
 * Connects to MONGODB_URI, or — in development without a URI — starts an
 * embedded MongoDB that keeps its data in .data/db between restarts.
 */
export async function connectDb() {
  let uri = env.mongoUri;
  if (!uri) {
    if (env.production) throw new Error('MONGODB_URI is verplicht in productie');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = path.resolve(import.meta.dirname, '../../.data/db');
    await mkdir(dbPath, { recursive: true });
    const server = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger', port: 27027 },
    });
    uri = server.getUri('recordshop');
    const stop = async () => {
      await mongoose.disconnect();
      await server.stop({ doCleanup: false });
      process.exit(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    console.log(`[db] ingebouwde MongoDB in .data/db`);
  }
  await mongoose.connect(uri);
  console.log('[db] verbonden');
}
