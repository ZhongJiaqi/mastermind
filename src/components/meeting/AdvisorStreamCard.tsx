import { motion } from 'motion/react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { stripMetaBlock } from '../../lib/meta';
import type { AdvisorRound } from '../../types/session';

interface Props {
  round: AdvisorRound;
  onRetry?: () => void;
}

export function AdvisorStreamCard({ round, onRetry }: Props) {
  const display = stripMetaBlock(round.content);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-stone-200 rounded-2xl bg-white p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-stone-900">{round.advisorName}</div>
        {round.status === 'streaming' && (
          <Loader2 size={16} className="animate-spin text-stone-400" />
        )}
        {round.status === 'error' && (
          <button onClick={onRetry} className="text-xs text-red-600 flex items-center gap-1">
            <RefreshCw size={12} /> 重试
          </button>
        )}
      </div>
      {round.status === 'error' ? (
        <div className="flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5" />
          <div>{round.error ?? '发言生成失败'}</div>
        </div>
      ) : (
        <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
          {display || '…'}
        </p>
      )}
    </motion.div>
  );
}
