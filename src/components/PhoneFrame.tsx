import type { ReactNode } from 'react';

export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-full flex flex-col bg-white" style={{ minHeight: '100dvh' }}>
      {children}
    </div>
  );
}
