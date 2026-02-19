import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Chrome, Apple } from 'lucide-react';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Auth() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider);
      if (result.error) {
        toast.error(`Sign in failed: ${result.error.message || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error('Sign in failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleGitHub = async () => {
    setLoading('github');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
    } catch {
      toast.error('Sign in failed. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const providers = [
    { id: 'google' as const, label: 'Google', icon: Chrome, handler: () => handleOAuth('google') },
    { id: 'apple' as const, label: 'Apple', icon: Apple, handler: () => handleOAuth('apple') },
    { id: 'github', label: 'GitHub', icon: Shield, handler: handleGitHub },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-mono text-lg font-bold tracking-tight text-primary text-glow-primary">
            MONEY MULING DETECTION ENGINE
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Sign in to access the financial crime detection platform
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-3">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={p.handler}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-3 font-mono text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {loading === p.id ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
              ) : (
                <p.icon className="h-4 w-4" />
              )}
              Continue with {p.label}
            </button>
          ))}
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          Authorized personnel only. All activity is monitored.
        </p>
      </motion.div>
    </div>
  );
}
