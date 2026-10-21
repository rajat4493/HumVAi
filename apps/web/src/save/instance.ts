import { useSyncExternalStore } from 'react';
import { SaveStore } from './store';
import type { SaveData } from './types';

/** One save per tab. Components read it through useSave() and write through store.set(). */
export const store = new SaveStore();

export function useSave(): SaveData {
  return useSyncExternalStore(store.subscribe, store.get);
}
