import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Search,
  AlertTriangle,
  Bell,
  Send,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface CrossCapPatient {
  dni: string;
  nombre: string;
  apellido: string;
  registeredCaps: { cap_id: number; cap_numero: number; cap_nombre: string; paciente_id: number | null; dni: string }[];
  deliveries: { id: number; fecha_entrega: string; cap_id: number; cap_numero: number; tipo_nombre: string; tipo_codigo?: string; cantidad: number }[];
  totalEntregas: number;
  capsConEntrega: number;
  capsRegistrado: number;
  /** Posibles duplicados por nombre+apellido con distinto DNI */
  nameMatches: { dni: string; cap_id: number; cap_numero: number; cap_nombre: string; paciente_id: number | null }[];
}

const PAGE_SIZE = 10;

const DeliveredPatientsReport = () => {
  const now = new Date();
  const [month, setMonth] = useState((now.getMonth() + 1).toString());
  const [year, setYear] = useState(now.getFullYear().toString());
  const [caps, setCaps] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'multicap'>('multicap');
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<CrossCapPatient[]>([]);
  const [page, setPage] = useState(1);

  // Detail modal
  const [detailPatient, setDetailPatient] = useState<CrossCapPatient | null>(null);

  // Notify modal
  const [notifyPatient, setNotifyPatient] = useState<CrossCapPatient | null>(null);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifySelected, setNotifySelected] = useState<Record<number, boolean>>({});
  const [notifyLoading, setNotifyLoading] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchCaps();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [month, year]);

  const fetchCaps = async () => {
    const { data } = await supabase.from('caps').select('id, numero, nombre').order('numero');
    setCaps(data || []);
  };

  const fetchReport = async () => {
    setLoading(true);
    setPage(1);
    try {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const next = new Date(start);
      next.setMonth(start.getMonth() + 1);

      const { data: entregas } = await supabase
        .from('entregas_anticonceptivos')
        .select(`
          id, cantidad, fecha_entrega, cap_id,
          paciente:pacientes(id, nombre, apellido, dni, cap_id, cap:caps(id, numero, nombre)),
          tipo:tipos_anticonceptivos(id, nombre, codigo)
        `)
        .gte('fecha_entrega', start.toISOString())
        .lt('fecha_entrega', next.toISOString())
        .order('fecha_entrega', { ascending: false });

      const rows = entregas || [];

      // Get all unique DNIs
      const dnis = Array.from(new Set(rows.map((r: any) => r.paciente?.dni).filter(Boolean)));

      // Get all patient registrations for those DNIs
      let pacientesByDni: Record<string, any[]> = {};
      if (dnis.length > 0) {
        const { data: pacs } = await supabase
          .from('pacientes')
          .select('id, dni, cap_id, nombre, apellido, cap:caps(id, numero, nombre)')
          .in('dni', dnis as string[]);
        (pacs || []).forEach((p: any) => {
          pacientesByDni[p.dni] = pacientesByDni[p.dni] || [];
          pacientesByDni[p.dni].push(p);
        });
      }

      // Also search by name+surname for possible duplicates with different DNI
      const nameKeys = Array.from(
        new Set(
          rows
            .map((r: any) => {
              const n = (r.paciente?.nombre || '').trim().toLowerCase();
              const a = (r.paciente?.apellido || '').trim().toLowerCase();
              return n && a ? `${n}|${a}` : null;
            })
            .filter(Boolean),
        ),
      );

      // Fetch ALL patients to check for name matches across CAPs
      let allPatients: any[] = [];
      if (nameKeys.length > 0) {
        const { data: allPacs } = await supabase
          .from('pacientes')
          .select('id, dni, cap_id, nombre, apellido, cap:caps(id, numero, nombre)')
          .order('apellido');
        allPatients = allPacs || [];
      }

      // Index allPatients by normalized name
      const patientsByName: Record<string, any[]> = {};
      allPatients.forEach((p: any) => {
        const key = `${(p.nombre || '').trim().toLowerCase()}|${(p.apellido || '').trim().toLowerCase()}`;
        patientsByName[key] = patientsByName[key] || [];
        patientsByName[key].push(p);
      });

      // Build patient-centric data
      const patientMap: Record<string, CrossCapPatient> = {};

      rows.forEach((r: any) => {
        const dni = r.paciente?.dni;
        if (!dni) return;

        if (!patientMap[dni]) {
          const regs = (pacientesByDni[dni] || []).map((p: any) => ({
            cap_id: p.cap_id,
            cap_numero: p.cap?.numero || 0,
            cap_nombre: p.cap?.nombre || '',
            paciente_id: p.id,
            dni: p.dni,
          }));

          // Find name matches with different DNI
          const nameKey = `${(r.paciente?.nombre || '').trim().toLowerCase()}|${(r.paciente?.apellido || '').trim().toLowerCase()}`;
          const nameGroup = patientsByName[nameKey] || [];
          const nameMatches = nameGroup
            .filter((p: any) => p.dni !== dni)
            .map((p: any) => ({
              dni: p.dni,
              cap_id: p.cap_id,
              cap_numero: p.cap?.numero || 0,
              cap_nombre: p.cap?.nombre || '',
              paciente_id: p.id,
            }));

          patientMap[dni] = {
            dni,
            nombre: r.paciente?.nombre || '',
            apellido: r.paciente?.apellido || '',
            registeredCaps: regs,
            deliveries: [],
            totalEntregas: 0,
            capsConEntrega: 0,
            capsRegistrado: regs.length,
            nameMatches,
          };
        }

        patientMap[dni].deliveries.push({
          id: r.id,
          fecha_entrega: r.fecha_entrega,
          cap_id: r.cap_id || r.paciente?.cap_id,
          cap_numero: r.paciente?.cap?.numero || 0,
          tipo_nombre: r.tipo?.nombre || 'Desconocido',
          tipo_codigo: r.tipo?.codigo || undefined,
          cantidad: r.cantidad || 0,
        });
        patientMap[dni].totalEntregas += r.cantidad || 0;
      });

      // Calculate caps con entrega
      Object.values(patientMap).forEach((p) => {
        p.capsConEntrega = new Set(p.deliveries.map((d) => d.cap_id)).size;
      });

      setPatients(Object.values(patientMap));
    } catch (err) {
      console.error('Error fetching report', err);
    } finally {
      setLoading(false);
    }
  };

  const isMulticap = (p: CrossCapPatient) =>
    p.capsRegistrado > 1 || p.capsConEntrega > 1 || p.nameMatches.length > 0;

  // Filtering
  const filtered = patients.filter((p) => {
    if (filter === 'multicap' && !isMulticap(p)) return false;
    if (search) {
      const term = search.toLowerCase();
      if (
        !`${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(term)
      )
        return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const multicapCount = patients.filter(isMulticap).length;

  const getCapLabel = (capId: number) => {
    const c = caps.find((cap) => cap.id === capId);
    return c ? `CAP ${c.numero}` : `CAP ${capId}`;
  };

  /** All CAPs related to a patient (registeredCaps + nameMatch CAPs, deduplicated) */
  const getAllRelatedCaps = (patient: CrossCapPatient) => {
    const map = new Map<number, { cap_id: number; cap_numero: number; cap_nombre: string; paciente_id: number | null; dni: string; isNameMatch: boolean }>();
    patient.registeredCaps.forEach((rc) =>
      map.set(rc.cap_id, { ...rc, isNameMatch: false }),
    );
    patient.nameMatches.forEach((nm) => {
      if (!map.has(nm.cap_id)) {
        map.set(nm.cap_id, { ...nm, isNameMatch: true });
      }
    });
    return Array.from(map.values());
  };

  // Notify helpers
  const openNotify = (patient: CrossCapPatient, origenCapId?: number) => {
    setNotifyPatient(patient);

    const hasNameDups = patient.nameMatches.length > 0;
    const origenLabel = origenCapId ? getCapLabel(origenCapId) : 'otra CAP';

    let msg = `El paciente ${patient.apellido}, ${patient.nombre} (DNI: ${patient.dni}) ya recibió anticonceptivos en ${origenLabel}. Por favor verificar antes de realizar una nueva entrega.`;

    if (hasNameDups) {
      const otherDnis = [...new Set(patient.nameMatches.map((nm) => nm.dni))].join(', ');
      msg += `\n\nNota: Existen registros con el mismo nombre y apellido pero con DNI distinto (${otherDnis}). Podría tratarse de la misma persona con un error de carga.`;
    }

    setNotifyMessage(msg);

    const allCaps = getAllRelatedCaps(patient);
    const sel: Record<number, boolean> = {};
    allCaps.forEach((rc) => {
      if (rc.cap_id !== origenCapId) sel[rc.cap_id] = true;
    });
    setNotifySelected(sel);
  };

  const handleSendNotify = async () => {
    if (!notifyPatient) return;
    const allCaps = getAllRelatedCaps(notifyPatient);
    const targets = allCaps.filter(
      (rc) => notifySelected[rc.cap_id],
    );
    if (targets.length === 0) {
      toast({
        title: 'Seleccione al menos una CAP',
        description: 'Debe elegir a qué CAPs enviar la alerta.',
        variant: 'destructive',
      });
      return;
    }

    setNotifyLoading(true);
    try {
      const inserts = targets.map((t) => ({
        registro_id: null,
        paciente_id: t.paciente_id || null,
        dni: notifyPatient.dni,
        tipo_anticonceptivo_id: null,
        cap_origen: null,
        cap_destino: t.cap_id,
        mensaje: notifyMessage,
        created_by: user?.id || null,
      }));

      const { error } = await (supabase as any)
        .from('entrega_notificaciones')
        .insert(inserts as any);
      if (error) throw error;

      toast({
        title: 'Alerta enviada',
        description: `Se notificó a ${targets.length} CAP(s) sobre ${notifyPatient.apellido}, ${notifyPatient.nombre}`,
      });
      setNotifyPatient(null);
    } catch (err: any) {
      const msg = err?.message || 'No se pudo enviar la alerta';
      if (err?.status === 403) {
        toast({
          title: 'Permiso denegado',
          description: 'Verifica las políticas RLS de entrega_notificaciones.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      }
    } finally {
      setNotifyLoading(false);
    }
  };

  const monthLabel = MONTHS[parseInt(month) - 1] || '';

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Mes
              </label>
              <Select value={month} onValueChange={(v) => { setMonth(v); setPage(1); }}>
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Año
              </label>
              <Select value={year} onValueChange={(v) => { setYear(v); setPage(1); }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(
                    (y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Mostrar
              </label>
              <Select value={filter} onValueChange={(v: any) => { setFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multicap">Solo Multicap</SelectItem>
                  <SelectItem value="all">Todos los pacientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nombre, apellido o DNI..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pacientes en {monthLabel}</p>
                <p className="text-lg font-bold">{patients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                multicapCount > 0 ? 'bg-red-500/10' : 'bg-green-500/10',
              )}>
                <AlertTriangle className={cn('h-5 w-5', multicapCount > 0 ? 'text-red-600' : 'text-green-600')} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pacientes Multicap</p>
                <p className="text-lg font-bold">{multicapCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mostrando</p>
                <p className="text-lg font-bold">{filtered.length} paciente(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filter === 'multicap' ? 'Pacientes registrados en múltiples CAPs' : 'Todos los pacientes con entregas'}
          </CardTitle>
          <CardDescription>
            {filter === 'multicap'
              ? 'Pacientes registrados en múltiples CAPs o con posibles duplicados (mismo nombre, distinto DNI)'
              : `Todas las entregas de ${monthLabel} ${year}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Cargando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <p className="text-muted-foreground font-medium">
                {filter === 'multicap'
                  ? 'No se detectaron pacientes multicap en este período'
                  : 'No hay entregas en este período'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>CAPs registrado</TableHead>
                    <TableHead className="text-center">Entregas</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((p) => {
                    const multi = isMulticap(p);
                    const hasNameDup = p.nameMatches.length > 0;
                    const hasCrossCap = p.capsRegistrado > 1 || p.capsConEntrega > 1;
                    return (
                      <TableRow key={p.dni}>
                        <TableCell className="font-medium">
                          {p.apellido}, {p.nombre}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.dni}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {hasCrossCap && (
                              <Badge variant="destructive" className="gap-1 w-fit">
                                <AlertTriangle className="h-3 w-3" />
                                Multicap
                              </Badge>
                            )}
                            {hasNameDup && (
                              <Badge className="gap-1 w-fit bg-amber-500 hover:bg-amber-600 text-white">
                                <Users className="h-3 w-3" />
                                Posible duplicado
                              </Badge>
                            )}
                            {!multi && (
                              <Badge variant="outline" className="text-green-700 w-fit">
                                Normal
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.registeredCaps.map((rc) => (
                              <Badge key={`${rc.cap_id}-${rc.dni}`} variant="secondary" className="text-xs">
                                CAP {rc.cap_numero}
                              </Badge>
                            ))}
                            {hasNameDup && p.nameMatches.map((nm) => (
                              <Badge key={`nm-${nm.cap_id}-${nm.dni}`} variant="outline" className="text-xs border-amber-400 text-amber-700">
                                CAP {nm.cap_numero} (DNI: {nm.dni})
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {p.totalEntregas}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              onClick={() => setDetailPatient(p)}
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                            {multi && (
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1"
                                onClick={() => openNotify(p)}
                              >
                                <Bell className="h-4 w-4" />
                                Alertar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    {filtered.length} paciente(s) — Página {page}/{totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal detalle paciente */}
      <Dialog open={!!detailPatient} onOpenChange={(o) => { if (!o) setDetailPatient(null); }}>
        <DialogContent className="max-w-2xl">
          {detailPatient && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {detailPatient.apellido}, {detailPatient.nombre}
                </DialogTitle>
                <DialogDescription>DNI: {detailPatient.dni}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* CAPs donde está registrado */}
                <div>
                  <Label className="text-sm font-medium">Registrado en (mismo DNI)</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {detailPatient.registeredCaps.map((rc) => (
                      <Badge key={`${rc.cap_id}-${rc.dni}`} variant="secondary">
                        CAP {rc.cap_numero} — {rc.cap_nombre}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Posibles duplicados por nombre */}
                {detailPatient.nameMatches.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <Label className="text-sm font-medium text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Posible duplicado — mismo nombre, distinto DNI
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {detailPatient.nameMatches.map((nm) => (
                        <Badge key={`nm-${nm.cap_id}-${nm.dni}`} variant="outline" className="border-amber-400 text-amber-700">
                          CAP {nm.cap_numero} — {nm.cap_nombre} (DNI: {nm.dni})
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                      Se encontraron registros con el mismo nombre y apellido pero con DNI distinto. Podrían ser la misma persona con un error de carga.
                    </p>
                  </div>
                )}

                {/* Tabla de entregas */}
                <div>
                  <Label className="text-sm font-medium">
                    Entregas en {monthLabel} {year}
                  </Label>
                  <div className="mt-2 max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>CAP</TableHead>
                          <TableHead>Anticonceptivo</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailPatient.deliveries.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="text-sm">
                              {new Date(d.fecha_entrega).toLocaleDateString('es-AR')}
                            </TableCell>
                            <TableCell>{getCapLabel(d.cap_id)}</TableCell>
                            <TableCell>
                              {d.tipo_nombre}
                              {d.tipo_codigo && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({d.tipo_codigo})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {d.cantidad}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailPatient(null)}>
                  Cerrar
                </Button>
                {isMulticap(detailPatient) && (
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setDetailPatient(null);
                      openNotify(detailPatient);
                    }}
                  >
                    <Bell className="h-4 w-4" />
                    Enviar Alerta
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal enviar alerta */}
      <Dialog open={!!notifyPatient} onOpenChange={(o) => { if (!o) setNotifyPatient(null); }}>
        <DialogContent className="max-w-lg">
          {notifyPatient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Enviar Alerta a CAPs
                </DialogTitle>
                <DialogDescription>
                  Notifique a otras CAPs que{' '}
                  <strong>
                    {notifyPatient.apellido}, {notifyPatient.nombre}
                  </strong>{' '}
                  (DNI: {notifyPatient.dni}) ya recibió anticonceptivos.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Selección de CAPs destino */}
                <div>
                  <Label className="text-sm font-medium">CAPs a notificar</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {getAllRelatedCaps(notifyPatient).map((rc) => {
                      const id = `notify-cap-${rc.cap_id}`;
                      return (
                        <div
                          key={rc.cap_id}
                          className={cn(
                            'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                            notifySelected[rc.cap_id]
                              ? 'border-primary bg-primary/5'
                              : 'border-muted',
                            rc.isNameMatch && 'border-amber-300',
                          )}
                        >
                          <Checkbox
                            id={id}
                            checked={!!notifySelected[rc.cap_id]}
                            onCheckedChange={(v) =>
                              setNotifySelected((prev) => ({
                                ...prev,
                                [rc.cap_id]: v === true,
                              }))
                            }
                          />
                          <label htmlFor={id} className="text-sm cursor-pointer flex-1">
                            <span className="font-medium">CAP {rc.cap_numero}</span>
                            <span className="text-muted-foreground"> — {rc.cap_nombre}</span>
                            {rc.isNameMatch && (
                              <Badge className="ml-2 text-[10px] bg-amber-100 text-amber-700 border-amber-300" variant="outline">
                                DNI: {rc.dni}
                              </Badge>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mensaje editable */}
                <div>
                  <Label className="text-sm font-medium">Mensaje</Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    Puede editar el mensaje antes de enviarlo
                  </p>
                  <Textarea
                    value={notifyMessage}
                    onChange={(e) => setNotifyMessage(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setNotifyPatient(null)}
                  disabled={notifyLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSendNotify}
                  disabled={
                    notifyLoading ||
                    !Object.values(notifySelected).some(Boolean) ||
                    !notifyMessage.trim()
                  }
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {notifyLoading ? 'Enviando...' : 'Enviar Alerta'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeliveredPatientsReport;
