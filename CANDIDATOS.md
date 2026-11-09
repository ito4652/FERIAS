# App privada y sección Candidatos: configuración con Supabase

La pestaña **Candidatos** guarda las fichas de las personas entrevistadas en ferias y sus CV en un proyecto de [Supabase](https://supabase.com) (base de datos y almacenamiento de archivos). Este repositorio es público, así que **ningún dato de candidatos pasa por GitHub**: aquí solo vive el código.

Cada ficha tiene el mes en que el candidato empieza a buscar práctica o trabajo. La app avisa en **Inicio** y con un número en la pestaña cuando faltan 30 días o menos (o ya empezó) y nadie lo ha contactado.

**Quién puede entrar:** solo cuentas `@icb.cl` que el administrador crea a mano en Supabase. El registro público queda desactivado y, además, la base de datos rechaza cualquier cuenta que no sea `@icb.cl`.

La configuración se hace una sola vez y toma unos 15 minutos.

---

## Paso 1. Crear el proyecto

1. Entra a <https://supabase.com> → **Start your project** y crea una cuenta.
2. Pulsa **New project** y completa:
   - **Name:** `control-seleccion`
   - **Database password:** inventa una contraseña larga y guárdala en un lugar seguro. La app no la usa, pero Supabase la pide.
   - **Region:** `South America (São Paulo)`, la más cercana a Chile.
   - **Plan:** Free.
3. Pulsa **Create new project** y espera uno o dos minutos a que termine.

## Paso 2. Crear la tabla y el almacenamiento de CV

1. En el menú de la izquierda, entra a **SQL Editor** → **New query**.
2. Abre el archivo `candidatos.sql` de este repositorio, copia **todo** su contenido y pégalo.
3. Pulsa **Run**. Debe decir *Success. No rows returned*.

Esto crea la tabla `candidatos`, el almacenamiento privado `cvs` y las reglas que solo dejan entrar a cuentas `@icb.cl` con sesión iniciada.

## Paso 3. Cerrar el registro público

1. Entra a **Authentication** → **Sign In / Providers**.
2. **Desactiva** la opción **Allow new users to sign up** y guarda.

Así nadie puede crearse una cuenta por su cuenta: solo existen las que tú creas en el paso siguiente.

## Paso 4. Crear las cuentas del equipo

Para cada persona del equipo:

1. Entra a **Authentication** → **Users** → **Add user** → **Create new user**.
2. Escribe su correo `@icb.cl` y una contraseña temporal.
3. Marca **Auto Confirm User** y pulsa **Create user**.
4. Entrégale la contraseña temporal. Al entrar, puede cambiarla en la app con **Cambiar contraseña**, al final de la pestaña Candidatos.

Si alguien olvida su contraseña, elimina su usuario y créalo de nuevo con otra contraseña temporal. Los candidatos no se pierden, porque no dependen de quién los registró.

Si el correo de la persona coincide con el que aparece en la pestaña Equipo, la app muestra su nombre como entrevistador.

## Paso 5. Conectar la app

1. En Supabase, pulsa **Connect** (arriba) o entra a **Project Settings** → **API Keys**.
2. Copia:
   - la **Project URL**, que se ve como `https://abcdefghijkl.supabase.co`
   - la clave **Publishable** (empieza con `sb_publishable_`) o, si no aparece, la clave **anon public**
3. En GitHub, abre `candidatos-config.js`, pulsa el lápiz y pega los datos:

```js
window.CAND_CONFIG = {
  supabaseUrl: 'https://abcdefghijkl.supabase.co',
  supabaseKey: 'sb_publishable_xxxxxxxxxxxxxxxx',
  alertDays: 30
};
```

Esta clave está hecha para ir en apps web públicas: no es una contraseña. **Nunca pegues aquí la clave `secret` ni la `service_role`**, porque esas sí saltan todas las reglas de seguridad.

4. Guarda el cambio (**Commit changes**), espera un minuto y abre la app.

---

## App completa privada

Toda la app pide iniciar sesión, y todos sus datos (ferias, equipo, cumpleaños, contactos, avisos, plataformas y DO) viven en Supabase, en la tabla `app_datos`. Ya no hay datos en GitHub.

- **Cualquier cuenta `@icb.cl`** creada en Supabase puede ver y editar todo.
- Para editar, usa **Editar datos** al pie de la app (abre `admin.html`). Los cambios quedan en tu navegador hasta que pulsas **Publicar**; en ese momento el equipo los ve.
- Si otra persona publicó mientras editabas, la app combina ambos cambios elemento por elemento: se aplica lo que tú agregaste, editaste o borraste, y se conserva lo que hizo la otra persona. Si las dos editaron la misma feria o el mismo cumpleaños, queda la versión de quien publicó al final.
- **Descargar respaldo** baja una copia de todo en un archivo `.json`. Guárdala en un lugar privado.
- La app guarda una copia de los datos en cada dispositivo para poder verla sin conexión. Esa copia se borra al cerrar sesión.

Para instalarlo desde cero, ejecuta `datos.sql` en el SQL Editor (además de `candidatos.sql`), entra a **Editar datos** y pulsa **Traspasar data.json** o **Elegir un respaldo**.

---

## Importar desde Excel

En la pestaña Candidatos, **Importar Excel** carga muchos candidatos de una vez desde un `.xlsx` o `.csv`. El archivo se lee en el navegador y va directo a Supabase.

- La primera fila con datos debe tener los encabezados. Se reconocen, entre otros: Nombre, Contacto (o Teléfono, Celular, Correo), Carrera, Universidad, Estado (o Año, Situación), ¿Titulado?, Área de interés, Disponibilidad y Duración de práctica. Las columnas que no se reconocen se guardan en las notas.
- **Disponibilidad** se convierte al mes en que empiezan a buscar: “Inmediata” es el mes actual, y un mes sin año (“Enero”) es la próxima vez que llega ese mes. Si la celda dice “Enero - Febrero”, se usa el primero. El texto original queda en las notas.
- Antes de guardar se muestra una vista previa: las filas sin mes, sin nombre o ya registradas (mismo teléfono, correo o nombre) aparecen primero, para revisarlas.
- Los CV no vienen en el Excel: se suben después desde la ficha de cada candidato.

---

## Mantenimiento

**Pausa por inactividad.** En el plan gratuito, Supabase pausa el proyecto si nadie lo usa durante una semana. Si la app muestra que no se pudo conectar, entra a supabase.com, abre el proyecto y pulsa **Restore project**. Los datos no se pierden.

**Respaldo.** Una vez al mes, entra a **Table Editor** → `candidatos` → **Export** → **Export to CSV** y guarda el archivo en un lugar seguro de la empresa.

**Límites del plan gratuito.** Incluye 500 MB de base de datos y 1 GB de archivos, suficiente para miles de candidatos con CV.

## Datos personales

Los CV y datos de contacto son datos personales de terceros (Ley 19.628, y la Ley 21.719 desde diciembre de 2026). ICB es responsable de ellos aunque estén guardados en un servicio externo. Por eso:

- la app tiene la casilla **El candidato autorizó que guardemos sus datos** y marca en rojo las fichas sin autorización;
- al eliminar una ficha, se elimina también su CV;
- conviene acordar cuánto tiempo se guardan los CV y eliminar periódicamente los candidatos descartados o antiguos;
- lo recomendable es informar a TI y al área legal que estos datos están en Supabase, para que queden registrados en el inventario de datos de la empresa.

- 
