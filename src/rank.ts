export type Rank = 'KEKKAN' | 'SENPAN' | 'IPPAN' | 'BEPPAN';

export function getRank(cleared: number): Rank {
  if (cleared <= 10) return 'KEKKAN';
  if (cleared <= 20) return 'SENPAN';
  if (cleared <= 30) return 'IPPAN';
  return 'BEPPAN';
}
