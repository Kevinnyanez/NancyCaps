import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { downloadCSV } from '@/lib/csv';
import { exportToExcel } from '@/lib/excel';

const AdminDeliveries = () => {
  const [entregas, setEntregas] = useState<any[]>([]);
  const [caps, setCaps] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: e }, { data: c }] = await Promise.all([
      supabase.from('entregas_anticonceptivos').select('id, paciente_id, tipo_anticonceptivo_id, cantidad, fecha_entrega, cap_id, paciente:pacientes(id, nombre, apellido), tipo:tipos_anticonceptivos(id, nombre)').order('fecha_entrega', { ascending: false }).limit(1000),
      supabase.from('caps').select('id, numero, nombre').order('numero'),
    ]);

    setEntregas(e || []);
    setCaps(c || []);
  };

  // Agrupar por cap y por mes
  const grouped = entregas.reduce((acc: any, cur: any) => {
    const capId = cur.cap_id || 0;
    const monthKey = new Date(cur.fecha_entrega).toISOString().slice(0,7); // YYYY-MM
    acc[capId] = acc[capId] || {};
    acc[capId][monthKey] = acc[capId][monthKey] || { total: 0, tipos: {} };
    acc[capId][monthKey].total += cur.cantidad || 0;
    const tipoName = cur.tipo?.nombre || cur.tipo_anticonceptivo_id;
    acc[capId][monthKey].tipos[tipoName] = (acc[capId][monthKey].tipos[tipoName] || 0) + (cur.cantidad || 0);
    return acc;
  }, {} as Record<number, Record<string, any>>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Entregas Mensuales (Resumen por CAP)</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              // CSV export
              const rows: any[] = [];
              Object.entries(grouped).forEach(([capId, months]) => {
                Object.entries(months).forEach(([month, info]) => {
                  Object.entries(info.tipos).forEach(([t, q]) => {
                    rows.push({ cap: capId, month, tipo: t, cantidad: q });
                  });
                });
              });
              downloadCSV(`entregas_resumen_${new Date().toISOString().slice(0,10)}.csv`, rows);
            }}>Descargar CSV</Button>
            <Button onClick={() => {
              // XLSX export
              const rows: any[] = [];
              Object.entries(grouped).forEach(([capId, months]) => {
                Object.entries(months).forEach(([month, info]) => {
                  Object.entries(info.tipos).forEach(([t, q]) => {
                    rows.push({ cap: capId, month, tipo: t, cantidad: q });
                  });
                });
              });
              void exportToExcel(`entregas_resumen_${new Date().toISOString().slice(0,10)}.xlsx`, rows).catch(err => console.error('Export failed', err));
            }}>Exportar XLSX</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay entregas registradas</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([capId, months]) => (
              <div key={capId} className="border rounded p-3">
                <h4 className="font-semibold">CAP: {caps.find(c => c.id === parseInt(capId))?.numero || capId} - {caps.find(c => c.id === parseInt(capId))?.nombre || ''}</h4>
                <ul className="mt-2 space-y-2">
                  {Object.entries(months).map(([month, info]) => (
                    <li key={month} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{month}</div>
                        <div className="text-xs text-muted-foreground">Total entregado: {info.total} unidades</div>
                        <div className="text-xs mt-1">
                          {Object.entries(info.tipos).map(([t, q]) => (
                            <span key={t} className="mr-2">{t}: <strong>{String(q)}</strong></span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Button onClick={() => {
                          // emitir evento para abrir ManageInventory y preseleccionar CAP y cambiar a Reportes (preseleccionar CAP en reporte)
                          try { window.dispatchEvent(new CustomEvent('manage-inventory:open', { detail: { capId: parseInt(capId) } })); } catch (e) {}
                          try { window.dispatchEvent(new CustomEvent('navigate:tab', { detail: { tab: 'report', capId: parseInt(capId) } })); } catch (e) {}
                        }}>
                          Preparar Pedido
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminDeliveries;
