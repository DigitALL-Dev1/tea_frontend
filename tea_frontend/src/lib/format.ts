export function usd(n: number | undefined, decimals = 0): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return `USD ${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function pct(n: number | undefined, decimals = 1): string {
  return n === undefined || !Number.isFinite(n) ? "—" : `${n.toFixed(decimals)}%`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
