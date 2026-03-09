import { useEffect, useState, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'cap_user';
  cap_number: number | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const fetchingRef = useRef(false);
  const lastFetchedId = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, retries = 2) => {
    if (fetchingRef.current && lastFetchedId.current === userId) return;
    fetchingRef.current = true;
    lastFetchedId.current = userId;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setProfile(data);
        } else {
          setProfile(null);
        }
        break;
      } catch (error) {
        console.error(`Error fetching profile (attempt ${attempt + 1}):`, error);
        if (attempt === retries) {
          toast({
            title: 'Error de conexión',
            description: 'No se pudo cargar el perfil. Intentá recargar la página.',
            variant: 'destructive',
          });
        } else {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    fetchingRef.current = false;
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          lastFetchedId.current = null;
          setLoading(false);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: 'Bienvenido', description: 'Has iniciado sesión correctamente' });
    } catch (error: any) {
      toast({
        title: 'Error al iniciar sesión',
        description: error.message || 'Verifica tus credenciales',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast({ title: 'Cuenta creada', description: 'Tu cuenta ha sido creada exitosamente' });
    } catch (error: any) {
      toast({
        title: 'Error al registrarse',
        description: error.message || 'No se pudo crear la cuenta',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      lastFetchedId.current = null;
      toast({ title: 'Sesión cerrada', description: 'Has cerrado sesión correctamente' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo cerrar sesión',
        variant: 'destructive',
      });
    }
  };

  return {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin: profile?.role === 'admin',
    isCapUser: profile?.role === 'cap_user',
  };
};
