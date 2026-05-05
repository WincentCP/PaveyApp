import type { ReactNode } from 'react';

export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-950 flex justify-center items-start">
      <div
        className="w-full flex flex-col bg-white relative overflow-hidden"
        style={{ maxWidth: 430, minHeight: '100dvh', boxShadow: '0 0 60px rgba(0,0,0,0.5)' }}
      >
        {children}
      </div>
    </div>
  );
}
