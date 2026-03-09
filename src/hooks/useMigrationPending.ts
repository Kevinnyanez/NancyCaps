import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useMigrationPending() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const { data } = await supabase
      .from('migration_confirmations')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    setPending(!data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { check(); }, [check]);

  const confirm = useCallback(async () => {
    if (!user?.id) return;
    await supabase.from('migration_confirmations').insert({ user_id: user.id });
    setPending(false);
  }, [user?.id]);

  return { pending, loading, confirm, recheck: check };
}
