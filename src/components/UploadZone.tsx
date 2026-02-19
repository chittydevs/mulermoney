import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

interface UploadZoneProps {
  onFileAccepted: (file: File) => void;
  isProcessing: boolean;
}

export default function UploadZone({ onFileAccepted, isProcessing }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are accepted');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large (max 50MB)');
      return;
    }
    setFileName(file.name);
    onFileAccepted(file);
  }, [onFileAccepted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-screen flex-col items-center justify-center px-4 grid-bg"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-12 text-center"
      >
        <div className="mb-4 flex items-center justify-center gap-3">
          <div className="h-px w-12 bg-primary/50" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Financial Intelligence</span>
          <div className="h-px w-12 bg-primary/50" />
        </div>
        <h1 className="mb-3 text-5xl font-black tracking-tight text-foreground md:text-6xl">
          MONEY MULING
          <span className="block text-primary text-glow-primary">DETECTION ENGINE</span>
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Graph-based financial crime detection platform. Upload transaction data to identify fraud rings, smurfing patterns, and shell networks.
        </p>
      </motion.div>

      {/* Upload zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative w-full max-w-lg cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all duration-300 ${
          dragOver
            ? 'border-primary bg-primary/5 glow-primary'
            : 'border-border bg-card hover:border-primary/50'
        } ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
        onClick={() => {
          if (isProcessing) return;
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.csv';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFile(file);
          };
          input.click();
        }}
      >
        <Upload className={`mx-auto mb-4 h-10 w-10 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
        <p className="mb-2 text-sm font-medium text-foreground">
          Drop CSV file here or <span className="text-primary">browse</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Required columns: transaction_id, sender_id, receiver_id, amount, timestamp
        </p>

        {fileName && !error && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary">
            <FileText className="h-4 w-4" />
            <span className="font-mono">{fileName}</span>
            <CheckCircle className="h-4 w-4" />
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </motion.div>

      {/* CSV format guide */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 w-full max-w-lg rounded-md border border-border bg-card p-4"
      >
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">CSV Format</p>
        <pre className="overflow-x-auto font-mono text-xs text-secondary-foreground">
{`transaction_id,sender_id,receiver_id,amount,timestamp
TXN_001,ACC_001,ACC_002,5000.00,2024-01-15 10:30:00`}
        </pre>
      </motion.div>
    </motion.div>
  );
}
