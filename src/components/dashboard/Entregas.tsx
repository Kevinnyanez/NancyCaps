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
      // use any to avoid strict generated types mismatch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('entregas_anticonceptivos').insert([{
        paciente_id: selectedPaciente,
        tipo_anticonceptivo_id: inv.tipo.id,
        cantidad,
        fecha_entrega: new Date(fechaHora).toISOString(),
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
