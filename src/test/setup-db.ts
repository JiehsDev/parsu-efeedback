// src/test/setup-db.ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer;

export async function connectTestDb() {
  // Optional local-only override for ephemeral test databases on low-space machines.
  // Production MongoDB settings are never changed by this harness.
  const minDisk = process.env.MONGO_TEST_MIN_DISK_MB;
  if (minDisk && (!/^\d+$/.test(minDisk) || Number(minDisk) < 64))
    throw new Error("MONGO_TEST_MIN_DISK_MB must be at least 64.");
  mongod = await MongoMemoryServer.create(
    minDisk
      ? { instance: { args: ["--setParameter", `indexBuildMinAvailableDiskSpaceMB=${minDisk}`] } }
      : {},
  );
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function disconnectTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}

export async function clearTestDb() {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}
