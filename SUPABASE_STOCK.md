Pruebas y despliegue para la funcionalidad de `stock`

1) Aplicar migración

- Ejecutar migraciones en la base de datos (ej. con Supabase CLI):

```bash
supabase db push
# o ejecutar el SQL: supabase db reset && psql ...
```

2) Verificar cambios en BD

- Confirmar que la columna `stock` existe en `tipos_anticonceptivos` y tiene `DEFAULT 0`.
- Confirmar que existe la función `reduce_stock_on_registro_insert()` y el trigger `trg_reduce_stock_on_registro_insert`.


3) Flujo de prueba (manual)

- Iniciar sesión como admin.
- Ir a "Inventario" y asignar `stock = 10` para un `tipo` especificando el CAP correspondiente.
- Iniciar sesión como `cap_user` (usuario CAP) del CAP seleccionado.
- Ir a la pestaña "Entregas" o abrir la planilla de pacientes y usar "Registrar Entrega" en la fila del paciente.
- Intentar registrar `cantidad = 5` → debe registrar correctamente y al volver a seleccionar, `Disponible` debe mostrarse como `5`.
- Intentar registrar `cantidad = 6` → debe rechazarse con error "Stock insuficiente".

- Verificar en la tabla `inventario_movimientos` que se creó un movimiento de tipo `out` con `cantidad` correcta y `paciente_id`.
- Verificar en la tabla `entrega_notificaciones` que se creó una notificación para las CAPs que tengan al paciente con el mismo DNI en otro CAP. La columna `cap_destino` indica a qué CAP fue dirigida la notificación.

- Comprobar que las notificaciones no bloquean la inserción: se espera que el registro se cree igualmente, pero que quede una notificación informativa para otros CAPs.

4) Notas técnicas

- La resta de stock se realiza en triggers en la base de datos antes de INSERT en `registros_anticonceptivos` y en `entregas_anticonceptivos`. Si no hay stock suficiente, la inserción falla y se retorna el error.
- Solo los admins pueden crear/editar/eliminar tipos de anticonceptivos (incluido el `stock`) por políticas RLS.
- Los usuarios CAP pueden ver el `stock` y registrar entregas (no pueden crear 'necesidad'/'registros' en el sistema). Solo los administradores pueden crear o modificar la planilla de necesidades (`registros_anticonceptivos`).

7) Flujo de Entregas (nuevo)

7) Flujo de Entregas (nuevo)

- Se agregó la tabla `entregas_anticonceptivos` para registrar entregas efectivas. Al insertar una entrega, el trigger decrece el stock en `inventario_caps` y crea un movimiento en `inventario_movimientos`.
- Para registrar una entrega desde la interfaz CAP:
  - Ir a la pestaña `Entregas` o a la planilla de pacientes y usar el botón `Registrar Entrega` en la fila del paciente.
  - Seleccionar fecha y hora (por defecto ahora) y confirmar. Si no hay stock suficiente, la inserción será rechazada y verás un error.
  - Verificar en la tabla `entregas_anticonceptivos` que se creó la fila y en `inventario_movimientos` que se creó el movimiento `out` correspondiente.

5) Cambios en la interfaz (UX/UI)

- En la vista de pacientes se muestra ahora un badge con el estado del stock: `Agotado` (rojo) si 0, `Bajo` (amarillo) si <= 5, y `OK` si suficiente stock.
- Cuando el stock está `Bajo` o `Agotado` aparece un botón rápido para `Solicitar reposición` (abre un `mailto:` al administrador por ahora).
- Los CAPs tienen una nueva pestaña `Notificaciones` donde se muestran las notificaciones informativas sobre entregas registradas en otros CAPs que comparten el mismo DNI.
- El admin ve una tarjeta de `Notificaciones` junto a las `Stats` y puede revisar las últimas 20 notificaciones.

6) Verificación rápida de UX

- Iniciar sesión como CAP y abrir la pestaña `Notificaciones`.
- Ir a la planilla de pacientes (o a la pestaña `Entregas`) y comprobar el badge de stock; el botón `Registrar Entrega` se deshabilita si el stock es insuficiente.
- Iniciar sesión como admin y revisar la tarjeta `Notificaciones` para ver la lista.

5) Qué comprobar si algo falla

- Revisa que la migración se haya aplicado sobre la misma instancia DB usada por la aplicación.
- Revisa logs de la BD al insertar registros para ver excepciones lanzadas por el trigger.
- Si el trigger falla por políticas RLS, asegúrate que la función fue creada con `SECURITY DEFINER` (ya implementado en la migración).
