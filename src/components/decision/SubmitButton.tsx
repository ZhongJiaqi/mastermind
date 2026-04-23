import { Loader2, Sparkles } from 'lucide-react';

interface Props {
  disabled: boolean;
  loading?: boolean;
  onClick: () => void;
}

export function SubmitButton({ disabled, loading, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-4 bg-stone-900 text-white rounded-2xl font-medium shadow-md hover:bg-stone-800 focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          <span>智囊团正在集结中...</span>
        </>
      ) : (
        <>
          <Sparkles size={18} />
          <span>向智囊团请教</span>
        </>
      )}
    </button>
  );
}
