import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Search, Pencil, Trash2, FileText, ChevronDown, ChevronRight,
  Package, Users, ChevronLeft, ChevronsLeft, ChevronsRight, ClipboardCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PacientesListProps {
  capNumber: number | null | undefined;
}

const PAGE_SIZE = 10;

const PacientesList = ({ capNumber }: PacientesListProps) => {
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [registrosPorPaciente, setRegistrosPorPaciente] = useState<Record<number, any[]>>({});
  const [entregasRealesPorPaciente, setEntregasRealesPorPaciente] = useState<Record<number, any[]>>({});
  const [entregasPorDni, setEntregasPorDni] = useState<Record<string, any[]>>({});
  const [capNumbers, setCapNumbers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [capId, setCapId] = useState<number | null>(null);
  const [expandedPaciente, setExpandedPaciente] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  // Delivery modal state
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryRegistro, setDeliveryRegistro] = useState<any | null>(null);
  const [deliveryPacienteSelected, setDeliveryPacienteSelected] = useState<number | null>(null);
  const [deliveryDateTime, setDeliveryDateTime] = useState('');
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryStock, setDeliveryStock] = useState<number | null>(null);
  const [deliveryInventario, setDeliveryInventario] = useState<any[]>([]);
  const [deliverySelectedInventarioId, setDeliverySelectedInventarioId] = useState<number | null>(null);
  const [deliveryCantidadManual, setDeliveryCantidadManual] = useState<number>(1);

  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ nombre: '', apellido: '', dni: '', edad: '' });

  // Filtered + paginated
  const filtered = useMemo(() => {
    if (!searchTerm) return pacientes;
    const q = searchTerm.toLowerCase();
    return pacientes.filter((p) =>
      `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(q),
    );
  }, [searchTerm, pacientes]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchTerm]);

  // Stats
  const totalPacientes = pacientes.length;
  const conEntregas = pacientes.filter((p) => (entregasRealesPorPaciente[p.id] || []).length > 0).length;
  const sinEntregas = totalPacientes - conEntregas;

  // ----- Data fetching -----
  useEffect(() => {
    if (!capNumber) return;
    (async () => {
      const { data } = await supabase.from('caps').select('id').eq('numero', capNumber).single();
      setCapId(data?.id || null);
    })();
  }, [capNumber]);

  useEffect(() => {
    if (!capId) return;
    fetchPacientes();
    const onEntrega = () => fetchPacientes();
    window.addEventListener('entrega:created', onEntrega);
    return () => window.removeEventListener('entrega:created', onEntrega);
  }, [capId]);

  const fetchPacientes = async () => {
    if (!capId) return;
    try {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('cap_id', capId)
        .order('apellido');
      if (error) throw error;
      setPacientes(data || []);

      if (data && data.length > 0) {
        const ids = data.map((p: any) => p.id);
        fetchRegistros(ids);
        fetchEntregasReales(ids);
        fetchEntregasMes(data);
      }
    } catch (error) {
      console.error('Error fetching pacientes:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los pacientes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistros = async (ids: number[]) => {
    if (!ids.length) return;
    const { data } = await supabase
      .from('registros_anticonceptivos')
      .select('*, tipo_anticonceptivo:tipos_anticonceptivos(id, nombre, marca, descripcion)')
      .in('paciente_id', ids)
      .order('fecha_entrega', { ascending: false });

    const map: Record<number, any[]> = {};
    (data || []).forEach((r: any) => {
      if (!map[r.paciente_id]) map[r.paciente_id] = [];
      map[r.paciente_id].push(r);
    });
    setRegistrosPorPaciente(map);
  };

  const fetchEntregasReales = async (ids: number[]) => {
    if (!ids.length) return;
    const { data } = await supabase
      .from('entregas_anticonceptivos')
      .select('*, tipo_anticonceptivo:tipos_anticonceptivos(id, nombre, marca, codigo)')
      .in('paciente_id', ids)
      .order('fecha_entrega', { ascending: false });

    const map: Record<number, any[]> = {};
    (data || []).forEach((e: any) => {
      if (!map[e.paciente_id]) map[e.paciente_id] = [];
      map[e.paciente_id].push(e);
    });
    setEntregasRealesPorPaciente(map);
  };

  const fetchEntregasMes = async (pacs: any[]) => {
    const dnis = Array.from(new Set(pacs.map((p: any) => p.dni).filter(Boolean)));
    if (!dnis.length) return;

    const first = new Date(); first.setDate(1); first.setHours(0, 0, 0, 0);
    const next = new Date(first); next.setMonth(first.getMonth() + 1);

    const { data: samePacs } = await supabase.from('pacientes').select('id, dni, cap_id').in('dni', dnis as string[]);
    const ids = (samePacs || []).map((s: any) => s.id);
    if (!ids.length) return;

    const { data: entregas } = await supabase
      .from('entregas_anticonceptivos')
      .select('id, paciente_id, tipo_anticonceptivo_id, cantidad, fecha_entrega, cap_id')
      .in('paciente_id', ids)
      .gte('fecha_entrega', first.toISOString())
      .lt('fecha_entrega', next.toISOString());

    const idToDni: Record<number, string> = {};
    (samePacs || []).forEach((s: any) => { idToDni[s.id] = s.dni; });

    const byDni: Record<string, any[]> = {};
    (entregas || []).forEach((e: any) => {
      const d = idToDni[e.paciente_id];
      if (!d) return;
      if (!byDni[d]) byDni[d] = [];
      byDni[d].push(e);
    });
    setEntregasPorDni(byDni);

    const capIds = Array.from(new Set((entregas || []).map((e: any) => e.cap_id).filter(Boolean)));
    if (capIds.length) {
      const { data: caps } = await supabase.from('caps').select('id, numero').in('id', capIds);
      const cmap: Record<number, string> = {};
      (caps || []).forEach((c: any) => { cmap[c.id] = c.numero; });
      setCapNumbers(cmap);
    }
  };

  // ----- CRUD -----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capId) { toast({ title: 'Error', description: 'No se pudo determinar el CAP', variant: 'destructive' }); return; }

    try {
      if (editingId) {
        const { data: existing } = await supabase.from('pacientes').select('id').eq('cap_id', capId).eq('dni', formData.dni).maybeSingle();
        if (existing && existing.id !== editingId) { toast({ title: 'Error', description: 'Ya existe otro paciente con ese DNI en este CAP.', variant: 'destructive' }); return; }
        const { error } = await supabase.from('pacientes').update({ nombre: formData.nombre, apellido: formData.apellido, dni: formData.dni, edad: parseInt(formData.edad) }).eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Paciente actualizado', description: 'Los datos se actualizaron correctamente' });
      } else {
        if (!formData.nombre.trim() || !formData.apellido.trim() || !formData.dni.trim()) { toast({ title: 'Error', description: 'Complete Nombre, Apellido y DNI.', variant: 'destructive' }); return; }
        const { data: existing } = await supabase.from('pacientes').select('id').eq('cap_id', capId).eq('dni', formData.dni).maybeSingle();
        if (existing) { toast({ title: 'Error', description: 'Ya existe un paciente con ese DNI en este CAP.', variant: 'destructive' }); return; }
        const { error } = await supabase.from('pacientes').insert([{ nombre: formData.nombre.trim(), apellido: formData.apellido.trim(), dni: formData.dni.trim(), edad: parseInt(formData.edad), cap_id: capId }]);
        if (error) throw error;
        toast({ title: 'Paciente registrado', description: 'Se agregó correctamente a la planilla' });
      }
      setOpen(false);
      setFormData({ nombre: '', apellido: '', dni: '', edad: '' });
      setEditingId(null);
      fetchPacientes();
    } catch (error: any) {
      const isConflict = error?.status === 409 || /duplicate key|unique constraint/i.test(error?.message || error?.details || '');
      toast({ title: 'Error', description: isConflict ? 'Ya existe un paciente con ese DNI.' : (error?.message || 'No se pudo guardar'), variant: 'destructive' });
    }
  };

  const handleEdit = (p: any) => { setEditingId(p.id); setFormData({ nombre: p.nombre, apellido: p.apellido, dni: p.dni, edad: p.edad.toString() }); setOpen(true); };
  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;
    try {
      const { error } = await supabase.from('pacientes').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Paciente eliminado' });
      fetchPacientes();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'No se pudo eliminar el paciente.', variant: 'destructive' });
    }
  };
  const handleNew = () => { setEditingId(null); setFormData({ nombre: '', apellido: '', dni: '', edad: '' }); setOpen(true); };

  // ----- Delivery helpers -----
  const openDeliveryFromRegistro = async (reg: any) => {
    setDeliveryRegistro(reg);
    setDeliveryPacienteSelected(null);
    setDeliveryDateTime(new Date().toISOString().slice(0, 16));
    setDeliveryLoading(true);
    try {
      const { data: inv } = await supabase.from('inventario_caps').select('stock').eq('cap_id', capId!).eq('tipo_anticonceptivo_id', reg.tipo_anticonceptivo_id).maybeSingle();
      setDeliveryStock(inv?.stock ?? null);
    } catch { setDeliveryStock(null); }
    finally { setDeliveryLoading(false); setDeliveryOpen(true); }
  };

  const openDeliveryManual = async (pacienteId: number) => {
    setDeliveryRegistro(null);
    setDeliveryPacienteSelected(pacienteId);
    setDeliveryDateTime(new Date().toISOString().slice(0, 16));
    setDeliverySelectedInventarioId(null);
    setDeliveryCantidadManual(1);
    setDeliveryLoading(true);
    try {
      const { data } = await supabase.from('inventario_caps').select('id, stock, tipo:tipos_anticonceptivos(id, nombre, marca)').eq('cap_id', capId!).order('tipo_anticonceptivo_id');
      setDeliveryInventario(data || []);
    } catch { setDeliveryInventario([]); }
    finally { setDeliveryLoading(false); setDeliveryOpen(true); }
  };

  const submitDeliveryRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capId || !deliveryRegistro) return;
    setDeliveryLoading(true);
    try {
      const { error } = await supabase.from('entregas_anticonceptivos').insert([{
        paciente_id: deliveryRegistro.paciente_id,
        tipo_anticonceptivo_id: deliveryRegistro.tipo_anticonceptivo_id,
        cantidad: deliveryRegistro.cantidad,
        fecha_entrega: new Date(deliveryDateTime).toISOString(),
        created_by: user?.id || null,
        cap_id: capId,
      }]);
      if (error) throw error;
      toast({ title: 'Entrega registrada' });
      setDeliveryOpen(false);
      fetchPacientes();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo registrar', variant: 'destructive' });
    } finally { setDeliveryLoading(false); }
  };

  const submitDeliveryManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capId || !deliveryPacienteSelected || !deliverySelectedInventarioId) { toast({ title: 'Error', description: 'Complete todos los campos', variant: 'destructive' }); return; }
    setDeliveryLoading(true);
    try {
      const inv = deliveryInventario.find((i) => i.id === deliverySelectedInventarioId);
      if (!inv) throw new Error('Inventario inválido');
      if (inv.stock < deliveryCantidadManual) throw new Error('Stock insuficiente');
      const { error } = await supabase.from('entregas_anticonceptivos').insert([{
        paciente_id: deliveryPacienteSelected,
        tipo_anticonceptivo_id: inv.tipo.id,
        cantidad: deliveryCantidadManual,
        fecha_entrega: new Date(deliveryDateTime).toISOString(),
        created_by: user?.id || null,
        cap_id: capId,
      }]);
      if (error) throw error;
      toast({ title: 'Entrega registrada' });
      setDeliveryOpen(false);
      fetchPacientes();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo registrar', variant: 'destructive' });
    } finally { setDeliveryLoading(false); }
  };

  // ----- Pagination controls -----
  const Pagination = () => {
    if (filtered.length <= PAGE_SIZE) return null;
    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage(1)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-sm font-medium">{safePage} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Planilla de Pacientes</h2>
            <p className="text-sm text-muted-foreground">Gestión de pacientes del CAP</p>
          </div>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo Paciente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{totalPacientes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
              <ClipboardCheck className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Con entregas</p>
              <p className="text-lg font-bold">{conEntregas}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sin entregas</p>
              <p className="text-lg font-bold">{sinEntregas}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
              <Search className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mostrando</p>
              <p className="text-lg font-bold">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, apellido o DNI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Patient list */}
      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Cargando planilla...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground mb-4">{searchTerm ? 'No se encontraron pacientes' : 'La planilla está vacía'}</p>
            {!searchTerm && (
              <Button onClick={handleNew} className="gap-2"><Plus className="h-4 w-4" /> Agregar Primer Paciente</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {paged.map((paciente, idx) => {
              const registros = registrosPorPaciente[paciente.id] || [];
              const entregas = entregasRealesPorPaciente[paciente.id] || [];
              const totalNecesidades = registros.reduce((s: number, r: any) => s + r.cantidad, 0);
              const totalEntregado = entregas.reduce((s: number, e: any) => s + e.cantidad, 0);
              const isExpanded = expandedPaciente === paciente.id;
              const globalIdx = (safePage - 1) * PAGE_SIZE + idx + 1;

              return (
                <Collapsible
                  key={paciente.id}
                  open={isExpanded}
                  onOpenChange={(o) => setExpandedPaciente(o ? paciente.id : null)}
                >
                  <Card className="border">
                    <CollapsibleTrigger asChild>
                      <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium shrink-0">
                              {globalIdx}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold truncate">{paciente.apellido}, {paciente.nombre}</span>
                                <Badge variant="outline" className="shrink-0">DNI: {paciente.dni}</Badge>
                                <Badge variant="secondary" className="shrink-0">{paciente.edad} años</Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 mt-1">
                                {registros.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Package className="h-3 w-3 text-primary" />
                                    <span className="text-xs text-muted-foreground">
                                      {registros.length} necesidad(es) · {totalNecesidades} uds.
                                    </span>
                                  </div>
                                )}
                                {entregas.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <ClipboardCheck className="h-3 w-3 text-green-600" />
                                    <span className="text-xs text-green-700">
                                      {entregas.length} entrega(s) · {totalEntregado} uds.
                                    </span>
                                  </div>
                                )}
                                {entregas.length === 0 && registros.length === 0 && (
                                  <span className="text-xs text-muted-foreground">Sin actividad registrada</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(paciente); }} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDelete(paciente.id); }} title="Eliminar">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={(e) => { e.stopPropagation(); openDeliveryManual(paciente.id); }}
                            >
                              Entrega
                            </Button>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t">
                        {/* Entregas realizadas */}
                        <div className="pt-3">
                          <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-green-600" />
                            Entregas realizadas
                          </h4>
                          {entregas.length === 0 ? (
                            <div className="py-4 text-center text-muted-foreground bg-muted/30 rounded-lg">
                              <p className="text-sm">Sin entregas registradas</p>
                              <p className="text-xs mt-1">Use "Entrega" o la sección "Entregas" para registrar.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Anticonceptivo</TableHead>
                                    <TableHead>Marca</TableHead>
                                    <TableHead className="text-center">Cantidad</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {entregas.map((e: any) => (
                                    <TableRow key={e.id}>
                                      <TableCell className="text-sm">{new Date(e.fecha_entrega).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                                      <TableCell className="text-sm">{e.tipo_anticonceptivo?.nombre || 'Desconocido'}</TableCell>
                                      <TableCell className="text-sm">{e.tipo_anticonceptivo?.marca || '-'}</TableCell>
                                      <TableCell className="text-center font-semibold">{e.cantidad}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              <p className="mt-1 text-xs text-muted-foreground text-center">
                                Total entregado: <strong>{totalEntregado} unidades</strong>
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Necesidades registradas */}
                        {registros.length > 0 && (
                          <div className="pt-4 mt-3 border-t">
                            <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                              <Package className="h-4 w-4 text-primary" />
                              Necesidades registradas
                            </h4>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Marca</TableHead>
                                    <TableHead className="text-center">Cant.</TableHead>
                                    <TableHead>Mes/Año</TableHead>
                                    <TableHead>Notas</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {registros.map((reg: any) => {
                                    const entregasForDni = entregasPorDni[paciente.dni] || [];
                                    const match = entregasForDni.find((en: any) => en.tipo_anticonceptivo_id === reg.tipo_anticonceptivo_id);
                                    return (
                                      <TableRow key={reg.id}>
                                        <TableCell className="text-sm">{new Date(reg.fecha_entrega).toLocaleDateString('es-AR')}</TableCell>
                                        <TableCell>
                                          <span className="text-sm">{reg.tipo_anticonceptivo?.nombre || 'Desconocido'}</span>
                                          {match && (
                                            <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                                              Entregado (CAP {capNumbers[match.cap_id] || match.cap_id})
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-sm">{reg.tipo_anticonceptivo?.marca || '-'}</TableCell>
                                        <TableCell className="text-center font-semibold">{reg.cantidad}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-xs">{reg.mes}/{reg.anio}</Badge></TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={reg.notas || ''}>{reg.notas || '-'}</TableCell>
                                        <TableCell className="text-right">
                                          <Button size="sm" className="h-7 text-xs" onClick={(ev) => { ev.stopPropagation(); openDeliveryFromRegistro(reg); }}>
                                            Registrar
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                              <p className="mt-1 text-xs text-muted-foreground text-center">
                                Total necesario: <strong>{totalNecesidades} unidades</strong>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
          <Pagination />
        </>
      )}

      {/* New / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar' : 'Nuevo'} Paciente</DialogTitle>
            <DialogDescription>{editingId ? 'Modifique los datos del paciente' : 'Complete la información para agregar un nuevo paciente'}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input id="nombre" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej: María" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido *</Label>
                  <Input id="apellido" value={formData.apellido} onChange={(e) => setFormData({ ...formData, apellido: e.target.value })} placeholder="Ej: González" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dni">DNI *</Label>
                  <Input id="dni" value={formData.dni} onChange={(e) => setFormData({ ...formData, dni: e.target.value })} placeholder="Ej: 12345678" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edad">Edad *</Label>
                  <Input id="edad" type="number" min="1" max="120" value={formData.edad} onChange={(e) => setFormData({ ...formData, edad: e.target.value })} placeholder="Ej: 25" required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? 'Actualizar' : 'Registrar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delivery dialog */}
      <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Entrega</DialogTitle>
            <DialogDescription>Registre la entrega para el paciente seleccionado.</DialogDescription>
          </DialogHeader>
          {deliveryRegistro ? (
            <form onSubmit={submitDeliveryRegistro}>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="text-sm font-medium">{deliveryRegistro?.tipo_anticonceptivo?.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cantidad</p>
                    <p className="text-sm font-medium">{deliveryRegistro?.cantidad}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Fecha y hora</Label>
                  <Input type="datetime-local" value={deliveryDateTime} onChange={(e) => setDeliveryDateTime(e.target.value)} required />
                </div>
                {deliveryStock !== null && (
                  <p className="text-sm text-muted-foreground">Stock disponible: <strong>{deliveryStock}</strong></p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDeliveryOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={deliveryLoading || (deliveryStock !== null && deliveryStock < (deliveryRegistro?.cantidad || 1))}>
                  {deliveryLoading ? 'Registrando...' : 'Confirmar'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={submitDeliveryManual}>
              <div className="space-y-4 py-2">
                <div>
                  <p className="text-xs text-muted-foreground">Paciente</p>
                  <p className="text-sm font-medium">
                    {(() => { const p = pacientes.find((p) => p.id === deliveryPacienteSelected); return p ? `${p.apellido}, ${p.nombre}` : ''; })()}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Anticonceptivo</Label>
                  <Select onValueChange={(v) => setDeliverySelectedInventarioId(parseInt(v || '0'))} value={deliverySelectedInventarioId?.toString() || ''}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar anticonceptivo" /></SelectTrigger>
                    <SelectContent>
                      {deliveryInventario.map((i) => (
                        <SelectItem key={i.id} value={i.id.toString()}>
                          {i.tipo.nombre} {i.tipo.marca ? `- ${i.tipo.marca}` : ''} · Stock: {i.stock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Cantidad</Label>
                  <Input type="number" min={1} value={deliveryCantidadManual} onChange={(e) => setDeliveryCantidadManual(parseInt(e.target.value || '1'))} />
                </div>
                <div className="space-y-1">
                  <Label>Fecha y hora</Label>
                  <Input type="datetime-local" value={deliveryDateTime} onChange={(e) => setDeliveryDateTime(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDeliveryOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={deliveryLoading || !deliverySelectedInventarioId}>
                  {deliveryLoading ? 'Registrando...' : 'Confirmar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PacientesList;
