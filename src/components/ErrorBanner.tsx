import { motion } from 'motion/react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export interface FriendlyError {
  title: string;
  hint?: string;
}

export function toFriendly(message: string): FriendlyError {
  const lower = message.toLowerCase();

  if (/dashscope_api_key|api[_ ]key.*not.*configured|api[_ ]key.*missing/i.test(message)) {
    return {
      title: '服务暂时不可用',
      hint: '请联系管理员配置 API 密钥后重试。',
    };
  }
  if (/exhaust|额度|配额|free tier/i.test(message)) {
    return {
      title: '模型额度已耗尽',
      hint: '请稍后再试，或联系管理员升级配额。',
    };
  }
  if (/timeout|超时|timed out/i.test(lower)) {
    return {
      title: '请求超时',
      hint: '可以试试简化问题或减少军师数量（建议 ≤ 3 位）。',
    };
  }
  if (/network|fetch|失败|failed to fetch/i.test(lower)) {
    return {
      title: '网络异常',
      hint: '请检查网络连接后重试。',
    };
  }
  if (/parse|json|invalid/i.test(lower)) {
    return {
      title: '军师返回格式异常',
      hint: '可以重试一次；如果反复出现，请联系管理员。',
    };
  }
  return { title: message };
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  const { title, hint } = toFriendly(message);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      role="alert"
      className="relative flex items-start gap-3 p-4 bg-red-50 text-red-800 rounded-2xl border border-red-200 shadow-sm"
    >
      <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        {hint && <p className="text-xs text-red-700/80 mt-1">{hint}</p>}
        <div className="flex items-center gap-2 mt-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors"
            >
              <RefreshCw size={12} />
              重试
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-red-700/70 hover:text-red-800 px-2 py-1.5 transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="关闭错误提示"
          className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </motion.div>
  );
}
