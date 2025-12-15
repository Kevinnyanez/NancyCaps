import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';

const ManageCaps = () => {
  const [caps, setCaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    numero: '',
    nombre: '',
    direccion: '',
    responsable_nombre: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCaps();
  }, []);

  const fetchCaps = async () => {
    try {
      const { data, error } = await supabase
        .from('caps')
        .select('*')
        .order('numero', { ascending: true });

      if (error) throw error;
      setCaps(data || []);
    } catch (error) {
      console.error('Error fetching caps:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los CAPs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.numero || !formData.nombre || !formData.direccion || !formData.responsable_nombre) {
      toast({
        title: 'Error',
        description: 'Todos los campos son requeridos',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingId) {
        // Actualizar CAP existente
        const { error } = await supabase
          .from('caps')
          .update({
            numero: parseInt(formData.numero),
            nombre: formData.nombre,
            direccion: formData.direccion,
            responsable_nombre: formData.responsable_nombre,
          })
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'CAP actualizado',
          description: 'Los cambios se guardaron correctamente',
        });
      } else {
        // Crear nuevo CAP
        const { error } = await supabase
          .from('caps')
          .insert([{
            numero: parseInt(formData.numero),
            nombre: formData.nombre,
            direccion: formData.direccion,
            responsable_nombre: formData.responsable_nombre,
          }]);

        if (error) throw error;

        toast({
          title: 'CAP creado',
          description: 'El nuevo CAP se agregó correctamente',
        });
      }

      setOpen(false);
      setFormData({ numero: '', nombre: '', direccion: '', responsable_nombre: '' });
      setEditingId(null);
      fetchCaps();
    } catch (error: any) {
      console.error('Error saving CAP:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el CAP',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (cap: any) => {
    setEditingId(cap.id);
    setFormData({
      numero: cap.numero.toString(),
      nombre: cap.nombre,
      direccion: cap.direccion,
      responsable_nombre: cap.responsable_nombre,
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este CAP? Esta acción no se puede deshacer.')) return;

    try {
      const { error } = await supabase
        .from('caps')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'CAP eliminado',
        description: 'El CAP se eliminó correctamente',
      });
      
      fetchCaps();
    } catch (error: any) {
      console.error('Error deleting CAP:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el CAP. Verifica que no tenga pacientes asociados.',
        variant: 'destructive',
      });
    }
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({ numero: '', nombre: '', direccion: '', responsable_nombre: '' });
    setOpen(true);
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Gestión de CAPs
            </CardTitle>
            <CardDescription>
              Administra los Centros de Atención Primaria (CAPs)
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNew}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo CAP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Editar' : 'Nuevo'} CAP
                </DialogTitle>
                <DialogDescription>
                  Complete la información del Centro de Atención Primaria
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numero">Número del CAP *</Label>
                      <Input
                        id="numero"
                        type="number"
                        min="1"
                        value={formData.numero}
                        onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                        placeholder="Ej: 1"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Número único que identifica al CAP
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre del CAP *</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej: CAP Centro"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="direccion">Dirección *</Label>
                    <Input
                      id="direccion"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      placeholder="Ej: Calle Principal 123, Ciudad"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responsable">Nombre del Responsable *</Label>
                    <Input
                      id="responsable"
                      value={formData.responsable_nombre}
                      onChange={(e) => setFormData({ ...formData, responsable_nombre: e.target.value })}
                      placeholder="Ej: Juan Pérez"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Nombre completo del responsable de la gestión del CAP
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingId ? 'Actualizar' : 'Crear'} CAP
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : caps.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No hay CAPs registrados</p>
            <Button onClick={handleNew}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Primer CAP
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {caps.map((cap) => (
                <TableRow key={cap.id}>
                  <TableCell className="font-medium">CAP {cap.numero}</TableCell>
                  <TableCell className="font-medium">{cap.nombre}</TableCell>
                  <TableCell className="max-w-xs truncate" title={cap.direccion}>
                    {cap.direccion}
                  </TableCell>
                  <TableCell>{cap.responsable_nombre}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(cap)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(cap.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ManageCaps;

