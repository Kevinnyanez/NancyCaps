import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Pencil, Trash2, FileText, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PacientesListProps {
  capNumber: number | null | undefined;
}

const PacientesList = ({ capNumber }: PacientesListProps) => {
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [filteredPacientes, setFilteredPacientes] = useState<any[]>([]);
  const [registrosPorPaciente, setRegistrosPorPaciente] = useState<Record<number, any[]>>({});
  const [entregasPorDni, setEntregasPorDni] = useState<Record<string, any[]>>({});
  const [capNumbers, setCapNumbers] = useState<Record<number,string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [capId, setCapId] = useState<number | null>(null);
  const [expandedPaciente, setExpandedPaciente] = useState<number | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryRegistro, setDeliveryRegistro] = useState<any | null>(null);
  const [deliveryPacienteSelected, setDeliveryPacienteSelected] = useState<number | null>(null);
  const [deliveryDateTime, setDeliveryDateTime] = useState<string>('');
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryStock, setDeliveryStock] = useState<number | null>(null);
  const [deliveryInventario, setDeliveryInventario] = useState<any[]>([]);
  const [deliverySelectedInventarioId, setDeliverySelectedInventarioId] = useState<number | null>(null);
  const [deliveryCantidadManual, setDeliveryCantidadManual] = useState<number>(1);
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    edad: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCapId();
  }, [capNumber]);

  useEffect(() => {
    if (capId) {
      fetchPacientes();
    }
    const onEntrega = (e: Event) => {
      // @ts-ignore
      const d = e?.detail;
      if (!d) return;
      // refresh if it's this cap or patient
      if (d.cap_id === capId || d.paciente_id) fetchPacientes();
    };

    window.addEventListener('entrega:created', onEntrega as EventListener);
    return () => window.removeEventListener('entrega:created', onEntrega as EventListener);
  }, [capId]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = pacientes.filter((p) =>
        `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPacientes(filtered);
    } else {
      setFilteredPacientes(pacientes);
    }
  }, [searchTerm, pacientes]);

  const fetchCapId = async () => {
    if (!capNumber) return;

    try {
      const { data } = await supabase
        .from('caps')
        .select('id')
        .eq('numero', capNumber)
        .single();

      setCapId(data?.id || null);
    } catch (error) {
      console.error('Error fetching CAP ID:', error);
    }
  };

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
      setFilteredPacientes(data || []);
      
      // Cargar registros de anticonceptivos para cada paciente
      if (data && data.length > 0) {
        fetchRegistrosAnticonceptivos(data.map(p => p.id));
        // Cargar entregas del mes actual para marcar como entregado (incluye entregas en otras CAPs con mismo DNI)
        const first = new Date();
        first.setDate(1);
        first.setHours(0,0,0,0);
        const next = new Date(first);
        next.setMonth(first.getMonth() + 1);

        try {
          const dnis = Array.from(new Set((data || []).map((p: any) => p.dni).filter(Boolean)));
          if (dnis.length === 0) return;

          // Buscar todos los pacientes que comparten estos DNIs (pueden ser de otras CAPs)
          const { data: samePacs } = await supabase.from('pacientes').select('id, dni, cap_id').in('dni', dnis as string[]);
          const ids = (samePacs || []).map((s: any) => s.id);
          if (ids.length === 0) return;

          const { data: entregas } = await supabase
            .from('entregas_anticonceptivos')
            .select('id, paciente_id, tipo_anticonceptivo_id, cantidad, fecha_entrega, cap_id')
            .in('paciente_id', ids)
            .gte('fecha_entrega', first.toISOString())
            .lt('fecha_entrega', next.toISOString());

          // Map paciente_id -> dni
          const idToDni: Record<number,string> = {};
          (samePacs || []).forEach((s: any) => { idToDni[s.id] = s.dni; });

          const entregasByDni: Record<string, any[]> = {};
          (entregas || []).forEach((e: any) => {
            const d = idToDni[e.paciente_id];
            if (!d) return;
            if (!entregasByDni[d]) entregasByDni[d] = [];
            entregasByDni[d].push(e);
          });

          const capIds = Array.from(new Set((entregas || []).map((e: any) => e.cap_id).filter(Boolean)));
          if (capIds.length > 0) {
            const { data: caps } = await supabase.from('caps').select('id, numero').in('id', capIds);
            const cmap: Record<number,string> = {};
            (caps || []).forEach((c: any) => { cmap[c.id] = c.numero; });
            setCapNumbers(cmap);
          }

          setEntregasPorDni(entregasByDni);
        } catch (err) {
          // noop
        }
      }
    } catch (error) {
      console.error('Error fetching pacientes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los pacientes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrosAnticonceptivos = async (pacienteIds: number[]) => {
    if (!pacienteIds || pacienteIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('registros_anticonceptivos')
        .select(`
          *,
          tipo_anticonceptivo:tipos_anticonceptivos(id, nombre, marca, descripcion)
        `)
        .in('paciente_id', pacienteIds)
        .order('fecha_entrega', { ascending: false });

      if (error) throw error;

      // Agrupar registros por paciente_id
      const registrosMap: Record<number, any[]> = {};
      data?.forEach((reg: any) => {
        if (reg.paciente_id) {
          if (!registrosMap[reg.paciente_id]) {
            registrosMap[reg.paciente_id] = [];
          }
          registrosMap[reg.paciente_id].push(reg);
        }
      });

      setRegistrosPorPaciente(registrosMap);
    } catch (error) {
      console.error('Error fetching registros:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!capId) {
      toast({
        title: 'Error',
        description: 'No se pudo determinar el CAP',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingId) {        // Check duplicates when updating: ensure no other patient in same CAP has this DNI
        const { data: existing } = await supabase
          .from('pacientes')
          .select('id')
          .eq('cap_id', capId)
          .eq('dni', formData.dni)
          .maybeSingle();

        if (existing && existing.id && existing.id !== editingId) {
          toast({ title: 'Error', description: 'Ya existe otro paciente con ese DNI en este CAP.', variant: 'destructive' });
          return;
        }
        // Actualizar paciente existente
        const { error } = await supabase
          .from('pacientes')
          .update({
            nombre: formData.nombre,
            apellido: formData.apellido,
            dni: formData.dni,
            edad: parseInt(formData.edad),
          })
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Paciente actualizado',
          description: 'Los datos del paciente se actualizaron correctamente',
        });
      } else {
        // Check if a patient with same DNI exists in the same CAP (prevent duplicate per CAP)
        const { data: existing } = await supabase
          .from('pacientes')
          .select('id')
          .eq('cap_id', capId)
          .eq('dni', formData.dni)
          .maybeSingle();

        if (existing && existing.id) {
          toast({ title: 'Error', description: 'Ya existe un paciente con ese DNI en este CAP.', variant: 'destructive' });
          return;
        }

        // Crear nuevo paciente (validar campos)
        if (!formData.nombre?.trim() || !formData.apellido?.trim() || !formData.dni?.trim()) {
          toast({ title: 'Error', description: 'Complete Nombre, Apellido y DNI del paciente.', variant: 'destructive' });
          return;
        }
        const { error } = await supabase
          .from('pacientes')
          .insert([{
            nombre: formData.nombre.trim(),
            apellido: formData.apellido.trim(),
            dni: formData.dni.trim(),
            edad: parseInt(formData.edad),
            cap_id: capId,
          }]);

        if (error) throw error;

        toast({
          title: 'Paciente registrado',
          description: 'El paciente se agregó correctamente a la planilla',
        });
      }

      setOpen(false);
      setFormData({ nombre: '', apellido: '', dni: '', edad: '' });
      setEditingId(null);
      fetchPacientes();
    } catch (error: any) {
      console.error('Error saving paciente:', error, error?.message, error?.details);
      // Detectar conflicto por UNIQUE y dar mensaje más claro
      const isConflict = error?.status === 409 || /duplicate key|unique constraint/i.test(error?.message || error?.details || '');
      const description = isConflict
        ? 'Ya existe un paciente con ese DNI. Si corresponde que el mismo DNI pueda registrarse en varios CAPs, aplica la migración para hacer el DNI único por (dni, cap_id).' 
        : (error?.message || error?.details || 'No se pudo guardar el paciente');

      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (paciente: any) => {
    setEditingId(paciente.id);
    setFormData({
      nombre: paciente.nombre,
      apellido: paciente.apellido,
      dni: paciente.dni,
      edad: paciente.edad.toString(),
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este paciente de la planilla? Esta acción no se puede deshacer.')) return;

    try {
      const { error } = await supabase
        .from('pacientes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Paciente eliminado',
        description: 'El paciente se eliminó de la planilla correctamente',
      });
      
      fetchPacientes();
    } catch (error: any) {
      console.error('Error deleting paciente:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el paciente. Verifica que no tenga registros de anticonceptivos asociados.',
        variant: 'destructive',
      });
    }
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({ nombre: '', apellido: '', dni: '', edad: '' });
    setOpen(true);
  };

  const getTotalAnticonceptivos = (pacienteId: number) => {
    const registros = registrosPorPaciente[pacienteId] || [];
    return registros.reduce((sum, reg) => sum + reg.cantidad, 0);
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Planilla de Pacientes</CardTitle>
            <CardDescription>
              Gestiona la planilla de pacientes de tu CAP. Puedes agregar, editar y eliminar pacientes.
              Haz clic en una fila para ver los anticonceptivos que necesita cada paciente este mes.
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNew}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Paciente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Editar' : 'Nuevo'} Paciente
                </DialogTitle>
                <DialogDescription>
                  {editingId 
                    ? 'Modifica los datos del paciente en la planilla'
                    : 'Complete la información para agregar un nuevo paciente a la planilla'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre *</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: María"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apellido">Apellido *</Label>
                      <Input
                        id="apellido"
                        value={formData.apellido}
                        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                        placeholder="Ej: González"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dni">DNI *</Label>
                      <Input
                        id="dni"
                        value={formData.dni}
                        onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                        placeholder="Ej: 12345678"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edad">Edad *</Label>
                      <Input
                        id="edad"
                        type="number"
                        min="1"
                        max="120"
                        value={formData.edad}
                        onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                        placeholder="Ej: 25"
                        required
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingId ? 'Actualizar' : 'Registrar'} Paciente
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, apellido o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando planilla...</p>
        ) : filteredPacientes.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No se encontraron pacientes' : 'La planilla está vacía'}
            </p>
            {!searchTerm && (
              <Button onClick={handleNew}>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Primer Paciente
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPacientes.map((paciente, index) => {
              const registros = registrosPorPaciente[paciente.id] || [];
              const totalAnticonceptivos = getTotalAnticonceptivos(paciente.id);
              const isExpanded = expandedPaciente === paciente.id;

              return (
                <Collapsible
                  key={paciente.id}
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedPaciente(open ? paciente.id : null)}
                >
                  <Card className="border">
                    <CollapsibleTrigger asChild>
                      <div className="p-4 cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-8 text-center text-muted-foreground font-medium">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div className="font-semibold">
                                  {paciente.apellido}, {paciente.nombre}
                                </div>
                                <Badge variant="outline">DNI: {paciente.dni}</Badge>
                                <Badge variant="secondary">{paciente.edad} años</Badge>
                                {registros.length > 0 && (
                                  <Badge className="bg-primary/10 text-primary">
                                    <Package className="w-3 h-3 mr-1" />
                                    {registros.length} necesidad(es) - {totalAnticonceptivos} unidades
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(paciente);
                              }}
                              title="Editar paciente"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(paciente.id);
                              }}
                              title="Eliminar paciente"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!capId) return;
                                setDeliveryRegistro(null);
                                setDeliveryPacienteSelected(paciente.id);
                                setDeliveryLoading(true);
                                try {
                                  const { data } = await supabase
                                    .from('inventario_caps')
                                    .select('id, stock, tipo:tipos_anticonceptivos(id, nombre, marca)')
                                    .eq('cap_id', capId)
                                    .order('tipo_anticonceptivo_id');

                                  setDeliveryInventario(data || []);
                                } catch (err) {
                                  setDeliveryInventario([]);
                                } finally {
                                  setDeliveryLoading(false);
                                  setDeliveryOpen(true);
                                }
                              }}
                              title="Registrar entrega manual"
                            >
                              Registrar Entrega
                            </Button>
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 border-t">
                        {registros.length === 0 ? (
                          <div className="py-6 text-center text-muted-foreground">
                            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No hay registros de anticonceptivos necesarios</p>
                            <p className="text-xs mt-1">Si el paciente necesita un anticonceptivo, puede registrar la entrega manualmente desde "Registrar Entrega" o usar la vista "Entregas".</p>
                          </div>
                        ) : (
                          <div className="pt-4">
                            <h4 className="font-semibold mb-3 text-sm">Anticonceptivos Necesarios:</h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Fecha Solicitud</TableHead>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead>Marca</TableHead>
                                  <TableHead className="text-center">Cantidad Necesaria</TableHead>
                                  <TableHead>Mes/Año</TableHead>
                                  <TableHead>Notas</TableHead>
                                      <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {registros.map((reg: any) => (
                                  <TableRow key={reg.id}>
                                    <TableCell className="font-medium">
                                      {new Date(reg.fecha_entrega).toLocaleDateString('es-AR')}
                                    </TableCell>
                                    <TableCell>
                                      {reg.tipo_anticonceptivo?.nombre || 'Desconocido'}
                                      {/* Mostrar si ya fue entregado este mes (incluso en otra CAP con mismo DNI) */}
                                      {(() => {
                                        const entregasForDni = entregasPorDni[paciente.dni] || [];
                                        const match = entregasForDni.find((e: any) => e.tipo_anticonceptivo_id === reg.tipo_anticonceptivo_id);
                                        if (match) {
                                          return (
                                            <span className="ml-2 inline-block bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded">Entregado este mes (CAP {capNumbers[match.cap_id] || match.cap_id})</span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </TableCell>
                                    <TableCell>{reg.tipo_anticonceptivo?.marca || '-'}</TableCell>
                                    <TableCell className="text-center font-semibold">
                                      {reg.cantidad}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">
                                        {reg.mes}/{reg.anio}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={reg.notas || ''}>
                                      {reg.notas || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        size="sm"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          // open delivery modal
                                          setDeliveryRegistro(reg);
                                          // set default datetime local
                                          const now = new Date();
                                          const local = now.toISOString().slice(0,16);
                                          setDeliveryDateTime(local);
                                          setDeliveryLoading(true);
                                          // fetch current stock for this tipo
                                          try {
                                            const { data: inv } = await supabase
                                              .from('inventario_caps')
                                              .select('stock')
                                              .eq('cap_id', capId)
                                              .eq('tipo_anticonceptivo_id', reg.tipo_anticonceptivo_id)
                                              .maybeSingle();

                                            setDeliveryStock(inv?.stock ?? null);
                                          } catch (err) {
                                            setDeliveryStock(null);
                                          } finally {
                                            setDeliveryLoading(false);
                                            setDeliveryOpen(true);
                                          }
                                        }}
                                      >
                                        Registrar Entrega
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="mt-3 text-sm text-muted-foreground text-center">
                              Total: <strong>{totalAnticonceptivos} unidades</strong> necesarias este mes
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
        )}
        {filteredPacientes.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Total de pacientes en la planilla: <strong>{filteredPacientes.length}</strong>
          </div>
        )}
      </CardContent>

      <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Entrega</DialogTitle>
            <DialogDescription>Registre la entrega para el paciente seleccionado (fecha y hora).</DialogDescription>
          </DialogHeader>
          {deliveryRegistro ? (
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!capId) {
                toast({ title: 'Error', description: 'No se pudo determinar el CAP', variant: 'destructive' });
                return;
              }

              setDeliveryLoading(true);
              try {
                const fechaIso = new Date(deliveryDateTime).toISOString();
                const { error } = await supabase.from('entregas_anticonceptivos').insert([{
                  paciente_id: deliveryRegistro.paciente_id,
                  tipo_anticonceptivo_id: deliveryRegistro.tipo_anticonceptivo_id,
                  cantidad: deliveryRegistro.cantidad,
                  fecha_entrega: fechaIso,
                  created_by: user?.id || null,
                  cap_id: capId,
                }]);

                if (error) throw error;

                toast({ title: 'Entrega registrada', description: 'La entrega se registró correctamente' });
                setDeliveryOpen(false);
                setDeliveryRegistro(null);
                // refresh registros list
                fetchPacientes();
              } catch (err: any) {
                toast({ title: 'Error', description: err.message || 'No se pudo registrar la entrega', variant: 'destructive' });
              } finally {
                setDeliveryLoading(false);
              }
            }}>
              <div className="space-y-4 py-2">
                <div>
                  <div className="text-sm font-medium">Paciente</div>
                  <div className="text-sm">{deliveryRegistro?.paciente_id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Tipo</div>
                  <div className="text-sm">{deliveryRegistro?.tipo_anticonceptivo?.nombre}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Cantidad</div>
                  <div className="text-sm">{deliveryRegistro?.cantidad}</div>
                </div>
                <div className="space-y-1">
                  <Label>Fecha y hora de entrega</Label>
                  <Input type="datetime-local" value={deliveryDateTime} onChange={(e) => setDeliveryDateTime(e.target.value)} required />
                </div>
                {deliveryStock !== null && (
                  <div className="text-sm text-muted-foreground">Stock disponible en CAP: <strong>{deliveryStock}</strong></div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeliveryOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={deliveryLoading || (deliveryStock !== null && deliveryStock < (deliveryRegistro?.cantidad || 1))}>
                  {deliveryLoading ? 'Registrando...' : 'Confirmar Entrega'}
                </Button>
              </DialogFooter>
            </form>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!capId || !deliveryPacienteSelected || !deliverySelectedInventarioId) {
                  toast({ title: 'Error', description: 'Complete paciente e ítem a entregar', variant: 'destructive' });
                  return;
                }

                setDeliveryLoading(true);
                try {
                  const inv = deliveryInventario.find((i) => i.id === deliverySelectedInventarioId);
                  if (!inv) throw new Error('Inventario inválido');
                  if (inv.stock < deliveryCantidadManual) throw new Error('Stock insuficiente');

                  const fechaIso = new Date(deliveryDateTime).toISOString();
                  const { error } = await supabase.from('entregas_anticonceptivos').insert([{
                    paciente_id: deliveryPacienteSelected,
                    tipo_anticonceptivo_id: inv.tipo.id,
                    cantidad: deliveryCantidadManual,
                    fecha_entrega: fechaIso,
                    created_by: user?.id || null,
                    cap_id: capId,
                  }]);

                  if (error) throw error;

                  toast({ title: 'Entrega registrada', description: 'La entrega se registró correctamente' });
                  setDeliveryOpen(false);
                  setDeliveryPacienteSelected(null);
                  setDeliverySelectedInventarioId(null);
                  setDeliveryCantidadManual(1);
                  fetchPacientes();
                } catch (err: any) {
                  toast({ title: 'Error', description: err.message || 'No se pudo registrar la entrega', variant: 'destructive' });
                } finally {
                  setDeliveryLoading(false);
                }
              }}>
                <div className="space-y-4 py-2">
                  <div>
                    <div className="text-sm font-medium">Paciente</div>
                    <div className="text-sm">{filteredPacientes.find(p => p.id === deliveryPacienteSelected)?.apellido}, {filteredPacientes.find(p => p.id === deliveryPacienteSelected)?.nombre}</div>
                  </div>
                  <div>
                    <Label>Anticonceptivo (stock disponible)</Label>
                    <Select onValueChange={(v) => setDeliverySelectedInventarioId(parseInt(v || '0'))} value={deliverySelectedInventarioId?.toString() || ''}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar anticonceptivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryInventario.map((i) => (
                          <SelectItem key={i.id} value={i.id.toString()}>{i.tipo.nombre} {i.tipo.marca ? `- ${i.tipo.marca}` : ''} • Disponible: {i.stock}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cantidad</Label>
                    <Input type="number" min={1} value={deliveryCantidadManual} onChange={(e) => setDeliveryCantidadManual(parseInt(e.target.value || '1'))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fecha y hora de entrega</Label>
                    <Input type="datetime-local" value={deliveryDateTime} onChange={(e) => setDeliveryDateTime(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeliveryOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={deliveryLoading || !deliverySelectedInventarioId}>{deliveryLoading ? 'Registrando...' : 'Confirmar Entrega'}</Button>
                </DialogFooter>
              </form>
            )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PacientesList;
