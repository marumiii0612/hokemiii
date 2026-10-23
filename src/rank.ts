export type Rank = 'KEKKAN' | 'SENPAN' | 'IPPAN' | 'MIKAN' | 'BEPPAN' | '任務成功';

export function getRank(cleared: number): Rank {
  if (cleared <= 5) return 'KEKKAN';
  if (cleared <= 10) return 'SENPAN';
  if (cleared <= 15) return 'IPPAN';
  if (cleared <= 20) return 'MIKAN';
  if (cleared <= 30) return 'BEPPAN';
  return '任務成功';
}
