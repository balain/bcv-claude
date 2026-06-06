/**
 * crossRefs.ts — overlay helper that merges built-in cross_refs (bcv.db) with
 * user-added refs (class.db). UI components import from here rather than talking
 * to each database directly.
 */

import { dbClient } from './db';
import type { CrossRef } from './db';
import type { UserCrossRef } from './class/types';
import { BOOK_BY_ID } from './books';

function userRefToBase(u: UserCrossRef): CrossRef {
  const book = BOOK_BY_ID.get(u.targetBookId);
  const bookName = book?.name ?? `Book ${u.targetBookId}`;
  const abbr3 = book?.abbr3 ?? '';
  const label = u.targetVerseEnd
    ? `${bookName} ${u.targetChapter}:${u.targetVerseStart}–${u.targetVerseEnd}`
    : `${bookName} ${u.targetChapter}:${u.targetVerseStart}`;
  return {
    sourceBookId: u.sourceBookId,
    sourceChapter: u.sourceChapter,
    sourceVerse: u.sourceVerse,
    targetBookId: u.targetBookId,
    targetChapter: u.targetChapter,
    targetVerseStart: u.targetVerseStart,
    targetVerseEnd: u.targetVerseEnd,
    targetLabel: label,
    targetAbbr3: abbr3,
    votes: null,
    sourceDataset: 'user',
    userRefId: u.id,
    userNote: u.note,
    createdFrom: u.createdFrom,
  };
}

/** Fetch built-in + user cross-refs for a single verse. */
export async function getCrossRefs(
  bookId: number,
  chapter: number,
  verse: number,
  classClient?: { crossRef: { listBySource(b: number, c: number, v: number): Promise<UserCrossRef[]> } } | null
): Promise<CrossRef[]> {
  const [builtin, user] = await Promise.all([
    dbClient.fetchCrossRefs(bookId, chapter, verse),
    classClient ? classClient.crossRef.listBySource(bookId, chapter, verse).catch(() => []) : Promise.resolve([]),
  ]);
  const userMapped = (user as UserCrossRef[]).map(userRefToBase);
  return [...userMapped, ...builtin];
}

/** Bulk-fetch built-in + user cross-refs for a list of verses. */
export async function getCrossRefsBulk(
  verses: Array<{ bookId: number; chapter: number; verse: number }>,
  classClient?: { crossRef: { listByChapter(b: number, c: number): Promise<UserCrossRef[]> } } | null
): Promise<Map<string, CrossRef[]>> {
  if (verses.length === 0) return new Map();

  // Built-in bulk fetch
  const builtinMap = await dbClient.fetchCrossRefsBulk(verses);

  // User refs: group by (bookId, chapter) to minimize round-trips
  const chapterKeys = new Map<string, { bookId: number; chapter: number }>();
  for (const v of verses) {
    const k = `${v.bookId}:${v.chapter}`;
    if (!chapterKeys.has(k)) chapterKeys.set(k, { bookId: v.bookId, chapter: v.chapter });
  }

  const userByVerse = new Map<string, CrossRef[]>();
  if (classClient) {
    await Promise.all(
      Array.from(chapterKeys.values()).map(async ({ bookId, chapter }) => {
        try {
          const refs = await classClient.crossRef.listByChapter(bookId, chapter);
          for (const u of refs as UserCrossRef[]) {
            const key = `${u.sourceBookId}:${u.sourceChapter}:${u.sourceVerse}`;
            if (!userByVerse.has(key)) userByVerse.set(key, []);
            userByVerse.get(key)!.push(userRefToBase(u));
          }
        } catch { /* class client not ready */ }
      })
    );
  }

  // Merge: user refs first (so they appear at top), then built-in
  const result = new Map<string, CrossRef[]>();
  for (const v of verses) {
    const key = `${v.bookId}:${v.chapter}:${v.verse}`;
    const user = userByVerse.get(key) ?? [];
    const builtin = builtinMap.get(key) ?? [];
    if (user.length > 0 || builtin.length > 0) {
      result.set(key, [...user, ...builtin]);
    }
  }
  return result;
}
