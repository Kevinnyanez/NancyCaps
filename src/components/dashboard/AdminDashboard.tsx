import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Users, Package, Activity, Settings } from 'lucide-react';
import StatsCards from './StatsCards';
import MonthlyReport from './MonthlyReport';
import ManageUsers from './ManageUsers';
import ManageAnticonceptivos from './ManageAnticonceptivos';
import ManageCaps from './ManageCaps';
import ManageInventory from './ManageInventory';
import NotificationsList from './NotificationsList.tsx';

const AdminDashboard = () => {
  const { signOut, profile } = useAuth();
  const [stats, setStats] = useState({
    totalPacientes: 0,
    totalRegistros: 0,
    tiposAnticonceptivos: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [pacientes, registros, tipos] = await Promise.all([
        supabase.from('pacientes').select('id', { count: 'exact', head: true }),
        supabase.from('registros_anticonceptivos').select('id', { count: 'exact', head: true }),
        supabase.from('tipos_anticonceptivos').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalPacientes: pacientes.count || 0,
        totalRegistros: registros.count || 0,
        tiposAnticonceptivos: tipos.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Panel Administrativo</h1>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
          <Button onClick={signOut} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <StatsCards stats={stats} />
          </div>
          <div>
            <NotificationsList admin />
          </div>
        </div>

        <Tabs defaultValue="report" className="mt-8">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="report" className="gap-2">
              <Activity className="w-4 h-4" />
              Reportes
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="anticonceptivos" className="gap-2">
              <Package className="w-4 h-4" />
              Anticonceptivos
            </TabsTrigger>
            <TabsTrigger value="inventario" className="gap-2">
              <Package className="w-4 h-4" />
              Inventario
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Configuración
            </TabsTrigger>
          </TabsList>

          <TabsContent value="report">
            <MonthlyReport />
          </TabsContent>

          <TabsContent value="users">
            <ManageUsers />
          </TabsContent>

          <TabsContent value="anticonceptivos">
            <ManageAnticonceptivos />
          </TabsContent>

          <TabsContent value="inventario">
            <ManageInventory />
          </TabsContent>

          <TabsContent value="settings">
            <ManageCaps />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
