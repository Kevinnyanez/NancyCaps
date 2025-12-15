import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';

const ManageInventory = () => {
  const [caps, setCaps] = useState<any[]>([]);
  const [anticonceptivos, setAnticonceptivos] = useState<any[]>([]);
  const [capId, setCapId] = useState<number | null>(null);
  const [selectedTipo, setSelectedTipo] = useState<number | null>(null);
  const [stock, setStock] = useState<number>(0);
  const [inventories, setInventories] = useState<any[]>([]);
  const [search, setSearch] = useState<string>('');
  const [showLowOnly, setShowLowOnly] = useState<boolean>(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchCaps();
    fetchAnticonceptivos();
  }, []);

  useEffect(() => {
    if (capId) fetchInventories(capId);
  }, [capId]);

  const fetchCaps = async () => {
    const { data } = await supabase.from('caps').select('*').order('numero');
    setCaps(data || []);
  };

  const fetchAnticonceptivos = async () => {
    const { data } = await supabase.from('tipos_anticonceptivos').select('*').order('nombre');
    setAnticonceptivos(data || []);
  };

  const fetchInventory = async (capId: number, tipoId: number) => {
    const { data } = await supabase
      .from('inventario_caps')
      .select('*')
      .eq('cap_id', capId)
      .eq('tipo_anticonceptivo_id', tipoId)
      .maybeSingle();

    setStock(data?.stock ?? 0);
  };

  const fetchInventories = async (capId: number) => {
    const { data } = await supabase
      .from('inventario_caps')
      .select('id, stock, tipo_anticonceptivo_id, tipo:tipos_anticonceptivos(id, nombre, marca)')
      .eq('cap_id', capId)
      .order('tipo_anticonceptivo_id');

    setInventories(data || []);
  };

  const fetchMovements = async (inventoryId: number) => {
    const { data } = await supabase
      .from('inventario_movimientos')
      .select('id, tipo, cantidad, paciente_id, created_by, created_at, paciente:pacientes(id, nombre, apellido)')
      .eq('inventario_id', inventoryId)
      .order('created_at', { ascending: false });

    setMovements(data || []);
  };

  useEffect(() => {
    if (capId && selectedTipo) fetchInventory(capId, selectedTipo);
  }, [capId, selectedTipo]);

  const handleSave = async () => {
    if (!capId || !selectedTipo) return;

    try {
      const { error } = await supabase.from('inventario_caps').upsert([
        { cap_id: capId, tipo_anticonceptivo_id: selectedTipo, stock },
      ]);

      if (error) throw error;

      toast({ title: 'Guardado', description: 'Stock actualizado correctamente' });
      fetchInventories(capId);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo actualizar stock', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Inventario por CAP</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <Input placeholder="Buscar por nombre..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <Button variant={showLowOnly ? 'default' : 'outline'} onClick={() => setShowLowOnly((s) => !s)} size="sm">
            {showLowOnly ? 'Mostrar todos' : 'Solo bajo stock'}
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-4 max-w-xl">
          <div>
            <Label>CAP</Label>
            <Select onValueChange={(v) => setCapId(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar CAP" />
              </SelectTrigger>
              <SelectContent>
                {caps.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.numero} - {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Anticonceptivo</Label>
            <Select onValueChange={(v) => setSelectedTipo(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {anticonceptivos.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Stock</Label>
            <Input type="number" min={0} value={stock} onChange={(e) => setStock(parseInt(e.target.value || '0'))} />
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={handleSave} disabled={!capId || !selectedTipo}>
            Guardar
          </Button>
        </div>

        {capId && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Inventario CAP</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventories
                  .filter((inv) => (search ? (inv.tipo?.nombre || '').toLowerCase().includes(search.toLowerCase()) : true))
                  .filter((inv) => (showLowOnly ? inv.stock <= 5 : true))
                  .map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.tipo?.nombre}</TableCell>
                    <TableCell>{inv.tipo?.marca || '-'}</TableCell>
                    <TableCell>
                      {inv.stock <= 0 ? (
                        <Badge variant="destructive">{inv.stock}</Badge>
                      ) : inv.stock <= 5 ? (
                        <Badge variant="secondary">{inv.stock}</Badge>
                      ) : (
                        <Badge variant="outline">{inv.stock}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedTipo(inv.tipo_anticonceptivo_id); setStock(inv.stock); }}>
                        Editar
                      </Button>
                      <Dialog open={movementsOpen && selectedInventoryId === inv.id} onOpenChange={(o) => { setMovementsOpen(o); if (!o) { setSelectedInventoryId(null); setMovements([]); } }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={async () => { setSelectedInventoryId(inv.id); setMovementsOpen(true); await fetchMovements(inv.id); }}>
                            Ver Movimientos
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Movimientos - {inv.tipo?.nombre}</DialogTitle>
                          </DialogHeader>
                          <div className="py-2">
                            {movements.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Sin movimientos</p>
                            ) : (
                              <ul className="space-y-2">
                                {movements.map((m) => (
                                  <li key={m.id} className="flex justify-between">
                                    <div>
                                      <div className="text-sm">{m.tipo === 'in' ? 'Ingreso' : 'Egreso'} • {m.cantidad}</div>
                                      <div className="text-xs text-muted-foreground">{m.paciente ? `${m.paciente.apellido}, ${m.paciente.nombre}` : m.created_by} • {format(new Date(m.created_at), 'yyyy-MM-dd HH:mm')}</div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <DialogFooter>
                            <Button onClick={() => setMovementsOpen(false)}>Cerrar</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ManageInventory;
