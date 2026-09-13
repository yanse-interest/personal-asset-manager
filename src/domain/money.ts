export const MAX_AMOUNT_CENTS = 99_999_999_999;

export function parseYuan(text: string, allowZero = false): number {
  const value = text.trim();
  if (!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) throw new Error('请输入最多两位小数的非负金额');
  const [yuan = '', fraction = ''] = value.split('.');
  const cents = BigInt(yuan) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  if (cents > BigInt(MAX_AMOUNT_CENTS) || (!allowZero && cents === 0n)) throw new Error('金额超出允许范围');
  return Number(cents);
}

export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('金额必须是安全整数分');
  const negative = cents < 0 ? '-' : '';
  const absolute = BigInt(Math.abs(cents));
  return `${negative}¥${(absolute / 100n).toString()}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

export function roundRatioCents(numeratorCents: number, denominator: number): number {
  if (!Number.isSafeInteger(numeratorCents) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error('比率参数无效');
  }
  const magnitude = BigInt(Math.abs(numeratorCents));
  const divisor = BigInt(denominator);
  const rounded = (magnitude + divisor / 2n) / divisor;
  return Number(rounded) * (numeratorCents < 0 ? -1 : 1);
}

export function formatRatio(numeratorCents: number, denominator: number): string {
  return formatCents(roundRatioCents(numeratorCents, denominator));
}
