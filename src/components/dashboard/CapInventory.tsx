import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const CapInventory = () => {
  const { profile } = useAuth();
  const [capId, setCapId] = useState<number | null>(null);
  const [inventario, setInventario] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!profile?.cap_number) return;
      const { data } = await supabase.from('caps').select('id').eq('numero', profile.cap_number).single();
      const cap = data?.id || null;
      setCapId(cap);
      if (!cap) return;
      const { data: inv } = await supabase
        .from('inventario_caps')
        .select('id, stock, tipo:tipos_anticonceptivos(id, nombre, marca)')
        .eq('cap_id', cap)
        .order('tipo_anticonceptivo_id');

      setInventario(inv || []);
    };
    load();
  }, [profile?.cap_number]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventario (su CAP)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventario.map((inv) => (
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default CapInventory;
