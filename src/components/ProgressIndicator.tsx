import { motion } from 'framer-motion';
import type { AnalysisProgress } from '@/lib/types';

export default function ProgressIndicator({ progress }: { progress: AnalysisProgress }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 grid-bg">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-md text-center"
      >
        <div className="relative mb-8">
          <div className="mx-auto h-20 w-20 rounded-full border-2 border-primary/30">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </div>

        <p className="mb-2 font-mono text-sm text-primary">{progress.stage}</p>

        <div className="mx-auto h-1.5 w-64 overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: `${progress.percent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <p className="mt-2 font-mono text-xs text-muted-foreground">{progress.percent}%</p>
      </motion.div>
    </div>
  );
}
