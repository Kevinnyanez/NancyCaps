import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MonthlyReport = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedYear]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('registros_anticonceptivos')
        .select(`
          *,
          tipo_anticonceptivo:tipos_anticonceptivos(nombre, marca),
          paciente:pacientes(cap_id)
        `)
        .eq('mes', parseInt(selectedMonth))
        .eq('anio', parseInt(selectedYear));

      if (error) throw error;

      // Agrupar por tipo de anticonceptivo
      const grouped = data?.reduce((acc: any, reg: any) => {
        const key = reg.tipo_anticonceptivo?.nombre || 'Desconocido';
        if (!acc[key]) {
          acc[key] = {
            nombre: key,
            marca: reg.tipo_anticonceptivo?.marca || '-',
            total: 0,
          };
        }
        acc[key].total += reg.cantidad;
        return acc;
      }, {});

      setReport(Object.values(grouped || {}));
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>Reporte Mensual de Anticonceptivos</CardTitle>
        <CardDescription>
          Resumen de anticonceptivos entregados por tipo
        </CardDescription>
        <div className="flex gap-4 mt-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear - 1, currentYear - 2].map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground">Cargando...</p>
        ) : report.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No hay registros para este período
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Anticonceptivo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">Cantidad Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.map((item: any, index: number) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell>{item.marca}</TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {item.total}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyReport;
