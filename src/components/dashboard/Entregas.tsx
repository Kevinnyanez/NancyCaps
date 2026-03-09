import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AlertTriangle, Search, ChevronLeft, ChevronRight, X, UserCheck, Package } from 'lucide-react';

interface EntregasProps {
  preselectedPaciente?: number | null;
}

interface Paciente { id: number; nombre: string; apellido: string; dni?: string }
interface InventarioRow { id: number; stock: number; tipo: { id: number; nombre: string; marca?: string; codigo?: string } }

const ITEMS_PER_PAGE = 5;

const Entregas = ({ preselectedPaciente = null }: EntregasProps) => {
  const { profile, user } = useAuth();
  const [capId, setCapId] = useState<number | null>(null);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [inventario, setInventario] = useState<InventarioRow[]>([]);
  const [selectedPaciente, setSelectedPaciente] = useState<number | null>(null);
  const [selectedInventarioId, setSelectedInventarioId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState<number>(1);
  const [fechaHora, setFechaHora] = useState<string>(new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [alreadyDelivered, setAlreadyDelivered] = useState(false);
  const [existingDeliveries, setExistingDeliveries] = useState<any[]>([]);
  const [capsMap, setCapsMap] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const [pacSearch, setPacSearch] = useState('');
  const [pacPage, setPacPage] = useState(1);
  const [invSearch, setInvSearch] = useState('');
  const [invPage, setInvPage] = useState(1);

  useEffect(() => {
    const loadCap = async () => {
      if (!profile?.cap_number) return;
      const res = await (supabase as any).from('caps').select('id').eq('numero', profile.cap_number).single();
      if (res?.data?.id) setCapId(res.data.id);
    };
    loadCap();
  }, [profile?.cap_number]);

  useEffect(() => {
    if (!capId) return;
    const load = async () => {
      const pacsRes = await (supabase as any).from('pacientes').select('id, nombre, apellido, dni').eq('cap_id', capId).order('apellido');
      setPacientes(pacsRes?.data || []);
      const invRes = await (supabase as any)
        .from('inventario_caps')
        .select('id, stock, tipo:tipos_anticonceptivos(id, nombre, marca, codigo)')
        .eq('cap_id', capId)
        .order('tipo_anticonceptivo_id');
      setInventario((invRes?.data || []).filter((i: InventarioRow) => i.stock > -1));
    };
    load();
  }, [capId]);

  useEffect(() => {
    const check = async () => {
      if (!selectedPaciente || !fechaHora) { setAlreadyDelivered(false); setExistingDeliveries([]); return; }
      const paciente = pacientes.find((p) => p.id === selectedPaciente);
      const dni = paciente?.dni;
      if (!dni) { setAlreadyDelivered(false); setExistingDeliveries([]); return; }
      const fecha = new Date(fechaHora);
      const start = new Date(fecha); start.setDate(1); start.setHours(0, 0, 0, 0);
      const next = new Date(start); next.setMonth(start.getMonth() + 1);
      try {
        const { data: samePacs } = await (supabase as any).from('pacientes').select('id, cap_id').eq('dni', dni);
        const ids = (samePacs || []).map((s: any) => s.id);
        if (ids.length === 0) { setAlreadyDelivered(false); setExistingDeliveries([]); return; }
        const res = await (supabase as any).from('entregas_anticonceptivos')
          .select('id, cantidad, fecha_entrega, tipo_anticonceptivo_id, cap_id, paciente_id')
          .in('paciente_id', ids)
          .gte('fecha_entrega', start.toISOString())
          .lt('fecha_entrega', next.toISOString());
        const entregas = res?.data || [];
        setExistingDeliveries(entregas);
        const capIds = Array.from(new Set(entregas.map((e: any) => e.cap_id).filter(Boolean)));
        if (capIds.length > 0) {
          const { data: caps } = await (supabase as any).from('caps').select('id, numero').in('id', capIds);
          const map: Record<number, string> = {};
          (caps || []).forEach((c: any) => { map[c.id] = c.numero; });
          setCapsMap(map);
        } else { setCapsMap({}); }
        const tipoId = selectedInventarioId ? inventario.find((i) => i.id === selectedInventarioId)?.tipo.id : null;
        setAlreadyDelivered(tipoId ? entregas.some((e: any) => e.tipo_anticonceptivo_id === tipoId) : entregas.length > 0);
      } catch { setAlreadyDelivered(false); setExistingDeliveries([]); }
    };
    check();
  }, [selectedPaciente, selectedInventarioId, fechaHora, inventario, pacientes]);

  useEffect(() => { if (preselectedPaciente) setSelectedPaciente(preselectedPaciente); }, [preselectedPaciente]);

  const fetchInventario = async () => {
    if (!capId) return;
    const res = await (supabase as any)
      .from('inventario_caps')
      .select('id, stock, tipo:tipos_anticonceptivos(id, nombre, marca, codigo)')
      .eq('cap_id', capId)
      .order('tipo_anticonceptivo_id');
    setInventario((res?.data || []).filter((i: InventarioRow) => i.stock > -1));
  };

  // Filtered lists
  const filteredPac = useMemo(() => {
    if (!pacSearch) return pacientes;
    const t = pacSearch.toLowerCase();
    return pacientes.filter((p) => `${p.apellido} ${p.nombre} ${p.dni || ''}`.toLowerCase().includes(t));
  }, [pacientes, pacSearch]);

  const filteredInv = useMemo(() => {
    if (!invSearch) return inventario;
    const t = invSearch.toLowerCase();
    return inventario.filter((i) => `${i.tipo.codigo || ''} ${i.tipo.nombre} ${i.tipo.marca || ''}`.toLowerCase().includes(t));
  }, [inventario, invSearch]);

  const pacTotalPages = Math.max(1, Math.ceil(filteredPac.length / ITEMS_PER_PAGE));
  const pacPaged = filteredPac.slice((pacPage - 1) * ITEMS_PER_PAGE, pacPage * ITEMS_PER_PAGE);

  const invTotalPages = Math.max(1, Math.ceil(filteredInv.length / ITEMS_PER_PAGE));
  const invPaged = filteredInv.slice((invPage - 1) * ITEMS_PER_PAGE, invPage * ITEMS_PER_PAGE);

  const selectedPacObj = pacientes.find((p) => p.id === selectedPaciente);
  const selectedInvObj = inventario.find((i) => i.id === selectedInventarioId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capId || !selectedPaciente || !selectedInventarioId) return;
    const inv = inventario.find((i) => i.id === selectedInventarioId);
    if (!inv) return toast({ title: 'Error', description: 'Inventario no válido', variant: 'destructive' });
    if (cantidad <= 0) return toast({ title: 'Error', description: 'Cantidad inválida', variant: 'destructive' });
    if (inv.stock < cantidad) return toast({ title: 'Error', description: `Stock insuficiente. Disponible: ${inv.stock}`, variant: 'destructive' });
    setLoading(true);
    try {
      if (existingDeliveries.length > 0) {
        const capNums = Array.from(new Set(existingDeliveries.map((ed: any) => capsMap[ed.cap_id] || ed.cap_id)));
        toast({ title: 'Aviso', description: `Se detectaron entregas previas (CAP ${capNums.join(', ')}). Se registrará igualmente.` });
      }
      const { error } = await (supabase as any).from('entregas_anticonceptivos').insert([{
        paciente_id: selectedPaciente, tipo_anticonceptivo_id: inv.tipo.id,
        cantidad, fecha_entrega: new Date(fechaHora).toISOString(), created_by: user?.id || null, cap_id: capId,
      }]);
      if (error) throw error;
      toast({ title: 'Entrega registrada', description: 'Se registró la entrega correctamente' });
      fetchInventario();
      try { window.dispatchEvent(new CustomEvent('entrega:created', { detail: { paciente_id: selectedPaciente, tipo_anticonceptivo_id: inv.tipo.id, cap_id: capId } })); } catch { /* noop */ }
      setSelectedPaciente(null);
      setSelectedInventarioId(null);
      setCantidad(1);
      setPacSearch('');
      setInvSearch('');
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleClear = () => {
    setSelectedPaciente(null);
    setSelectedInventarioId(null);
    setCantidad(1);
    setPacSearch('');
    setInvSearch('');
    setFechaHora(new Date().toISOString().slice(0, 16));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Entrega</CardTitle>
        <CardDescription>Buscá y seleccioná paciente y anticonceptivo. Escribí para filtrar al instante.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

          {/* === PACIENTE === */}
          <div>
            <Label className="mb-1.5 block font-medium">Paciente</Label>
            {selectedPacObj ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2.5">
                <UserCheck className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">
                  {selectedPacObj.apellido}, {selectedPacObj.nombre}
                  <span className="text-muted-foreground ml-2">DNI: {selectedPacObj.dni || 'S/D'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedPaciente(null); setPacSearch(''); }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Escribí nombre, apellido o DNI..."
                    value={pacSearch}
                    onChange={(e) => { setPacSearch(e.target.value); setPacPage(1); }}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <div className="rounded-lg border overflow-hidden">
                  {filteredPac.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {pacSearch ? 'No se encontraron pacientes' : 'Sin pacientes cargados'}
                    </p>
                  ) : (
                    <>
                      <div className="divide-y">
                        {pacPaged.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setSelectedPaciente(p.id); setPacSearch(''); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                              {p.apellido.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{p.apellido}, {p.nombre}</span>
                              {p.dni && <span className="text-xs text-muted-foreground ml-2">DNI: {p.dni}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                      {pacTotalPages > 1 && (
                        <div className="flex items-center justify-between border-t px-3 py-1.5 bg-muted/30">
                          <span className="text-[11px] text-muted-foreground">{filteredPac.length} paciente(s)</span>
                          <div className="flex items-center gap-1">
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={pacPage <= 1} onClick={() => setPacPage((p) => p - 1)}>
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[11px] text-muted-foreground">{pacPage}/{pacTotalPages}</span>
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={pacPage >= pacTotalPages} onClick={() => setPacPage((p) => p + 1)}>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Warnings */}
            {selectedPaciente && (alreadyDelivered || existingDeliveries.length > 0) && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                {alreadyDelivered && (
                  <div className="flex items-start gap-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Este paciente ya recibió este anticonceptivo en el período seleccionado.</span>
                  </div>
                )}
                {existingDeliveries.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-xs text-amber-700 font-medium">Entregas previas este mes:</p>
                    {existingDeliveries.map((e) => (
                      <div key={e.id} className="text-xs text-amber-600">
                        CAP {capsMap[e.cap_id] || e.cap_id} — {new Date(e.fecha_entrega).toLocaleDateString('es-AR')} — Cant: {e.cantidad}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* === ANTICONCEPTIVO === */}
          <div>
            <Label className="mb-1.5 block font-medium">Anticonceptivo</Label>
            {selectedInvObj ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-3 py-2.5">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">
                  {selectedInvObj.tipo.codigo && <span className="text-muted-foreground mr-1">[{selectedInvObj.tipo.codigo}]</span>}
                  {selectedInvObj.tipo.nombre}
                  {selectedInvObj.tipo.marca && <span className="text-muted-foreground ml-1">— {selectedInvObj.tipo.marca}</span>}
                </span>
                <Badge variant="secondary" className="text-xs shrink-0">Stock: {selectedInvObj.stock}</Badge>
                <button
                  type="button"
                  onClick={() => { setSelectedInventarioId(null); setInvSearch(''); }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Escribí nombre, marca o código..."
                    value={invSearch}
                    onChange={(e) => { setInvSearch(e.target.value); setInvPage(1); }}
                    className="pl-9"
                  />
                </div>
                <div className="rounded-lg border overflow-hidden">
                  {filteredInv.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {invSearch ? 'No se encontraron anticonceptivos' : 'Sin stock disponible'}
                    </p>
                  ) : (
                    <>
                      <div className="divide-y">
                        {invPaged.map((i) => (
                          <button
                            key={i.id}
                            type="button"
                            onClick={() => { setSelectedInventarioId(i.id); setInvSearch(''); }}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors',
                              i.stock === 0 && 'opacity-50',
                            )}
                            disabled={i.stock === 0}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 text-xs font-bold shrink-0">
                              {i.tipo.nombre.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm">
                                {i.tipo.codigo && <span className="text-muted-foreground mr-1">[{i.tipo.codigo}]</span>}
                                <span className="font-medium">{i.tipo.nombre}</span>
                                {i.tipo.marca && <span className="text-muted-foreground ml-1 text-xs">— {i.tipo.marca}</span>}
                              </div>
                            </div>
                            <Badge
                              variant={i.stock > 0 ? 'secondary' : 'destructive'}
                              className="text-xs shrink-0"
                            >
                              Stock: {i.stock}
                            </Badge>
                          </button>
                        ))}
                      </div>
                      {invTotalPages > 1 && (
                        <div className="flex items-center justify-between border-t px-3 py-1.5 bg-muted/30">
                          <span className="text-[11px] text-muted-foreground">{filteredInv.length} producto(s)</span>
                          <div className="flex items-center gap-1">
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={invPage <= 1} onClick={() => setInvPage((p) => p - 1)}>
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[11px] text-muted-foreground">{invPage}/{invTotalPages}</span>
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={invPage >= invTotalPages} onClick={() => setInvPage((p) => p + 1)}>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cantidad + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block">Cantidad</Label>
              <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(parseInt(e.target.value || '1'))} />
            </div>
            <div>
              <Label className="mb-1.5 block">Fecha y hora</Label>
              <Input type="datetime-local" value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !selectedPaciente || !selectedInventarioId}>
              {loading ? 'Registrando...' : 'Registrar Entrega'}
            </Button>
            <Button type="button" variant="outline" onClick={handleClear}>Limpiar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default Entregas;
