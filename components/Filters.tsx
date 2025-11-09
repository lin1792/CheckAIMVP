'use client';

import clsx from 'clsx';
import type { Verification } from '@/lib/schemas';

type Props = {
  selected: Verification['label'][];
  onToggle: (label: Verification['label']) => void;
  onClear: () => void;
  stats: Record<Verification['label'], number>;
};

const order: Verification['label'][] = ['SUPPORTED', 'REFUTED', 'DISPUTED', 'INSUFFICIENT'];
const labelMap: Record<Verification['label'], string> = {
  SUPPORTED: '支持',
  REFUTED: '驳斥',
  DISPUTED: '存争议',
  INSUFFICIENT: '证据不足'
};

export default function Filters({ selected, onToggle, onClear, stats }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClear}
        className={clsx(
          'rounded-full border px-3 py-1 text-xs font-medium',
          selected.length === 0
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-slate-200 text-slate-500 hover:border-accent'
        )}
      >
        全部
      </button>
      {order.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onToggle(label)}
          className={clsx(
            'rounded-full border px-3 py-1 text-xs font-medium transition',
            selected.includes(label)
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-slate-200 text-slate-500 hover:border-accent'
          )}
        >
          {labelMap[label]} · {stats[label] ?? 0}
        </button>
      ))}
    </div>
  );
}
