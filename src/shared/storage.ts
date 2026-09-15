import type { Annotation, PageStore } from './types';

const STORAGE_KEY = 'componentLensAnnotations';

export async function readPageAnnotations(url: string): Promise<Annotation[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const store = (result[STORAGE_KEY] ?? {}) as PageStore;
  return store[url] ?? [];
}

export async function writePageAnnotations(url: string, annotations: Annotation[]): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const store = (result[STORAGE_KEY] ?? {}) as PageStore;
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...store, [url]: annotations },
  });
}
