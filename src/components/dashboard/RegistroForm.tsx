import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface RegistroFormProps {
  capNumber: number | null | undefined;
}

const RegistroForm = ({ capNumber }: RegistroFormProps) => {
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [anticonceptivos, setAnticonceptivos] = useState<any[]>([]);
  const [capId, setCapId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    paciente_id: '',
    tipo_anticonceptivo_id: '',
    cantidad: '1',
    fecha_entrega: new Date().toISOString().split('T')[0],
    mes: (new Date().getMonth() + 1).toString(),
    anio: new Date().getFullYear().toString(),
    notas: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    if (capNumber) {
      fetchCapId();
      fetchAnticonceptivos();
    }
  }, [capNumber]);

  useEffect(() => {
    if (capId) {
      fetchPacientes();
    }
  }, [capId]);

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
      const { data } = await supabase
        .from('pacientes')
        .select('*')
        .eq('cap_id', capId)
        .order('apellido');

      setPacientes(data || []);
    } catch (error) {
      console.error('Error fetching pacientes:', error);
    }
  };

  const fetchAnticonceptivos = async () => {
    try {
      const { data } = await supabase
        .from('tipos_anticonceptivos')
        .select('*')
        .order('nombre');

      setAnticonceptivos(data || []);
    } catch (error) {
      console.error('Error fetching anticonceptivos:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('registros_anticonceptivos')
        .insert([{
          paciente_id: parseInt(formData.paciente_id),
          tipo_anticonceptivo_id: parseInt(formData.tipo_anticonceptivo_id),
          cantidad: parseInt(formData.cantidad),
          fecha_entrega: formData.fecha_entrega,
          mes: parseInt(formData.mes),
          anio: parseInt(formData.anio),
          notas: formData.notas || null,
          created_by: user?.id,
        }]);

      if (error) throw error;

      toast({
        title: 'Registro exitoso',
        description: 'El anticonceptivo ha sido registrado correctamente',
      });

      setFormData({
        paciente_id: '',
        tipo_anticonceptivo_id: '',
        cantidad: '1',
        fecha_entrega: new Date().toISOString().split('T')[0],
        mes: (new Date().getMonth() + 1).toString(),
        anio: new Date().getFullYear().toString(),
        notas: '',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo registrar el anticonceptivo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  return (
    <Card className="shadow-soft max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Registrar Entrega de Anticonceptivo</CardTitle>
        <CardDescription>
          Complete el formulario para registrar la entrega
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="paciente">Paciente *</Label>
            <Select
              value={formData.paciente_id}
              onValueChange={(value) => setFormData({ ...formData, paciente_id: value })}
              required
            >
              <SelectTrigger id="paciente">
                <SelectValue placeholder="Seleccionar paciente" />
              </SelectTrigger>
              <SelectContent>
                {pacientes.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.apellido}, {p.nombre} - DNI: {p.dni}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="anticonceptivo">Tipo de Anticonceptivo *</Label>
            <Select
              value={formData.tipo_anticonceptivo_id}
              onValueChange={(value) => setFormData({ ...formData, tipo_anticonceptivo_id: value })}
              required
            >
              <SelectTrigger id="anticonceptivo">
                <SelectValue placeholder="Seleccionar anticonceptivo" />
              </SelectTrigger>
              <SelectContent>
                {anticonceptivos.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.nombre} - {a.marca}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad *</Label>
              <Input
                id="cantidad"
                type="number"
                min="1"
                value={formData.cantidad}
                onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha de Entrega *</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha_entrega}
                onChange={(e) => setFormData({ ...formData, fecha_entrega: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mes">Mes *</Label>
              <Select
                value={formData.mes}
                onValueChange={(value) => setFormData({ ...formData, mes: value })}
                required
              >
                <SelectTrigger id="mes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="anio">Año *</Label>
              <Input
                id="anio"
                type="number"
                min="2024"
                value={formData.anio}
                onChange={(e) => setFormData({ ...formData, anio: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Observaciones adicionales..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar Entrega'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RegistroForm;
