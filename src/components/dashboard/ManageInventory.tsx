import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const [prevStock, setPrevStock] = useState<number | null>(null);
  const [inventories, setInventories] = useState<any[]>([]);
  const [search, setSearch] = useState<string>('');
  const [showLowOnly, setShowLowOnly] = useState<boolean>(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const stockRef = useRef<HTMLInputElement | null>(null);
  const editingStockRef = useRef<HTMLInputElement | null>(null);
  const [editingInventoryId, setEditingInventoryId] = useState<number | null>(null);
  const [editingStock, setEditingStock] = useState<number>(0);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchCaps();
    fetchAnticonceptivos();

    // Listener para abrir y preseleccionar cap desde reporte de entregas
    const handler = (e: CustomEvent) => {
      const cid = e?.detail?.capId;
      if (cid) setCapId(cid);
    };
    window.addEventListener('manage-inventory:open', handler as EventListener);

    return () => window.removeEventListener('manage-inventory:open', handler as EventListener);
  }, []);

  useEffect(() => {
    if (capId) fetchInventories(capId);
  }, [capId]);

  const fetchCaps = async () => {
    const { data } = await supabase.from('caps').select('*').order('numero');
    setCaps(data || []);
  };

  const fetchAnticonceptivos = async () => {
    const { data } = await supabase
      .from('tipos_anticonceptivos')
      .select('id, nombre, marca, codigo')
      .order('nombre');
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
    setPrevStock(data?.stock ?? null);
  };

  const isValidId = (v: any) => typeof v === 'number' && !isNaN(v);

  const fetchInventories = async (capId: number) => {
    if (!isValidId(capId)) return;
    const { data, error } = await supabase
      .from('inventario_caps')
      .select('id, stock, tipo_anticonceptivo_id, tipo:tipos_anticonceptivos(id, nombre, marca, codigo)')
      .eq('cap_id', capId)
      .order('tipo_anticonceptivo_id');

    if (error) {
      console.error('Error fetching inventories', error, error?.message, error?.details);
      setInventories([]);
      return;
    }

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

      // Registrar movimiento si hubo incremento/disminución (solo admins pueden insertar movimientos segun policies)
      if (prevStock !== null && prevStock !== stock) {
        const delta = stock - prevStock;
        const tipoMov = delta > 0 ? 'in' : 'out';

        const { error: moveError } = await supabase.from('inventario_movimientos').insert([{
          inventario_id: (await supabase.from('inventario_caps').select('id').eq('cap_id', capId).eq('tipo_anticonceptivo_id', selectedTipo).maybeSingle())?.data?.id,
          tipo: tipoMov,
          cantidad: Math.abs(delta),
          paciente_id: null,
          created_by: user?.id,
        }]);

        if (moveError) console.error('Error creating movement:', moveError);
      }

      toast({ title: 'Guardado', description: 'Stock actualizado correctamente' });
      fetchInventories(capId);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo actualizar stock', variant: 'destructive' });
    }
  };

  const handleSaveRow = async (inv: any) => {
    try {
      const newStock = editingStock;

      // If the inventory row exists, perform an update to avoid accidental inserts/overwrites
      if (inv?.id) {
        const { data, error } = await supabase.from('inventario_caps').update({ stock: newStock }).eq('id', inv.id).select().maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('No se pudo encontrar el registro para actualizar');
      } else {
        // fallback to upsert when no id is present
        const { error } = await supabase.from('inventario_caps').upsert([
          { cap_id: inv.cap_id, tipo_anticonceptivo_id: inv.tipo_anticonceptivo_id, stock: newStock },
        ]);
        if (error) throw error;
      }

      if (inv.stock !== null && inv.stock !== undefined && inv.stock !== newStock) {
        const delta = newStock - inv.stock;
        const tipoMov = delta > 0 ? 'in' : 'out';
        const { error: moveError } = await supabase.from('inventario_movimientos').insert([{
          inventario_id: inv.id,
          tipo: tipoMov,
          cantidad: Math.abs(delta),
          paciente_id: null,
          created_by: user?.id,
        }]);
        if (moveError) console.error('Error creating movement:', moveError);
      }

      // Update local state immediately to avoid UI reflows/accordion collapse
      setInventories((prev) => prev.map((p) => (p.id === inv.id ? { ...p, stock: newStock } : p)));
      // Close editor
      setEditingInventoryId(null);
      toast({ title: 'Guardado', description: 'Stock actualizado correctamente' });
      // Fetch in background to make sure server and UI stay in sync (delayed to avoid focus jumps)
      setTimeout(() => fetchInventories(inv.cap_id), 1000);
    } catch (err: any) {
      console.error('Error saving inventory row:', err);
      toast({ title: 'Error', description: err.message || 'No se pudo actualizar stock', variant: 'destructive' });
      // re-fetch to restore the view
      if (inv?.cap_id) fetchInventories(inv.cap_id);
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
          <Input
            placeholder="Buscar por nombre, marca o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
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
                    {a.codigo ? `${a.codigo} - ` : ''}
                    {a.nombre}
                    {a.marca ? ` - ${a.marca}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Stock</Label>
            <Input ref={stockRef as any} type="number" min={0} value={stock} onChange={(e) => setStock(parseInt(e.target.value || '0'))} />
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
                  <TableHead>Código</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventories
                  .filter((inv) => {
                    if (!search) return true;
                    const term = search.toLowerCase();
                    const nombre = (inv.tipo?.nombre || '').toLowerCase();
                    const marca = (inv.tipo?.marca || '').toLowerCase();
                    const codigo = (inv.tipo?.codigo || '').toLowerCase();
                    return (
                      nombre.includes(term) ||
                      marca.includes(term) ||
                      codigo.includes(term)
                    );
                  })
                  .filter((inv) => (showLowOnly ? inv.stock <= 5 : true))
                  .map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.tipo?.nombre}</TableCell>
                    <TableCell>{inv.tipo?.codigo || '-'}</TableCell>
                    <TableCell>{inv.tipo?.marca || '-'}</TableCell>
                    <TableCell>
                      {editingInventoryId === inv.id ? (
                        <Input ref={editingStockRef as any} type="number" min={0} value={editingStock} onChange={(e) => setEditingStock(parseInt(e.target.value || '0'))} className="w-24" />
                      ) : (
                        inv.stock <= 0 ? (
                          <Badge variant="destructive">{inv.stock}</Badge>
                        ) : inv.stock <= 5 ? (
                          <Badge variant="secondary">{inv.stock}</Badge>
                        ) : (
                          <Badge variant="outline">{inv.stock}</Badge>
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {editingInventoryId === inv.id ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => handleSaveRow(inv)}>Guardar</Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingInventoryId(null)}>Cancelar</Button>
                        </div>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => {
                            // Solo activar edición inline para esta fila (no cambiar filtros superiores)
                            setEditingInventoryId(inv.id);
                            setEditingStock(inv.stock);
                            setTimeout(() => (editingStockRef.current as any)?.focus?.(), 0);
                          }}>
                            Editar
                          </Button>
                          <Dialog 
                            open={movementsOpen && selectedInventoryId === inv.id} 
                            onOpenChange={(o) => { 
                              if (!o) {
                                setSelectedInventoryId(null);
                                setMovements([]);
                              }
                              setMovementsOpen(o);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={async () => { 
                                  setSelectedInventoryId(inv.id); 
                                  setMovementsOpen(true); 
                                  await fetchMovements(inv.id); 
                                }}
                              >
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
                                <Button onClick={() => {
                                  setMovementsOpen(false);
                                  setSelectedInventoryId(null);
                                  setMovements([]);
                                }}>Cerrar</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
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
