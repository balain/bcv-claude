import type { BibleResult } from '../types';

export const ORDER = [
  'Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut','1Sa','2Sa','1Ki','2Ki','1Ch','2Ch',
  'Ezr','Neh','Est','Job','Psa','Pro','Ecc','Sng','Isa','Jer','Lam','Eze','Dan','Hos',
  'Joe','Amo','Oba','Jon','Mic','Nah','Hab','Zep','Hag','Zec','Mal',
  'Mat','Mar','Luk','Jhn','Act','Rom','1Co','2Co','Gal','Eph','Phl','Col','1Th','2Th',
  '1Ti','2Ti','Tit','Phm','Heb','Jas','1Pe','2Pe','1Jn','2Jn','3Jn','Jud','Rev',
];

export const OT_COUNT = 39;

export function computeDistribution(results: BibleResult[]): number[] {
  const counts = new Array(ORDER.length).fill(0);
  for (const r of results) {
    const idx = ORDER.indexOf(r.bookAbbr);
    if (idx >= 0) counts[idx] += 1;
  }
  return counts;
}
