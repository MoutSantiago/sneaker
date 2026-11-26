# Guía de pruebas — Script de migraciones de base de datos

Esta guía explica, paso a paso, cómo validar que el script de migraciones (`scripts/migrate.js`) cumple los criterios de aceptación de la issue. Está pensada para que otra persona del equipo la ejecute de punta a punta y reporte el resultado antes de abrir el PR.

---

## 1. Qué hace el script

1. Lee los archivos `NNN_nombre.sql` de la carpeta `migrations/` (raíz del repo), ordenados por nombre.
2. Se conecta a la **base de datos secundaria** (historial). Si la base no existe, la crea; también crea la tabla `migration` (`name` PK, `execute_date`) si falta.
3. Consulta qué migraciones ya están registradas y se queda con las **pendientes**.
4. Para cada pendiente, en orden: ejecuta el archivo dentro de una **transacción** sobre la **base de datos principal** y, si salió bien, la registra en el historial (nombre **sin** `.sql` + fecha).
5. Si una migración falla: `ROLLBACK`, mensaje de error y el script **se detiene** con código de salida `1`.

Se ejecuta con `npm run migrate` desde la carpeta `scripts/`.

---

## 2. Requisitos

- Node.js **24 o superior** (`node --version`).
- PostgreSQL local en ejecución, con un usuario que tenga permiso `CREATEDB` (por ejemplo, `postgres`).
- La rama con el script descargada y las dependencias instaladas:

```powershell
cd scripts
npm install
```

> ⚠️ **Usá solo bases de prueba.** Esta guía crea `sneaker_test_main` y `sneaker_test_migrations`. No apuntes el script a la base real del proyecto ni a ninguna de producción mientras pruebes.

> Todos los comandos están escritos para **PowerShell** y se ejecutan **desde la carpeta `scripts/`**. Para Linux/macOS, mirá la sección 9.

---

## 3. Pruebas automáticas (Jest)

Verifican cada función por separado con clientes de base de datos simulados (no tocan ninguna base real).

```powershell
npm run format
npm run lint
npm test
```

**Esperado:**

- `format`: los archivos aparecen como `(unchanged)`.
- `lint`: `Found 0 warnings and 0 errors.`
- `test`: todos los tests en verde (`Tests: 35 passed` al momento de escribir esta guía).

Si algo falla acá, no sigas con las pruebas manuales y reportalo.

---

## 4. Preparación del entorno de pruebas manuales

### 4.1 Archivo `.env`

Copiá el ejemplo y completalo con tus datos (el `.env` está ignorado por Git, las credenciales no se suben):

```powershell
Copy-Item .env.example .env
```

Para **este primer paso**, dejá las URLs así (reemplazá usuario, contraseña, servidor y puerto por los tuyos):

```
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/postgres"
MIGRATIONS_DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/sneaker_test_migrations"
```

Si la contraseña tiene caracteres especiales, codificalos en la URL (por ejemplo `@` → `%40`, `#` → `%23`).

### 4.2 Crear la base principal de pruebas

Crea una base **vacía y descartable**. La base secundaria **no se crea a mano**: es justamente lo que va a crear el script.

```powershell
node --env-file=.env -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); c.connect().then(() => c.query('CREATE DATABASE sneaker_test_main')).then(() => console.log('creada')).catch((e) => console.error('ERROR:', e.message)).finally(() => c.end());"
```

**Esperado:** `creada`. (Si dice que ya existe, es de una prueba anterior: hacé primero la limpieza de la sección 7.)

### 4.3 Apuntar la base principal a la de pruebas

En `scripts/.env`, cambiá **solo el nombre de la base** al final de `DATABASE_URL`:

```
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/sneaker_test_main"
```

Verificación de seguridad (imprime solo el nombre de la base, no la contraseña):

```powershell
node --env-file=.env -e "console.log(new URL(process.env.DATABASE_URL).pathname)"
```

**Esperado:** `/sneaker_test_main`. Si imprime otra cosa, **no sigas**.

### 4.4 Carpeta con migraciones de prueba

Usamos una carpeta temporal **fuera del repo**, así `migrations/` no se modifica:

```powershell
$dir = Join-Path $env:TEMP 'sneaker-migrations-test'
New-Item -ItemType Directory -Force $dir | Out-Null
[System.IO.File]::WriteAllText("$dir\001_cliente.sql", "CREATE TABLE cliente (id INT PRIMARY KEY, nombre TEXT NOT NULL);`nINSERT INTO cliente VALUES (1, 'Ana');`n")
[System.IO.File]::WriteAllText("$dir\002_pedido.sql", "CREATE TABLE pedido (id INT PRIMARY KEY, cliente_id INT NOT NULL REFERENCES cliente(id));`n")
[System.IO.File]::WriteAllText("$dir\notas.txt", "esto no es una migracion`n")
$env:TEST_MIGRATIONS_DIR = $dir
Get-ChildItem $dir
```

**Esperado:** se listan `001_cliente.sql`, `002_pedido.sql` y `notas.txt`.

> Se usa `WriteAllText` porque escribe UTF-8 **sin BOM**; un BOM al inicio de un `.sql` hace fallar a PostgreSQL. La variable `$env:TEST_MIGRATIONS_DIR` dura mientras no cierres la terminal; si la cerrás, repetí este paso.

### 4.5 Atajos para las pruebas

Pegá esto una vez en la terminal (duran mientras no la cierres):

```powershell
function Run-Migraciones {
  node --env-file=.env -e "require('./migrate').main(process.env, process.env.TEST_MIGRATIONS_DIR).then((code) => { process.exitCode = code; })"
  "Código de salida: $LASTEXITCODE"
}

function Ver-Bases {
  node --env-file=.env -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); c.connect().then(() => c.query('SELECT datname FROM pg_database ORDER BY datname')).then((r) => console.log(r.rows.map((x) => x.datname).filter((n) => n.startsWith('sneaker_test')))).catch((e) => console.error('ERROR:', e.message)).finally(() => c.end());"
}

function Ver-Tablas {
  node --env-file=.env -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); c.connect().then(() => c.query('SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name')).then((r) => console.log(r.rows.map((x) => x.table_name))).catch((e) => console.error('ERROR:', e.message)).finally(() => c.end());"
}

function Ver-Historial {
  node --env-file=.env -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.MIGRATIONS_DATABASE_URL }); c.connect().then(() => c.query('SELECT name, execute_date FROM migration ORDER BY name')).then((r) => console.log(r.rows)).catch((e) => console.error('ERROR:', e.message)).finally(() => c.end());"
}
```

- `Run-Migraciones`: ejecuta el script sobre la carpeta de prueba e imprime el **código de salida** (`0` = éxito, `1` = error).
- `Ver-Bases`: lista las bases `sneaker_test_*` que existen.
- `Ver-Tablas`: lista las tablas de la base **principal**.
- `Ver-Historial`: muestra el contenido de la tabla `migration` de la base **secundaria**.

---

## 5. Escenarios de prueba

Ejecutalos **en orden**: cada uno parte del estado que dejó el anterior.

### Escenario 1 — Primera corrida: crea la BD secundaria y aplica las migraciones

Antes de ejecutar, comprobá que la base secundaria **todavía no existe**:

```powershell
Ver-Bases
```

**Esperado:** `[ 'sneaker_test_main' ]` (solo la principal).

Ejecutá:

```powershell
Run-Migraciones
Ver-Bases
Ver-Tablas
Ver-Historial
```

**Esperado:**

- Salida del script:
  ```
  Migración aplicada: 001_cliente.sql
  Migración aplicada: 002_pedido.sql
  Código de salida: 0
  ```
- `Ver-Bases`: ahora aparecen **las dos** (`sneaker_test_main` y `sneaker_test_migrations`) → la BD secundaria se creó sola.
- `Ver-Tablas`: `[ 'cliente', 'pedido' ]`.
- `Ver-Historial`: dos filas con `name` = `001_cliente` y `002_pedido` (**sin** `.sql`), cada una con su `execute_date`.
- `notas.txt` no aparece en ningún lado (se ignora).

> Las fechas se muestran en UTC (terminan en `Z`).

### Escenario 2 — Segunda corrida: no se re-ejecuta lo ya aplicado

```powershell
Run-Migraciones
Ver-Historial
```

**Esperado:**

```
No hay migraciones pendientes.
Código de salida: 0
```

El historial sigue con las dos mismas filas y **las mismas fechas** que en el escenario 1.

### Escenario 3 — Migración pendiente nueva

```powershell
[System.IO.File]::WriteAllText("$env:TEST_MIGRATIONS_DIR\003_producto.sql", "CREATE TABLE producto (id INT PRIMARY KEY, nombre TEXT NOT NULL);`n")
Run-Migraciones
Ver-Tablas
Ver-Historial
```

**Esperado:**

- Solo aparece `Migración aplicada: 003_producto.sql` (no se repiten 001 ni 002). Código `0`.
- Tablas: `cliente`, `pedido`, `producto`.
- Historial: 3 filas; las fechas de 001 y 002 **no cambiaron**.

### Escenario 4 — Rollback y detención ante un error

Se crean dos archivos:

- `004_falla.sql`: crea una tabla y luego intenta insertar en una que no existe (**falla a mitad del archivo**).
- `005_posterior.sql`: es válido; sirve para comprobar que el script **no sigue** después del error.

```powershell
[System.IO.File]::WriteAllText("$env:TEST_MIGRATIONS_DIR\004_falla.sql", "CREATE TABLE temporal (id INT);`nINSERT INTO tabla_inexistente VALUES (1);`n")
[System.IO.File]::WriteAllText("$env:TEST_MIGRATIONS_DIR\005_posterior.sql", "CREATE TABLE posterior (id INT);`n")
Run-Migraciones
Ver-Tablas
Ver-Historial
```

**Esperado:**

- Mensaje que empieza con `Error: La migración 004_falla.sql falló:` y menciona `tabla_inexistente` (el resto del texto depende del idioma de tu servidor PostgreSQL). Sin árbol técnico de excepciones. Código `1`.
- Tablas: siguen siendo `cliente`, `pedido`, `producto`.
  - Si aparece `temporal` → el rollback **no** funcionó.
  - Si aparece `posterior` → el script **no** se detuvo.
- Historial: sigue con 3 filas; no figuran `004` ni `005`.

### Escenario 5 — Reintento después de corregir

```powershell
[System.IO.File]::WriteAllText("$env:TEST_MIGRATIONS_DIR\004_falla.sql", "CREATE TABLE temporal (id INT);`n")
Run-Migraciones
Ver-Tablas
Ver-Historial
```

**Esperado:**

- Se aplican `004_falla.sql` y `005_posterior.sql`, en ese orden, sin repetir las anteriores. Código `0`.
- Aparecen las tablas `temporal` y `posterior`; el historial tiene 5 filas.

### Escenario 6 — Base de datos principal inaccesible

Con una migración pendiente, apuntamos temporalmente la base principal a un puerto donde no hay nada (una variable de la terminal tiene prioridad sobre el `.env`, así que no se edita el archivo):

```powershell
[System.IO.File]::WriteAllText("$env:TEST_MIGRATIONS_DIR\006_categoria.sql", "CREATE TABLE categoria (id INT PRIMARY KEY);`n")
$env:DATABASE_URL = "postgresql://postgres:x@localhost:5999/sneaker_test_main"
Run-Migraciones
Remove-Item Env:DATABASE_URL
Ver-Historial
```

**Esperado:**

- `Error: No se pudo acceder a la base de datos principal: connect ECONNREFUSED ...` con el detalle del motivo (puede mostrar una o dos direcciones, por ejemplo `::1:5999` y `127.0.0.1:5999`). **El mensaje no debe quedar vacío.** Código `1`.
- El historial **no** incluye `006_categoria`.

Ahora aplicá la migración con la configuración correcta (la variable ya fue eliminada, vuelve a usarse el `.env`):

```powershell
Run-Migraciones
```

**Esperado:** `Migración aplicada: 006_categoria.sql`, código `0`.

### Escenario 7 — Base de datos secundaria inaccesible

**7a. Servidor no disponible** (puerto sin nada escuchando):

```powershell
$env:MIGRATIONS_DATABASE_URL = "postgresql://postgres:x@localhost:5999/sneaker_test_migrations"
Run-Migraciones
Remove-Item Env:MIGRATIONS_DATABASE_URL
```

**Esperado:** `Error: No se pudo acceder a la base de datos secundaria: connect ECONNREFUSED ...` (mensaje **no vacío**) y código `1`.

**7b. Contraseña incorrecta** (usá tu usuario y servidor reales, solo cambia la contraseña):

```powershell
$env:MIGRATIONS_DATABASE_URL = "postgresql://postgres:clave-incorrecta@localhost:5432/sneaker_test_migrations"
Run-Migraciones
Remove-Item Env:MIGRATIONS_DATABASE_URL
```

**Esperado:** `Error: No se pudo acceder a la base de datos secundaria: ...` indicando que falló la autenticación del usuario, y código `1`. **No** debe intentar crear ninguna base.

### Escenario 8 — Carpeta de migraciones inexistente

```powershell
$env:TEST_MIGRATIONS_DIR = "$env:TEMP\carpeta-que-no-existe"
Run-Migraciones
$env:TEST_MIGRATIONS_DIR = "$env:TEMP\sneaker-migrations-test"
```

**Esperado:** `Error: No se pudo leer la carpeta de migraciones "...carpeta-que-no-existe": ENOENT ...` y código `1`. La última línea restaura la carpeta de prueba.

### Escenario 9 — Variables de entorno faltantes

Se ejecuta el script **sin** `--env-file`, así no encuentra las URLs (funciona si no tenés `DATABASE_URL` ni `MIGRATIONS_DATABASE_URL` definidas en la terminal):

```powershell
node migrate.js
"Código de salida: $LASTEXITCODE"
```

**Esperado:** `Error: definí las variables de entorno DATABASE_URL y MIGRATIONS_DATABASE_URL.` y código `1`.

### Escenario 10 — Comando oficial con la carpeta por defecto

Es la forma en que se usa el script en la práctica: sin carpeta de prueba, leyendo `migrations/` del repo.

```powershell
npm run migrate
"Código de salida: $LASTEXITCODE"
```

**Esperado:**

- Si `migrations/` solo contiene `.gitkeep`: `No hay migraciones pendientes.` y código `0`.
- Si ya contiene archivos `.sql` del proyecto (por ejemplo `001_product_table.sql`), se aplican a **la base de prueba** `sneaker_test_main`. Es lo esperado; verificalo con `Ver-Tablas` y `Ver-Historial`.

---

## 6. Resumen: criterios de aceptación y dónde se verifican

Marcá cada ítem cuando lo hayas comprobado.

| ✔ | Criterio / excepción de la issue | Escenario |
|---|---|---|
| ☐ | Localiza e inspecciona los `.sql` de la carpeta de migraciones (ignora el resto) | 1 |
| ☐ | Valida el registro histórico en la BD secundaria (`name` como PK) | 1, 2 |
| ☐ | Ejecuta solo las migraciones no registradas | 2, 3 |
| ☐ | Cada migración corre dentro de una transacción | 1, 4 |
| ☐ | Registra nombre (sin `.sql`) y `execute_date` al completarse | 1, 3 |
| ☐ | Una migración ya ejecutada no vuelve a ejecutarse | 2 |
| ☐ | Si una migración falla: rollback y el script se detiene | 4, 5 |
| ☐ | Carpeta inexistente → error controlado | 8 |
| ☐ | BD secundaria inaccesible → error controlado | 7a, 7b |
| ☐ | BD secundaria inexistente → se crea automáticamente (decisión del equipo) | 1 |
| ☐ | BD principal inaccesible → error controlado | 6 |
| ☐ | Faltan variables de entorno → error controlado | 9 |
| ☐ | Tests, lint y formato en verde | Sección 3 |

---

## 7. Limpieza (al terminar)

Estos comandos **borran las bases de prueba de forma irreversible**; afectan solo a `sneaker_test_main` y `sneaker_test_migrations`.

**1.** En `scripts/.env`, volvé a poner `DATABASE_URL` apuntando a la base `postgres` (o a tu base real de desarrollo). Es necesario: PostgreSQL no deja borrar una base a la que estás conectado.

**2.** Borrá las bases de prueba:

```powershell
node --env-file=.env -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); c.connect().then(() => c.query('DROP DATABASE IF EXISTS sneaker_test_main')).then(() => c.query('DROP DATABASE IF EXISTS sneaker_test_migrations')).then(() => console.log('bases de prueba eliminadas')).catch((e) => console.error('ERROR:', e.message)).finally(() => c.end());"
```

**3.** Borrá la carpeta temporal y la variable:

```powershell
Remove-Item -Recurse -Force "$env:TEMP\sneaker-migrations-test"
Remove-Item Env:TEST_MIGRATIONS_DIR
```

> Para uso real del script, elegí en tu `.env` local un nombre propio para la base secundaria (por ejemplo `sneaker_migrations`); el script la crea solo.

---

## 8. Problemas frecuentes

| Síntoma | Causa probable y solución |
|---|---|
| `npm error Missing script: "migrate"` | Estás parado en la raíz del repo. Ejecutá los comandos **dentro de `scripts/`**. |
| `ECONNREFUSED` en una conexión que debería funcionar | El servicio de PostgreSQL no está corriendo o el puerto del `.env` es otro. En Windows: `Get-Service -Name "postgresql*"`. |
| Falla la autenticación del usuario | Usuario o contraseña incorrectos en el `.env`, o caracteres especiales sin codificar en la URL. Revisá **las dos** URLs. |
| `permission denied to create database` | El usuario no tiene permiso `CREATEDB`. Usá otro usuario (por ejemplo `postgres`). |
| Caracteres raros (`�`) en los mensajes de error | La consola de Windows muestra mal los acentos del mensaje de PostgreSQL. Es solo visual. |
| `warning: LF will be replaced by CRLF` al hacer `git add` | Aviso normal de Git en Windows. No requiere acción. |
| `psql` no se reconoce | No hace falta `psql`: todos los chequeos de esta guía se hacen con Node. |
| Un `.sql` falla con un error de sintaxis en el primer carácter | El archivo tiene BOM (UTF-8 con marca). Guardalo como UTF-8 **sin BOM**. |

---

## 9. Notas para Linux / macOS

Los comandos de Node de esta guía (`node --env-file=.env -e "..."`) funcionan igual. Cambian solo estas partes:

| PowerShell | Bash / Zsh |
|---|---|
| `$env:VARIABLE = "valor"` | `export VARIABLE="valor"` |
| `Remove-Item Env:VARIABLE` | `unset VARIABLE` |
| `$LASTEXITCODE` | `$?` |
| `$env:TEMP` | `/tmp` |
| `New-Item -ItemType Directory -Force $dir` | `mkdir -p "$dir"` |
| `[System.IO.File]::WriteAllText(ruta, texto)` | `printf 'texto\n' > ruta` |
| `Get-ChildItem $dir` | `ls "$dir"` |
| `Copy-Item .env.example .env` | `cp .env.example .env` |
| `Remove-Item -Recurse -Force ruta` | `rm -rf ruta` |
| `function Nombre { ... }` | `Nombre() { ...; }` (usá `echo "Código de salida: $?"`) |

---

## 10. Limitaciones conocidas (no son fallos)

- **El registro ocurre después del `COMMIT`.** La migración se aplica en la base principal y se registra en otra base; no hay una transacción que cubra ambas. Si el registro fallara justo después del `COMMIT`, el mensaje avisa que la migración **sí se aplicó** pero no quedó registrada. No hay recuperación automática (queda fuera de la issue).
- Los archivos `.sql` **no deben incluir** sus propios `BEGIN` ni `COMMIT`.
- Para crear la base secundaria, el usuario necesita permiso `CREATEDB`.
- Requiere Node 24 o superior (se usa `--env-file`).
- Una migración que falla se revierte por completo, pero las anteriores de esa misma corrida ya quedaron confirmadas y registradas (cada migración es su propia transacción).

---

## 11. Reporte de resultados

Cuando termines, pasale esto a quien armó el PR:

```
Probado por:
Fecha:
Sistema operativo / versión de Node / versión de PostgreSQL:

Pruebas automáticas (sección 3): OK / FALLA  (detalle)
Escenario 1:  OK / FALLA
Escenario 2:  OK / FALLA
Escenario 3:  OK / FALLA
Escenario 4:  OK / FALLA
Escenario 5:  OK / FALLA
Escenario 6:  OK / FALLA
Escenario 7a: OK / FALLA
Escenario 7b: OK / FALLA
Escenario 8:  OK / FALLA
Escenario 9:  OK / FALLA
Escenario 10: OK / FALLA

Observaciones (mensajes de error completos de lo que haya fallado):
```
