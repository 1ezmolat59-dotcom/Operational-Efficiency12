import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineQueueItem } from '../types';

const QUEUE_KEY = 'offline_queue';
const MAX_QUEUE_SIZE = 50;

export async function getQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as OfflineQueueItem[];
  } catch {
    return [];
  }
}

export async function saveQueue(items: OfflineQueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Storage write failed — silently fail (best-effort offline queue)
  }
}

export async function addItem(
  item: OfflineQueueItem,
): Promise<{ success: boolean; atMaxCapacity: boolean }> {
  const queue = await getQueue();

  if (queue.length >= MAX_QUEUE_SIZE) {
    return { success: false, atMaxCapacity: true };
  }

  // Deduplicate by id
  const exists = queue.some((q) => q.id === item.id);
  if (exists) {
    return { success: true, atMaxCapacity: false };
  }

  queue.push(item);
  await saveQueue(queue);
  return { success: true, atMaxCapacity: false };
}

export async function removeItem(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.filter((item) => item.id !== id);
  await saveQueue(updated);
}

export async function incrementRetries(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.map((item) =>
    item.id === id ? { ...item, retries: item.retries + 1 } : item,
  );
  await saveQueue(updated);
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function getQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
