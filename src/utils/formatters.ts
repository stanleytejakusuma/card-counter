export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatTrueCount(tc: number): string {
  const sign = tc >= 0 ? '+' : '';
  return `${sign}${tc.toFixed(1)}`;
}

export function formatElapsedTime(startMs: number): string {
  const elapsed = Date.now() - startMs;
  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatOutcome(outcome: string): string {
  switch (outcome) {
    case 'win': return 'W';
    case 'loss': return 'L';
    case 'push': return 'P';
    case 'blackjack': return 'BJ';
    case 'surrender': return 'SR';
    case 'even_money': return 'EM';
    default: return outcome;
  }
}
