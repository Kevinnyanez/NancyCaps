import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Search, FileText, Users, Package } from 'lucide-react';

const MonthlyReport = () => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedCap, setSelectedCap] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [caps, setCaps] = useState<any[]>([]);
  
  // Datos del reporte
  const [pacientesConAnticonceptivos, setPacientesConAnticonceptivos] = useState<any[]>([]);
  const [resumenAnticonceptivos, setResumenAnticonceptivos] = useState<any[]>([]);
  const [detalleAnticonceptivos, setDetalleAnticonceptivos] = useState<any>({});
  const [expandedPaciente, setExpandedPaciente] = useState<number | null>(null);
  const [expandedAnticonceptivo, setExpandedAnticonceptivo] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCaps();
    fetchReport();
  }, [selectedMonth, selectedYear, selectedCap]);

  const fetchCaps = async () => {
    try {
      const { data, error } = await supabase
        .from('caps')
        .select('*')
        .order('numero');

      if (error) throw error;
      setCaps(data || []);
    } catch (error) {
      console.error('Error fetching caps:', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      // Obtener todos los registros del mes/año seleccionado
      let query = supabase
        .from('registros_anticonceptivos')
        .select(`
          *,
          tipo_anticonceptivo:tipos_anticonceptivos(id, nombre, marca, descripcion),
          paciente:pacientes(
            id,
            nombre,
            apellido,
            dni,
            edad,
            cap_id,
            cap:caps(id, numero, nombre, direccion, responsable_nombre)
          )
        `)
        .eq('mes', parseInt(selectedMonth))
        .eq('anio', parseInt(selectedYear));

      const { data: allData, error } = await query.order('fecha_entrega', { ascending: false });

      if (error) throw error;

      // Filtrar por CAP si está seleccionado
      let data = allData;
      if (selectedCap !== 'all' && allData) {
        data = allData.filter((reg: any) => {
          // Verificar que el paciente y el cap existan
          if (!reg.paciente || !reg.paciente.cap_id) return false;
          return reg.paciente.cap_id === parseInt(selectedCap);
        });
      }

      // Procesar datos para vista de pacientes
      const pacientesMap = new Map();
      
      data?.forEach((reg: any) => {
        // Validar que el paciente exista
        if (!reg.paciente || !reg.paciente.id) return;
        
        const pacienteId = reg.paciente.id;
        if (!pacientesMap.has(pacienteId)) {
          pacientesMap.set(pacienteId, {
            id: pacienteId,
            nombre: reg.paciente.nombre,
            apellido: reg.paciente.apellido,
            dni: reg.paciente.dni,
            edad: reg.paciente.edad,
            cap: reg.paciente.cap,
            anticonceptivos: [],
            totalAnticonceptivos: 0, // Total de unidades para este paciente
          });
        }
        
        const paciente = pacientesMap.get(pacienteId);
        paciente.anticonceptivos.push({
          id: reg.id,
          tipo: reg.tipo_anticonceptivo?.nombre || 'Desconocido',
          marca: reg.tipo_anticonceptivo?.marca || '-',
          cantidad: reg.cantidad,
          fecha_entrega: reg.fecha_entrega,
          notas: reg.notas,
        });
        paciente.totalAnticonceptivos += reg.cantidad;
      });

      // Procesar datos para resumen de anticonceptivos
      const resumenMap = new Map();
      const detalleMap: any = {};

      data?.forEach((reg: any) => {
        // Validar que el paciente y tipo existan
        if (!reg.paciente || !reg.tipo_anticonceptivo) return;
        
        const tipoNombre = reg.tipo_anticonceptivo?.nombre || 'Desconocido';
        const marca = reg.tipo_anticonceptivo?.marca || 'Sin marca';
        const key = `${tipoNombre}|${marca}`;
        
        if (!resumenMap.has(key)) {
          resumenMap.set(key, {
            tipo: tipoNombre,
            marca: marca,
            descripcion: reg.tipo_anticonceptivo?.descripcion || '-',
            total: 0,
            pacientes: new Set(),
          });
          
          detalleMap[key] = [];
        }
        
        const resumen = resumenMap.get(key);
        resumen.total += reg.cantidad;
        resumen.pacientes.add(reg.paciente.id);
        
        detalleMap[key].push({
          paciente: `${reg.paciente.apellido}, ${reg.paciente.nombre}`,
          dni: reg.paciente.dni,
          cap: reg.paciente.cap ? `CAP ${reg.paciente.cap.numero} - ${reg.paciente.cap.nombre}` : 'Sin CAP',
          cantidad: reg.cantidad,
          fecha_entrega: reg.fecha_entrega,
          notas: reg.notas,
        });
      });

      // Convertir a arrays
      const pacientesArray = Array.from(pacientesMap.values());
      const resumenArray = Array.from(resumenMap.values()).map(item => ({
        ...item,
        totalPacientes: item.pacientes.size,
        pacientes: undefined, // Remover Set para serialización
      }));

      // Aplicar filtro de búsqueda
      let pacientesFiltrados = pacientesArray;
      if (searchTerm) {
        pacientesFiltrados = pacientesArray.filter(p =>
          `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setPacientesConAnticonceptivos(pacientesFiltrados);
      setResumenAnticonceptivos(resumenArray);
      setDetalleAnticonceptivos(detalleMap);
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

  const totalAnticonceptivos = resumenAnticonceptivos.reduce((sum, item) => sum + item.total, 0);
  const totalPacientes = new Set(pacientesConAnticonceptivos.map(p => p.id)).size;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Filtros del Reporte</CardTitle>
          <CardDescription>
            Selecciona el período y CAP para generar el reporte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mes</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Año</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">CAP</label>
              <Select value={selectedCap} onValueChange={setSelectedCap}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los CAPs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los CAPs</SelectItem>
                  {caps.map((cap) => (
                    <SelectItem key={cap.id} value={cap.id.toString()}>
                      CAP {cap.numero} - {cap.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar Paciente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Nombre, apellido o DNI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicador de filtro por CAP */}
      {selectedCap !== 'all' && (
        <Card className="shadow-soft border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-sm">
                CAP Filtrado
              </Badge>
              <span className="text-sm font-medium">
                {caps.find(c => c.id.toString() === selectedCap) 
                  ? `CAP ${caps.find(c => c.id.toString() === selectedCap)?.numero} - ${caps.find(c => c.id.toString() === selectedCap)?.nombre}`
                  : 'CAP seleccionado'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Anticonceptivos
              {selectedCap !== 'all' && <span className="text-xs ml-2">(CAP filtrado)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{totalAnticonceptivos}</div>
            <p className="text-xs text-muted-foreground mt-1">Unidades necesarias</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Pacientes
              {selectedCap !== 'all' && <span className="text-xs ml-2">(CAP filtrado)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{totalPacientes}</div>
            <p className="text-xs text-muted-foreground mt-1">Pacientes atendidos</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tipos Diferentes
              {selectedCap !== 'all' && <span className="text-xs ml-2">(CAP filtrado)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{resumenAnticonceptivos.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Tipos de anticonceptivos</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para las dos vistas */}
      <Tabs defaultValue="pacientes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pacientes" className="gap-2">
            <Users className="w-4 h-4" />
            Pacientes por CAP
          </TabsTrigger>
          <TabsTrigger value="anticonceptivos" className="gap-2">
            <Package className="w-4 h-4" />
            Resumen por Anticonceptivo
          </TabsTrigger>
        </TabsList>

        {/* Vista de Pacientes */}
        <TabsContent value="pacientes" className="space-y-4">
          <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Pacientes y Anticonceptivos Necesarios</CardTitle>
            <CardDescription>
              {selectedCap !== 'all' 
                ? `Lista de pacientes del CAP seleccionado con los anticonceptivos que necesitan en el período seleccionado`
                : `Lista de pacientes con los anticonceptivos que necesitan en el período seleccionado`}
            </CardDescription>
          </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Cargando...</p>
              ) : pacientesConAnticonceptivos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay registros para este período
                </p>
              ) : (
                <div className="space-y-2">
                  {pacientesConAnticonceptivos.map((paciente) => (
                    <Collapsible
                      key={paciente.id}
                      open={expandedPaciente === paciente.id}
                      onOpenChange={(open) => setExpandedPaciente(open ? paciente.id : null)}
                    >
                      <Card className="border">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div className="font-semibold">
                                  {paciente.apellido}, {paciente.nombre}
                                </div>
                                <Badge variant="outline">DNI: {paciente.dni}</Badge>
                                <Badge variant="secondary">Edad: {paciente.edad}</Badge>
                                <Badge>
                                  CAP {paciente.cap.numero} - {paciente.cap.nombre}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {paciente.anticonceptivos.length} tipo(s) de anticonceptivo(s) - Total: {paciente.totalAnticonceptivos} unidades
                              </div>
                            </div>
                            {expandedPaciente === paciente.id ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Marca</TableHead>
                                  <TableHead className="text-right">Cantidad</TableHead>
                                  <TableHead>Fecha Solicitud</TableHead>
                                  <TableHead>Notas</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {paciente.anticonceptivos.map((ant: any) => (
                                  <TableRow key={ant.id}>
                                    <TableCell className="font-medium">{ant.tipo}</TableCell>
                                    <TableCell>{ant.marca}</TableCell>
                                    <TableCell className="text-right font-semibold">{ant.cantidad}</TableCell>
                                    <TableCell>{new Date(ant.fecha_entrega).toLocaleDateString('es-AR')}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {ant.notas || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vista de Resumen por Anticonceptivo */}
        <TabsContent value="anticonceptivos" className="space-y-4">
          <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Resumen por Tipo y Marca</CardTitle>
            <CardDescription>
              {selectedCap !== 'all'
                ? `Cantidad total de anticonceptivos necesarios del CAP seleccionado, agrupados por tipo y marca`
                : `Cantidad total de anticonceptivos necesarios agrupados por tipo y marca`}
            </CardDescription>
          </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Cargando...</p>
              ) : resumenAnticonceptivos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay registros para este período
                </p>
              ) : (
                <div className="space-y-2">
                  {resumenAnticonceptivos.map((item, index) => {
                    const key = `${item.tipo}|${item.marca}`;
                    return (
                      <Collapsible
                        key={index}
                        open={expandedAnticonceptivo === key}
                        onOpenChange={(open) => setExpandedAnticonceptivo(open ? key : null)}
                      >
                        <Card className="border">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <div className="font-semibold text-lg">{item.tipo}</div>
                                  <Badge variant="outline">{item.marca}</Badge>
                                  <Badge variant="secondary" className="text-lg font-bold">
                                    {item.total} unidades
                                  </Badge>
                                  <Badge variant="secondary">
                                    {item.totalPacientes} paciente(s)
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {item.descripcion}
                                </div>
                              </div>
                              {expandedAnticonceptivo === key ? (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-4 pb-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Paciente</TableHead>
                                    <TableHead>DNI</TableHead>
                                    <TableHead>CAP</TableHead>
                                    <TableHead className="text-right">Cantidad</TableHead>
                                    <TableHead>Fecha Solicitud</TableHead>
                                    <TableHead>Notas</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {detalleAnticonceptivos[key]?.map((detalle: any, idx: number) => (
                                    <TableRow key={idx}>
                                      <TableCell className="font-medium">{detalle.paciente}</TableCell>
                                      <TableCell>{detalle.dni}</TableCell>
                                      <TableCell>{detalle.cap}</TableCell>
                                      <TableCell className="text-right font-semibold">{detalle.cantidad}</TableCell>
                                      <TableCell>{new Date(detalle.fecha_entrega).toLocaleDateString('es-AR')}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {detalle.notas || '-'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonthlyReport;
