import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  right?: React.ReactNode;
  sub?: string;
}

export default function PageHeader({ icon: Icon, title, right, sub }: Props) {
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-5 h-5 text-brand-500 shrink-0" />
        <div className="min-w-0">
          <span className="font-bold text-ink-900 text-lg font-display">{title}</span>
          {sub && <div className="text-xs text-ink-500 leading-tight truncate">{sub}</div>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}
