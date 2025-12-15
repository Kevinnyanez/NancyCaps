import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const ManageAnticonceptivos = () => {
  const [anticonceptivos, setAnticonceptivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    marca: '',
    descripcion: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchAnticonceptivos();
  }, []);

  const fetchAnticonceptivos = async () => {
    try {
      const { data, error } = await supabase
        .from('tipos_anticonceptivos')
        .select('*')
        .order('nombre');

      if (error) throw error;
      setAnticonceptivos(data || []);
    } catch (error) {
      console.error('Error fetching anticonceptivos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        const payload = { ...formData };
        const { error } = await supabase
          .from('tipos_anticonceptivos')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Anticonceptivo actualizado',
          description: 'Los cambios se guardaron correctamente',
        });
      } else {
        const payload = { ...formData };
        const { error } = await supabase
          .from('tipos_anticonceptivos')
          .insert([payload]);

        if (error) throw error;

        toast({
          title: 'Anticonceptivo creado',
          description: 'El nuevo tipo se agregó correctamente',
        });
      }

      setOpen(false);
      setFormData({ nombre: '', marca: '', descripcion: '' });
      setEditingId(null);
      fetchAnticonceptivos();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo guardar el anticonceptivo',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      nombre: item.nombre,
      marca: item.marca || '',
      descripcion: item.descripcion || '',
    });
    setOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este anticonceptivo?')) return;

    try {
      const { error } = await supabase
        .from('tipos_anticonceptivos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Anticonceptivo eliminado',
        description: 'El tipo se eliminó correctamente',
      });
      
      fetchAnticonceptivos();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar el anticonceptivo',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Tipos de Anticonceptivos</CardTitle>
            <CardDescription>
              Gestiona el catálogo de anticonceptivos disponibles
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingId(null); setFormData({ nombre: '', marca: '', descripcion: '' }); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Editar' : 'Nuevo'} Anticonceptivo
                </DialogTitle>
                <DialogDescription>
                  Complete la información del anticonceptivo
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marca">Marca</Label>
                    <Input
                      id="marca"
                      value={formData.marca}
                      onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Input
                      id="descripcion"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    />
                  </div>
                  
                </div>
                <DialogFooter>
                  <Button type="submit">Guardar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anticonceptivos.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell>{item.marca || '-'}</TableCell>
                  <TableCell>{item.descripcion || '-'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
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

export default ManageAnticonceptivos;
