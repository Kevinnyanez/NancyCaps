import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search } from 'lucide-react';

interface PacientesListProps {
  capNumber: number | null | undefined;
}

const PacientesList = ({ capNumber }: PacientesListProps) => {
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [filteredPacientes, setFilteredPacientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [capId, setCapId] = useState<number | null>(null);
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
      const { error } = await supabase
        .from('pacientes')
        .insert([{
          ...formData,
          edad: parseInt(formData.edad),
          cap_id: capId,
        }]);

      if (error) throw error;

      toast({
        title: 'Paciente registrado',
        description: 'El paciente se agregó correctamente',
      });

      setOpen(false);
      setFormData({ nombre: '', apellido: '', dni: '', edad: '' });
      fetchPacientes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo registrar el paciente',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Lista de Pacientes</CardTitle>
            <CardDescription>
              Pacientes registrados en tu CAP
            </CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Paciente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Nueva Paciente</DialogTitle>
                <DialogDescription>
                  Complete la información de la paciente
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
                    <Label htmlFor="apellido">Apellido *</Label>
                    <Input
                      id="apellido"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dni">DNI *</Label>
                    <Input
                      id="dni"
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
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
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Registrar</Button>
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
          <p className="text-center text-muted-foreground">Cargando...</p>
        ) : filteredPacientes.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {searchTerm ? 'No se encontraron pacientes' : 'No hay pacientes registrados'}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Apellido</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead className="text-right">Edad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPacientes.map((paciente) => (
                <TableRow key={paciente.id}>
                  <TableCell className="font-medium">{paciente.nombre}</TableCell>
                  <TableCell>{paciente.apellido}</TableCell>
                  <TableCell>{paciente.dni}</TableCell>
                  <TableCell className="text-right">{paciente.edad}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PacientesList;
