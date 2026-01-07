import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface EntregasProps {
  preselectedPaciente?: number | null;
}

interface CapsId { id: number }
interface Paciente { id: number; nombre: string; apellido: string; dni?: string }
interface InventarioRow { id: number; stock: number; tipo: { id: number; nombre: string; marca?: string } }

const Entregas = ({ preselectedPaciente = null }: EntregasProps) => {
  const { profile, user } = useAuth();
  const [capId, setCapId] = useState<number | null>(null);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [inventario, setInventario] = useState<InventarioRow[]>([]);
  const [selectedPaciente, setSelectedPaciente] = useState<number | null>(null);
  const [selectedInventarioId, setSelectedInventarioId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState<number>(1);
  const [fechaHora, setFechaHora] = useState<string>(new Date().toISOString().slice(0,16));
  const [loading, setLoading] = useState(false);
  const [alreadyDelivered, setAlreadyDelivered] = useState<boolean>(false);
  const [existingDeliveries, setExistingDeliveries] = useState<any[]>([]);
  const [capsMap, setCapsMap] = useState<Record<number,string>>({});
  const { toast } = useToast();

  useEffect(() => {
    const loadCap = async () => {
      if (!profile?.cap_number) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (supabase as any).from('caps').select('id').eq('numero', profile.cap_number).single();
      const data = res?.data as CapsId | null;
      if (data?.id) setCapId(data.id);
    };
    loadCap();
  }, [profile?.cap_number]);

  useEffect(() => {
    if (!capId) return;
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pacsRes = await (supabase as any).from('pacientes').select('id, nombre, apellido, dni').eq('cap_id', capId).order('apellido');
      setPacientes(pacsRes?.data || []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invRes = await (supabase as any)
        .from('inventario_caps')
        .select('id, stock, tipo:tipos_anticonceptivos(id, nombre, marca)')
        .eq('cap_id', capId)
        .order('tipo_anticonceptivo_id');

      setInventario((invRes?.data || []).filter((i: InventarioRow) => i.stock > -1));
    };
    load();
  }, [capId]);

  // Verificar si ya se entregó el tipo elegido a este paciente en el mes seleccionado (incluye otras CAPs por DNI)
  useEffect(() => {
    const check = async () => {
      if (!selectedPaciente || !fechaHora) { setAlreadyDelivered(false); setExistingDeliveries([]); return; }
      const paciente = pacientes.find(p => p.id === selectedPaciente);
      const dni = paciente?.dni;
      if (!dni) { setAlreadyDelivered(false); setExistingDeliveries([]); return; }

      const fecha = new Date(fechaHora);
      const start = new Date(fecha);
      start.setDate(1); start.setHours(0,0,0,0);
      const next = new Date(start); next.setMonth(start.getMonth() + 1);

      try {
        // Buscar todos los pacientes con el mismo DNI (posibles otros CAPs)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: samePacs } = await (supabase as any).from('pacientes').select('id, cap_id').eq('dni', dni);
        const ids = (samePacs || []).map((s: any) => s.id);
        if (ids.length === 0) { setAlreadyDelivered(false); setExistingDeliveries([]); return; }

        // Buscar entregas realizadas a esos pacientes en el mismo mes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (supabase as any).from('entregas_anticonceptivos')
          .select('id, cantidad, fecha_entrega, tipo_anticonceptivo_id, cap_id, paciente_id')
          .in('paciente_id', ids)
          .gte('fecha_entrega', start.toISOString())
          .lt('fecha_entrega', next.toISOString());

        const entregas = res?.data || [];
        setExistingDeliveries(entregas);

        // Obtener mapas de CAPS para mostrar número
        const capIds = Array.from(new Set(entregas.map((e: any) => e.cap_id).filter(Boolean)));
        if (capIds.length > 0) {
          const { data: caps } = await (supabase as any).from('caps').select('id, numero').in('id', capIds);
          const map: Record<number,string> = {};
          (caps || []).forEach((c: any) => { map[c.id] = c.numero; });
          setCapsMap(map);
        } else {
          setCapsMap({});
        }

        // Determinar si ya recibió el mismo tipo
        const tipoId = selectedInventarioId ? inventario.find(i => i.id === selectedInventarioId)?.tipo.id : null;
        if (tipoId) {
          setAlreadyDelivered(entregas.some((e: any) => e.tipo_anticonceptivo_id === tipoId));
        } else {
          setAlreadyDelivered(entregas.length > 0);
        }
      } catch (err) {
        setAlreadyDelivered(false);
        setExistingDeliveries([]);
      }
    };

    check();
  }, [selectedPaciente, selectedInventarioId, fechaHora, inventario, pacientes]);

  useEffect(() => {
    if (preselectedPaciente) setSelectedPaciente(preselectedPaciente);
  }, [preselectedPaciente]);

  const fetchCapId = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (supabase as any).from('caps').select('id').eq('numero', profile?.cap_number).single();
    const data = res?.data as CapsId | null;
    if (data?.id) setCapId(data.id);
  };

  const fetchPacientes = async () => {
    if (!capId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (supabase as any).from('pacientes').select('id, nombre, apellido, dni').eq('cap_id', capId).order('apellido');
    setPacientes(res?.data || []);
  };

  const fetchInventario = async () => {
    if (!capId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (supabase as any)
      .from('inventario_caps')
      .select('id, stock, tipo:tipos_anticonceptivos(id, nombre, marca)')
      .eq('cap_id', capId)
      .order('tipo_anticonceptivo_id');

    setInventario((res?.data || []).filter((i: InventarioRow) => i.stock > -1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capId || !selectedPaciente || !selectedInventarioId) return;

    const inv = inventario.find((i) => i.id === selectedInventarioId);
    if (!inv) return toast({ title: 'Error', description: 'Inventario no válido', variant: 'destructive' });
    if (cantidad <= 0) return toast({ title: 'Error', description: 'Cantidad inválida', variant: 'destructive' });
    if (inv.stock < cantidad) return toast({ title: 'Error', description: `Stock insuficiente. Disponible: ${inv.stock}`, variant: 'destructive' });

    setLoading(true);
    try {
      // Advertencia: si hay entregas previas en el mes (en cualquier CAP con mismo DNI), avisar pero permitir registro
      const fechaIso = new Date(fechaHora).toISOString();
      if (existingDeliveries && existingDeliveries.length > 0) {
        const caps = Array.from(new Set(existingDeliveries.map((e: any) => capsMap[e.cap_id] || e.cap_id)));
        const dates = existingDeliveries.map((e: any) => new Date(e.fecha_entrega).toLocaleDateString('es-AR'));
        toast({ title: 'Aviso', description: `Se detectaron entregas previas (${caps.join(', ')} • ${dates.join(', ')}). Se procederá a registrar igualmente.`, variant: 'warning' });
      }

      // use any to avoid strict generated types mismatch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('entregas_anticonceptivos').insert([{
        paciente_id: selectedPaciente,
        tipo_anticonceptivo_id: inv.tipo.id,
        cantidad,
        fecha_entrega: fechaIso,
        created_by: user?.id || null,
        cap_id: capId,
      }]);

      if (error) throw error;

      toast({ title: 'Entrega registrada', description: 'Se registró la entrega correctamente' });
      // refresh inventario
      fetchInventario();
      // notify other components
      try {
        window.dispatchEvent(new CustomEvent('entrega:created', { detail: { paciente_id: selectedPaciente, tipo_anticonceptivo_id: inv.tipo.id, cap_id: capId } }));
      } catch (e) {
        // noop
      }
      setSelectedPaciente(null);
      setSelectedInventarioId(null);
      setCantidad(1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: 'Error', description: message || 'No se pudo registrar la entrega', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Registrar Entrega</CardTitle>
          <CardDescription>Registre entrega de anticonceptivos seleccionando paciente y producto disponible en el stock de su CAP.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 max-w-2xl">
          <div>
            <Label>Paciente</Label>
            <Select onValueChange={(v) => setSelectedPaciente(parseInt(v || '0'))} value={selectedPaciente?.toString() || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar paciente" />
              </SelectTrigger>
              <SelectContent>
                {pacientes.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.apellido}, {p.nombre} - DNI: {p.dni}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(alreadyDelivered || (existingDeliveries && existingDeliveries.length > 0)) && (
              <div className="mt-2">
                {alreadyDelivered && <div className="text-sm text-destructive">Este paciente ya recibió este anticonceptivo en el periodo seleccionado.</div>}
                {(existingDeliveries || []).length > 0 && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Entregas en el mismo mes: {(existingDeliveries || []).map((e, idx) => (
                      <div key={e.id} className="text-xs">
                        CAP {capsMap[e.cap_id] || e.cap_id} • {new Date(e.fecha_entrega).toLocaleString('es-AR')} • Cantidad: {e.cantidad}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>Anticonceptivo (stock disponible)</Label>
            <Select onValueChange={(v) => setSelectedInventarioId(parseInt(v || '0'))} value={selectedInventarioId?.toString() || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar anticonceptivo" />
              </SelectTrigger>
              <SelectContent>
                {inventario.map((i) => (
                  <SelectItem key={i.id} value={i.id.toString()}>{i.tipo.nombre} {i.tipo.marca ? `- ${i.tipo.marca}` : ''} • Disponible: {i.stock}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cantidad</Label>
              <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(parseInt(e.target.value || '1'))} />
            </div>
            <div>
              <Label>Fecha y hora</Label>
              <Input type="datetime-local" value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !selectedPaciente || !selectedInventarioId}>{loading ? 'Registrando...' : 'Registrar Entrega'}</Button>
            <Button variant="outline" onClick={() => { setSelectedPaciente(null); setSelectedInventarioId(null); setCantidad(1); }}>Limpiar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default Entregas;
