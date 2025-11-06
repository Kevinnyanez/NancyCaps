import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Users, FileText } from 'lucide-react';
import PacientesList from './PacientesList';
import RegistroForm from './RegistroForm';

const CapUserDashboard = () => {
  const { signOut, profile } = useAuth();
  const [capInfo, setCapInfo] = useState<any>(null);

  useEffect(() => {
    if (profile?.cap_number) {
      fetchCapInfo();
    }
  }, [profile?.cap_number]);

  const fetchCapInfo = async () => {
    if (!profile?.cap_number) return;

    try {
      const { data } = await supabase
        .from('caps')
        .select('*')
        .eq('numero', profile.cap_number)
        .single();

      setCapInfo(data);
    } catch (error) {
      console.error('Error fetching CAP info:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {capInfo?.nombre || `CAP ${profile?.cap_number}`}
            </h1>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
          <Button onClick={signOut} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="pacientes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pacientes" className="gap-2">
              <Users className="w-4 h-4" />
              Pacientes
            </TabsTrigger>
            <TabsTrigger value="registros" className="gap-2">
              <FileText className="w-4 h-4" />
              Nuevo Registro
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pacientes">
            <PacientesList capNumber={profile?.cap_number} />
          </TabsContent>

          <TabsContent value="registros">
            <RegistroForm capNumber={profile?.cap_number} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CapUserDashboard;
