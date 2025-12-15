# Cómo Desplegar la Edge Function en Supabase

## Problema
El error de CORS indica que la Edge Function `create-cap-user` no está desplegada o no está configurada correctamente en Supabase.

## Solución: Desplegar la Edge Function

### Opción 1: Usando Supabase CLI (Recomendado)

1. **Instalar Supabase CLI** (si no lo tienes):
   ```bash
   npm install -g supabase
   ```

2. **Iniciar sesión en Supabase**:
   ```bash
   supabase login
   ```

3. **Vincular tu proyecto**:
   ```bash
   supabase link --project-ref xgijqtwzillamhwwkjkr
   ```

4. **Desplegar la función**:
   ```bash
   supabase functions deploy create-cap-user
   ```

### Opción 2: Desde Supabase Dashboard

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard/project/xgijqtwzillamhwwkjkr

2. Ve a **Edge Functions** en el menú lateral

3. Haz clic en **Create a new function**

4. Nombre: `create-cap-user`

5. Copia y pega el contenido de `supabase/functions/create-cap-user/index.ts`

6. Haz clic en **Deploy**

### Opción 3: Verificar si ya está desplegada

1. Ve a **Edge Functions** en Supabase Dashboard
2. Verifica si existe la función `create-cap-user`
3. Si existe, verifica que esté activa y desplegada

## Configurar Variables de Entorno

La función necesita estas variables de entorno (se configuran automáticamente en Supabase):

- `SUPABASE_URL`: Se configura automáticamente
- `SUPABASE_SERVICE_ROLE_KEY`: Se configura automáticamente

## Verificar que Funciona

Después de desplegar, prueba crear un usuario desde el frontend. Si sigue fallando:

1. Ve a **Edge Functions** → `create-cap-user` → **Logs**
2. Revisa los logs para ver qué error está ocurriendo
3. Verifica que el usuario admin tenga el rol correcto

## Nota Importante

La Edge Function requiere que el usuario que la llama tenga rol `admin` en la tabla `profiles`. Asegúrate de que tu usuario administrador tenga el rol correcto:

```sql
SELECT id, email, role FROM public.profiles WHERE email = 'admin@caps.com';
```

Si no es `admin`, ejecuta:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@caps.com';
```

