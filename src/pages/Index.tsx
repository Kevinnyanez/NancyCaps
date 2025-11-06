import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Pill, Activity, Users, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <header className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg">
              <Pill className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Sistema de Anticonceptivos</h1>
          </div>
          <Button onClick={() => navigate('/auth')}>
            Iniciar Sesión
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Gestión de Anticonceptivos para CAPs
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Sistema integral para el control y seguimiento de anticonceptivos en Centros de Atención Primaria
          </p>
          <Button size="lg" onClick={() => navigate('/auth')} className="gap-2">
            <Pill className="w-5 h-5" />
            Comenzar Ahora
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader>
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Control de Pacientes</CardTitle>
              <CardDescription>
                Registro completo de pacientes con DNI, edad y datos relevantes
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader>
              <div className="bg-secondary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-secondary" />
              </div>
              <CardTitle>Inventario</CardTitle>
              <CardDescription>
                Seguimiento de tipos, marcas y cantidades de anticonceptivos
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-shadow">
            <CardHeader>
              <div className="bg-accent/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Reportes Mensuales</CardTitle>
              <CardDescription>
                Estadísticas y reportes detallados por mes y por CAP
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>

      <footer className="border-t bg-card mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>Sistema de Gestión de Anticonceptivos - CAPs</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
