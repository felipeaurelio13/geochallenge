import type { Category, Question } from '../types';

const DB_NAME = 'geochallenge-offline';
const DB_VERSION = 1;
const STORE = 'questions';
const MAX_PER_CATEGORY = 50;
const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

interface StoredQuestion {
  id: string;
  category: Category;
  storedAt: number;
  payload: Question;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('category', 'category');
          store.createIndex('storedAt', 'storedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const resultPromise = Promise.resolve(fn(store));
      tx.oncomplete = async () => {
        const value = await resultPromise;
        resolve(value);
        db.close();
      };
      tx.onerror = () => {
        resolve(null);
        db.close();
      };
      tx.onabort = () => {
        resolve(null);
        db.close();
      };
    } catch {
      resolve(null);
    }
  });
}

export async function cacheQuestions(category: Category, questions: Question[]): Promise<void> {
  if (!questions.length) return;
  const now = Date.now();
  await withStore('readwrite', (store) => {
    questions.forEach((question) => {
      const record: StoredQuestion = {
        id: question.id,
        category: question.category ?? category,
        storedAt: now,
        payload: question,
      };
      store.put(record);
    });

    // Evict beyond MAX_PER_CATEGORY per category (FIFO by storedAt)
    const categoryIndex = store.index('category');
    const cursorReq = categoryIndex.openCursor(IDBKeyRange.only(category));
    const ids: Array<{ id: string; storedAt: number }> = [];
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        const value = cursor.value as StoredQuestion;
        ids.push({ id: value.id, storedAt: value.storedAt });
        cursor.continue();
      } else {
        ids.sort((a, b) => a.storedAt - b.storedAt);
        const excess = Math.max(0, ids.length - MAX_PER_CATEGORY);
        for (let i = 0; i < excess; i += 1) {
          store.delete(ids[i].id);
        }
      }
    };
  });
}

export async function getCachedQuestions(
  category: Category,
  count: number
): Promise<Question[]> {
  const result = await withStore<Question[]>('readonly', (store) =>
    new Promise<Question[]>((resolve) => {
      const questions: Question[] = [];
      const categoryIndex = store.index('category');
      const now = Date.now();
      const keyRange =
        category === 'MIXED' ? undefined : IDBKeyRange.only(category);
      const cursorReq = (keyRange ? categoryIndex.openCursor(keyRange) : store.openCursor());
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const value = cursor.value as StoredQuestion;
          if (now - value.storedAt <= TTL_MS) {
            questions.push(value.payload);
          }
          cursor.continue();
        } else {
          resolve(questions);
        }
      };
      cursorReq.onerror = () => resolve([]);
    })
  );

  const pool = result ?? [];
  if (pool.length <= count) return pool;
  // random sample without dupes
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

const PENDING_KEY = 'geochallenge:pending-offline-sessions';

export interface PendingOfflineSession {
  category: Category;
  answers: Array<{
    questionId: string;
    answer: string;
    timeRemaining: number;
    coordinates?: { lat: number; lng: number };
  }>;
  finishedAt: number;
}

export function enqueuePendingSession(session: PendingOfflineSession): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const queue: PendingOfflineSession[] = raw ? JSON.parse(raw) : [];
    queue.push(session);
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(queue.slice(-10)));
  } catch {
    // noop
  }
}

export function drainPendingSessions(): PendingOfflineSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const queue: PendingOfflineSession[] = raw ? JSON.parse(raw) : [];
    window.localStorage.removeItem(PENDING_KEY);
    return queue;
  } catch {
    return [];
  }
}

export async function countCachedForCategory(category: Category): Promise<number> {
  const questions = await getCachedQuestions(category, MAX_PER_CATEGORY);
  return questions.length;
}
