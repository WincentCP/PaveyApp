import React from 'react';
import { computeIntentBanners, type MajorBannerKey, type SecondaryBannerKey } from '../lib/planValidation';
import type { Region } from '../data/regions';
import { COPY } from '../lib/copy';

export function IntentBanners({
  durationDays, destinationNames, onKeepOnlyRegion,
}: {
  durationDays: number;
  destinationNames: string[];
  onKeepOnlyRegion: (region: Region) => void;
}) {
  const { major, secondary } = computeIntentBanners({ durationDays, destinationNames });
  if (!major && !secondary) return null;

  return (
    <>
      {major && (
        <BannerShell tone="amber">
          <MajorBannerBody banner={major} onKeepOnlyRegion={onKeepOnlyRegion} />
        </BannerShell>
      )}
      {secondary && (
        <BannerShell tone="amberLight">
          <SecondaryBannerBody banner={secondary} />
        </BannerShell>
      )}
    </>
  );
}

function BannerShell({ tone, children }: { tone: 'amber' | 'amberLight'; children: React.ReactNode }) {
  const cls = tone === 'amber'
    ? 'bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5'
    : 'bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2';
  return <div className={cls}>{children}</div>;
}

function MajorBannerBody({
  banner, onKeepOnlyRegion,
}: {
  banner: NonNullable<ReturnType<typeof computeIntentBanners>['major']>;
  onKeepOnlyRegion: (region: Region) => void;
}) {
  const { key, primaryRegion, vars } = banner;
  const { days, regions } = vars;

  const copy: Record<MajorBannerKey, string> = {
    'chaos-regions': COPY.banners.chaosRegions(regions, days),
    'chaos-cities': COPY.banners.chaosCities(primaryRegion ?? 'one region'),
    'duration-over-20': COPY.banners.durationOver20,
    'ratio-under-1': COPY.banners.ratioUnder1,
  };
  const showKeepOnly = (key === 'chaos-regions' || key === 'chaos-cities') && primaryRegion;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-amber-800">
        {copy[key]}
      </div>
      {showKeepOnly && (
        <button
          onClick={() => onKeepOnlyRegion(primaryRegion!)}
          className="self-start text-xs font-bold text-brand-700 bg-white border border-amber-300 px-3 py-1 rounded-full press"
        >
          Keep only {primaryRegion}
        </button>
      )}
    </div>
  );
}

function SecondaryBannerBody({
  banner,
}: {
  banner: NonNullable<ReturnType<typeof computeIntentBanners>['secondary']>;
}) {
  const copy: Record<SecondaryBannerKey, string> = {
    'duration-14-20': COPY.banners.duration1420,
    'ratio-1-to-2': COPY.banners.ratio1to2,
  };
  return <div className="text-xs text-amber-700">{copy[banner.key]}</div>;
}
