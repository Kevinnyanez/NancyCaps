import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { exportToExcel } from '@/lib/excel';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  Calendar,
  Package,
  Users,
  TrendingUp,
} from 'lucide-react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface EntregaRow {
  id: number;
  cantidad: number;
  fecha_entrega: string;
  cap_id: number;
  paciente: { id: number; nombre: string; apellido: string; dni?: string } | null;
  tipo: { id: number; nombre: string; marca?: string; codigo?: string } | null;
}

const AdminDeliveries = () => {
  const now = new Date();
  const [entregas, setEntregas] = useState<EntregaRow[]>([]);
  const [caps, setCaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedCap, setSelectedCap] = useState('all');
  const [search, setSearch] = useState('');

  // Expandir CAPs
  const [expandedCaps, setExpandedCaps] = useState<Set<number>>(new Set());

  // Paginación por CAP
  const PAGE_SIZE = 15;
  const [capPages, setCapPages] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchCaps();
  }, []);

  useEffect(() => {
    fetchEntregas();
  }, [selectedMonth, selectedYear]);

  const fetchCaps = async () => {
    const { data } = await supabase.from('caps').select('id, numero, nombre').order('numero');
    setCaps(data || []);
  };

  const fetchEntregas = async () => {
    setLoading(true);
    const start = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1);
    const next = new Date(start);
    next.setMonth(start.getMonth() + 1);

    const { data } = await supabase
      .from('entregas_anticonceptivos')
      .select(
        'id, cantidad, fecha_entrega, cap_id, paciente:pacientes(id, nombre, apellido, dni), tipo:tipos_anticonceptivos(id, nombre, marca, codigo)',
      )
      .gte('fecha_entrega', start.toISOString())
      .lt('fecha_entrega', next.toISOString())
      .order('fecha_entrega', { ascending: false });

    setEntregas((data as EntregaRow[]) || []);
    setCapPages({});
    setLoading(false);
  };

  const toggleCap = (capId: number) => {
    setExpandedCaps((prev) => {
      const next = new Set(prev);
      if (next.has(capId)) next.delete(capId);
      else next.add(capId);
      return next;
    });
  };

  // Agrupar por CAP
  const getFilteredEntregas = () => {
    let filtered = entregas;
    if (selectedCap !== 'all') {
      filtered = filtered.filter((e) => e.cap_id === parseInt(selectedCap));
    }
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter((e) => {
        const pac = e.paciente;
        const tipo = e.tipo;
        return (
          `${pac?.nombre || ''} ${pac?.apellido || ''} ${pac?.dni || ''}`.toLowerCase().includes(term) ||
          `${tipo?.nombre || ''} ${tipo?.codigo || ''} ${tipo?.marca || ''}`.toLowerCase().includes(term)
        );
      });
    }
    return filtered;
  };

  const filtered = getFilteredEntregas();

  const entregasByCap = caps
    .map((cap) => {
      const items = filtered.filter((e) => e.cap_id === cap.id);
      const totalUnidades = items.reduce((s, e) => s + (e.cantidad || 0), 0);
      const pacientesUnicos = new Set(items.map((e) => e.paciente?.id).filter(Boolean)).size;

      // Resumen por tipo
      const porTipo: Record<string, { nombre: string; codigo?: string; marca?: string; total: number }> = {};
      items.forEach((e) => {
        const key = e.tipo?.id?.toString() || 'unknown';
        if (!porTipo[key]) {
          porTipo[key] = {
            nombre: e.tipo?.nombre || 'Desconocido',
            codigo: e.tipo?.codigo || undefined,
            marca: e.tipo?.marca || undefined,
            total: 0,
          };
        }
        porTipo[key].total += e.cantidad || 0;
      });

      return { cap, items, totalUnidades, pacientesUnicos, porTipo };
    })
    .filter((g) => selectedCap === 'all' || g.cap.id === parseInt(selectedCap));

  // Totales globales
  const totalGlobal = filtered.reduce((s, e) => s + (e.cantidad || 0), 0);
  const totalPacientes = new Set(filtered.map((e) => e.paciente?.id).filter(Boolean)).size;
  const totalTipos = new Set(filtered.map((e) => e.tipo?.id).filter(Boolean)).size;

  const handleExport = () => {
    const rows = filtered.map((e) => ({
      fecha: new Date(e.fecha_entrega).toLocaleString('es-AR'),
      cap: caps.find((c) => c.id === e.cap_id)
        ? `CAP ${caps.find((c) => c.id === e.cap_id)!.numero} - ${caps.find((c) => c.id === e.cap_id)!.nombre}`
        : String(e.cap_id),
      paciente: e.paciente ? `${e.paciente.apellido}, ${e.paciente.nombre}` : '-',
      dni: e.paciente?.dni || '-',
      codigo: e.tipo?.codigo || '-',
      anticonceptivo: e.tipo?.nombre || '-',
      marca: e.tipo?.marca || '-',
      cantidad: e.cantidad,
    }));
    void exportToExcel(
      `entregas_${selectedYear}-${selectedMonth.padStart(2, '0')}.xlsx`,
      rows,
    ).catch((err) => console.error('Export failed', err));
  };

  const monthLabel = MONTHS[parseInt(selectedMonth) - 1] || '';

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mes</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Año</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CAP</label>
              <Select value={selectedCap} onValueChange={setSelectedCap}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los CAPs</SelectItem>
                  {caps.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      CAP {c.numero} - {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Paciente, DNI o anticonceptivo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen global */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Período</p>
                <p className="text-sm font-semibold">{monthLabel} {selectedYear}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unidades entregadas</p>
                <p className="text-lg font-bold">{totalGlobal}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pacientes atendidos</p>
                <p className="text-lg font-bold">{totalPacientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipos entregados</p>
                <p className="text-lg font-bold">{totalTipos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botón exportar */}
      <div className="flex justify-end">
        <Button onClick={handleExport} className="gap-2" disabled={filtered.length === 0}>
          <Download className="h-4 w-4" />
          Exportar XLSX
        </Button>
      </div>

      {/* Detalle por CAP */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Cargando entregas...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No se encontraron entregas para este período
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entregasByCap
            .filter((g) => g.items.length > 0)
            .map((group) => {
              const isExpanded = expandedCaps.has(group.cap.id);
              const page = capPages[group.cap.id] || 1;
              const totalPages = Math.max(1, Math.ceil(group.items.length / PAGE_SIZE));
              const pagedItems = group.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

              return (
                <Collapsible
                  key={group.cap.id}
                  open={isExpanded}
                  onOpenChange={() => toggleCap(group.cap.id)}
                >
                  <Card
                    className={cn(
                      'transition-shadow',
                      isExpanded && 'shadow-md ring-1 ring-primary/20',
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-primary" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div>
                              <CardTitle className="text-base">
                                CAP {group.cap.numero} — {group.cap.nombre}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {Object.values(group.porTipo)
                                  .map((t) => `${t.nombre}: ${t.total}`)
                                  .join(' · ')}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="gap-1">
                              <Package className="h-3 w-3" />
                              {group.totalUnidades} uds
                            </Badge>
                            <Badge variant="secondary" className="gap-1">
                              <Users className="h-3 w-3" />
                              {group.pacientesUnicos} pac.
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {/* Resumen por tipo dentro del CAP */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {Object.values(group.porTipo).map((t) => (
                            <div
                              key={t.nombre}
                              className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                            >
                              <span className="font-medium">{t.nombre}</span>
                              {t.codigo && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({t.codigo})
                                </span>
                              )}
                              <span className="ml-2 font-bold text-primary">{t.total}</span>
                            </div>
                          ))}
                        </div>

                        {/* Tabla de entregas individuales */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Paciente</TableHead>
                              <TableHead>DNI</TableHead>
                              <TableHead>Anticonceptivo</TableHead>
                              <TableHead className="text-right">Cant.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pagedItems.map((e) => (
                              <TableRow key={e.id}>
                                <TableCell className="text-sm">
                                  {new Date(e.fecha_entrega).toLocaleDateString('es-AR')}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {e.paciente
                                    ? `${e.paciente.apellido}, ${e.paciente.nombre}`
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {e.paciente?.dni || '—'}
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {e.tipo?.nombre || '—'}
                                    {e.tipo?.codigo && (
                                      <span className="text-xs text-muted-foreground ml-1">
                                        ({e.tipo.codigo})
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {e.cantidad}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Paginación */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t">
                            <span className="text-xs text-muted-foreground">
                              {group.items.length} entregas — Página {page}/{totalPages}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={page <= 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCapPages((prev) => ({
                                    ...prev,
                                    [group.cap.id]: Math.max(1, page - 1),
                                  }));
                                }}
                              >
                                Anterior
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={page >= totalPages}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCapPages((prev) => ({
                                    ...prev,
                                    [group.cap.id]: Math.min(totalPages, page + 1),
                                  }));
                                }}
                              >
                                Siguiente
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default AdminDeliveries;
