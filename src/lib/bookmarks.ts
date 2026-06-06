import type { Bookmark } from '../types';

const KEY = 'bcv-bookmarks';

export function loadBookmarks(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: Bookmark[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(bookmarks));
  } catch {
    /* quota */
  }
}
