/**
 * MongoDB/Mongoose connection singleton.
 *
 * Two problems this solves:
 *   1. Serverless: every route handler invocation could otherwise open a
 *      fresh connection, quickly exhausting Atlas M0's shared connection
 *      limit. We cache the connection (and in-flight connect promise) on
 *      `global` so warm invocations reuse it.
 *   2. Next.js dev hot-reload: without the `global` cache, editing a file
 *      that imports this module would spawn a new connection on every
 *      save.
 *
 * Usage (starting Phase 6+, wherever a model is queried):
 *   import { connectToDatabase } from "@/lib/db";
 *   await connectToDatabase();
 *   const user = await User.findOne({ email });
 *
 * No business logic here — connection management only.
 */

import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.__mongooseCache ?? {
  conn: null,
  promise: null,
};
global.__mongooseCache = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    mongoose.set("strictQuery", true);

    cache.promise = mongoose
      .connect(env.MONGODB_URI, {
        bufferCommands: false,
      })
      .then((connection) => {
        logger.info("MongoDB connected");
        return connection;
      })
      .catch((error) => {
        // Clear the cached promise on failure so the next call retries
        // instead of permanently returning a rejected promise.
        cache.promise = null;
        logger.error("MongoDB connection failed", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
    cache.conn = null;
    cache.promise = null;
    logger.info("MongoDB disconnected");
  }
}
