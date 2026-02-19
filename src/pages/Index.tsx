import { useState, useCallback } from 'react';
import UploadZone from '@/components/UploadZone';
import Dashboard from '@/components/Dashboard';
import ProgressIndicator from '@/components/ProgressIndicator';
import { parseCSV } from '@/lib/csv-parser';
import { analyzeTransactions } from '@/lib/analyzer';
import type { DetectionResult, AnalysisProgress } from '@/lib/types';
import { toast } from 'sonner';

type AppState = 'upload' | 'processing' | 'results';

const Index = () => {
  const [state, setState] = useState<AppState>('upload');
  const [progress, setProgress] = useState<AnalysisProgress>({ stage: '', percent: 0 });
  const [result, setResult] = useState<DetectionResult | null>(null);

  const handleFile = useCallback(async (file: File) => {
    try {
      setState('processing');
      setProgress({ stage: 'Parsing CSV file...', percent: 5 });

      const transactions = await parseCSV(file);
      toast.success(`Parsed ${transactions.length} transactions`);

      const detectionResult = await analyzeTransactions(transactions, setProgress);
      setResult(detectionResult);
      setState('results');

      toast.success(`Analysis complete: ${detectionResult.summary.suspicious_accounts_flagged} suspicious accounts found`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
      setState('upload');
    }
  }, []);

  const handleReset = useCallback(() => {
    setState('upload');
    setResult(null);
  }, []);

  if (state === 'processing') {
    return <ProgressIndicator progress={progress} />;
  }

  if (state === 'results' && result) {
    return <Dashboard result={result} onReset={handleReset} />;
  }

  return <UploadZone onFileAccepted={handleFile} isProcessing={false} />;
};

export default Index;
