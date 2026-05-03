import type { ReactNode } from 'react';

export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full w-full flex justify-center md:items-center md:py-6 bg-slate-100">
      <div
        className="
          relative w-full md:w-[420px] md:h-[860px]
          bg-white md:rounded-[44px] md:shadow-[0_30px_80px_-20px_rgba(20,30,80,0.28)]
          overflow-hidden flex flex-col
          ring-1 ring-black/5
        "
        style={{ minHeight: '100dvh' }}
      >
        {children}
      </div>
    </div>
  );
}
