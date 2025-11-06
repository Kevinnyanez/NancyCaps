import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Package } from 'lucide-react';

interface StatsCardsProps {
  stats: {
    totalPacientes: number;
    totalRegistros: number;
    tiposAnticonceptivos: number;
  };
}

const StatsCards = ({ stats }: StatsCardsProps) => {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="shadow-soft hover:shadow-medium transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{stats.totalPacientes}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Registrados en el sistema
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-soft hover:shadow-medium transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Entregas Totales</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-secondary">{stats.totalRegistros}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Registros de anticonceptivos
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-soft hover:shadow-medium transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tipos Disponibles</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-accent">{stats.tiposAnticonceptivos}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Anticonceptivos diferentes
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
