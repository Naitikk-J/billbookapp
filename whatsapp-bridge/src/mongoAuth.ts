import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { MongoClient, type Collection } from 'mongodb';

/**
 * MongoDB-backed Baileys AuthenticationState.
 *
 * Persists the WhatsApp multi-device session (credentials + signal keys) to a
 * single Mongo collection so cold-booted containers on ephemeral-disk hosts
 * (Render free tier, Fly machines w/o volumes) can restore the session and
 * reconnect to WhatsApp WITHOUT a fresh QR scan.
 *
 * Documents look like: { _id: "<category>-<id>", json: "<baileys-encoded>", updatedAt }
 * where category is either "creds" (single row) or one of the signal key
 * categories: "pre-key", "session", "sender-key", "sender-key-memory",
 * "app-state-sync-key", "app-state-sync-version".
 *
 * We store the payload as a pre-serialized JSON string using Baileys'
 * BufferJSON replacer/reviver so Buffers survive the round-trip.
 */

interface AuthDocument {
  _id: string;
  json: string;
  updatedAt: Date;
}

export interface MongoAuthHandle {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  /** Delete every session document — call after a WhatsApp-side logout. */
  clear: () => Promise<void>;
  /** Close the Mongo client. Call on process shutdown. */
  close: () => Promise<void>;
}

export async function useMongoAuthState(
  mongoUri: string,
  collectionName = 'whatsapp_session'
): Promise<MongoAuthHandle> {
  const client = new MongoClient(mongoUri, {
    // Small pool — this is a single-user bridge, no need for concurrency.
    maxPoolSize: 4,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();

  const coll: Collection<AuthDocument> = client
    .db()
    .collection<AuthDocument>(collectionName);

  const readDoc = async (id: string): Promise<unknown> => {
    const doc = await coll.findOne({ _id: id });
    if (!doc?.json) return null;
    return JSON.parse(doc.json, BufferJSON.reviver);
  };

  const writeDoc = async (id: string, value: unknown): Promise<void> => {
    if (value == null) {
      await coll.deleteOne({ _id: id });
      return;
    }
    const json = JSON.stringify(value, BufferJSON.replacer);
    await coll.updateOne(
      { _id: id },
      { $set: { json, updatedAt: new Date() } },
      { upsert: true }
    );
  };

  // Restore (or initialise) creds.
  const stored = (await readDoc('creds')) as AuthenticationCreds | null;
  const creds: AuthenticationCreds = stored ?? initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const result: Record<string, unknown> = {};
        await Promise.all(
          ids.map(async (id) => {
            let value = await readDoc(`${type}-${id}`);
            if (value && type === 'app-state-sync-key') {
              // Baileys expects app-state-sync-key as a protobuf message.
              value = proto.Message.AppStateSyncKeyData.fromObject(
                value as never
              );
            }
            result[id] = value;
          })
        );
        return result as { [id: string]: SignalDataTypeMap[typeof type] };
      },
      set: async (data) => {
        const tasks: Promise<void>[] = [];
        for (const category of Object.keys(data) as (keyof typeof data)[]) {
          const entries = data[category];
          if (!entries) continue;
          for (const id of Object.keys(entries)) {
            const value = (entries as Record<string, unknown>)[id];
            tasks.push(writeDoc(`${category}-${id}`, value ?? null));
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  const saveCreds = async (): Promise<void> => {
    await writeDoc('creds', creds);
  };

  const clear = async (): Promise<void> => {
    await coll.deleteMany({});
  };

  const close = async (): Promise<void> => {
    await client.close().catch(() => undefined);
  };

  return { state, saveCreds, clear, close };
}
