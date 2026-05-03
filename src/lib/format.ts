export const formatRp = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `Rp ${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}M`;
  if (abs >= 1000) return `Rp ${Math.round(abs / 1000)}K`;
  return `Rp ${abs}`;
};

export const formatRpFull = (n: number) =>
  `Rp ${Math.abs(n).toLocaleString('id-ID')}`;

export const formatTime = (d: string | Date) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const relativeDay = (d: string | Date) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  if (diff < 1000 * 60 * 60 * 12) return `Today, ${formatTime(date)}`;
  if (diff < 1000 * 60 * 60 * 36) return `Yesterday, ${formatTime(date)}`;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};
