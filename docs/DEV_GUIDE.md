# Guía de programación — Proyecto Sneaker

Este documento establece los estándares de desarrollo que deben seguirse en el backend (NestJS) y el frontend (Next.js) del proyecto **Sneaker**. Aplica a todo nuevo código que se agregue al repositorio.

---

## 1. Arquitectura de capas (Backend)

Todo módulo de negocio en el backend debe organizarse en **tres capas separadas**:

| Capa | Responsabilidad | Archivo típico |
|------|-----------------|----------------|
| **Module** | Agrupa controladores y proveedores, declara importaciones/exportaciones. | `*.module.ts` |
| **Controller** | Recibe peticiones HTTP, valida entrada, llama al servicio, devuelve respuesta. | `*.controller.ts` |
| **Service** | Contiene la lógica de negocio, acceso a datos vía Prisma, transformaciones. | `*.service.ts` |

### Ejemplo de módulo completo

```ts
// users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

```ts
// users/users.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Obtiene un usuario por su ID.
   * @param id - Identificador del usuario.
   * @returns El usuario encontrado.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Crea un nuevo usuario.
   * @param createUserDto - Datos del usuario a crear.
   * @returns El usuario creado.
   */
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
```

```ts
// users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca un usuario por su identificador.
   * @param id - ID del usuario.
   * @returns El usuario si existe.
   * @throws NotFoundException si no existe el usuario.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }
    return user;
  }

  /**
   * Crea un usuario en la base de datos.
   * @param createUserDto - Datos para crear el usuario.
   * @returns El usuario creado.
   */
  async create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({ data: createUserDto });
  }
}
```

> **Regla:** El acceso a base de datos se hace **únicamente** desde el Service, usando **Prisma**. El Controller nunca llama a Prisma directamente.

---

## 2. Acceso a datos (Backend)

- Siempre usar **Prisma** (`PrismaService`) para consultar o escribir en PostgreSQL.
- No usar `pg` directamente ni escribir SQL crudo, salvo excepciones justificadas y documentadas.
- El `PrismaService` ya está configurado con `@prisma/adapter-pg` y se inyecta como proveedor global vía `PrismaModule`.

```ts
@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveProducts() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

---

## 3. Llamadas HTTP (Frontend)

- Usar **Axios** para todas las peticiones al backend.
- Crear una instancia base configurada con la URL de la API y headers comunes.

```ts
// lib/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
```

Ejemplo de uso en un componente o service:

```ts
import { api } from '@/lib/api';

export async function getProducts() {
  const response = await api.get('/products');
  return response.data;
}

export async function createProduct(data: ProductDto) {
  const response = await api.post('/products', data);
  return response.data;
}
```

> **Regla:** No usar `fetch` directamente en el frontend para llamadas a la API; usar siempre la instancia de Axios configurada.

---

## 4. Documentación con JSDoc

Toda función, clase, método e interfaz debe incluir un bloque **JSDoc** que describa:

- Qué hace.
- Parámetros (`@param`) con tipo y descripción.
- Valor de retorno (`@returns`) con tipo y descripción.
- Errores que lanza (`@throws`) cuando aplique.

### Ejemplo en una función

```ts
/**
 * Calcula el total de un carrito aplicando descuentos.
 * @param items - Lista de ítems del carrito.
 * @param discountCode - Código de descuento opcional.
 * @returns Monto total a pagar.
 * @throws Error si algún ítem tiene precio negativo.
 */
export function calculateTotal(items: CartItem[], discountCode?: string): number {
  // ...
}
```

### Ejemplo en una clase

```ts
/**
 * Servicio de gestión de productos.
 * Encapsula toda la lógica de acceso a datos y reglas de negocio de productos.
 */
@Injectable()
export class ProductService {
  /**
   * Crea un nuevo producto.
   * @param createProductDto - Datos del producto a crear.
   * @returns El producto creado con su ID asignado.
   */
  async create(createProductDto: CreateProductDto) {
    // ...
  }
}
```

---

## 5. Tests

Cada función, método o servicio que se implemente debe tener sus **test cases** correspondientes.

### Backend (Jest)

- Archivos de unidad: `*.spec.ts` junto al código fuente.
- Archivos e2e: carpeta `test/`.
- Usar mocks para servicios externos (incluido Prisma cuando no haya BD disponible).

Ejemplo de test con mock de Prisma:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaServiceMock } from '../prisma/prisma.service.mock';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaServiceMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaServiceMock, useClass: PrismaServiceMock },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaServiceMock);
  });

  it('should create a user', async () => {
    const dto = { name: 'Juan', email: 'juan@email.com' };
    prisma.user.create = jest.fn().mockResolvedValue({ id: '1', ...dto });

    const result = await service.create(dto);

    expect(result).toEqual({ id: '1', ...dto });
    expect(prisma.user.create).toHaveBeenCalledWith({ data: dto });
  });
});
```

### Frontend (Jest + Testing Library)

- Archivos de prueba: `*.test.tsx` o `*.test.ts`.
- Mockear llamadas de Axios con `jest.mock('axios')` o `vi.mock`.

Ejemplo:

```ts
import { render, screen } from '@testing-library/react';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  it('renders product name and price', () => {
    render(<ProductCard product={{ name: 'Zapatilla X', price: 50000 }} />);
    expect(screen.getByText('Zapatilla X')).toBeInTheDocument();
    expect(screen.getByText('$50.000')).toBeInTheDocument();
  });
});
```

---

## 6. Reglas de formato (equivalentes en back y front)

Cada proyecto mantiene su propio archivo de configuración, pero las reglas de formato son **equivalentes**:

| Regla | Valor | Backend | Frontend |
|-------|-------|---------|----------|
| `semi` | `true` | ✅ | ✅ |
| `singleQuote` | `true` | ✅ | ✅ |
| `jsxSingleQuote` | `true` | N/A | ✅ |
| `trailingComma` | `"all"` | ✅ | ✅ |
| `tabWidth` | `2` | ✅ | ✅ |
| `printWidth` | `100` | ✅ | ✅ |
| `bracketSpacing` | `true` | ✅ | ✅ |
| `arrowParens` | `"always"` | ✅ | ✅ |
| `endOfLine` | `"lf"` | ✅ | ✅ |

### Archivos de configuración

- **Backend:** `backend/.prettierrc` + `backend/.oxlintrc.json`
- **Frontend:** `frontend/.prettierrc` + `frontend/eslint.config.mjs`
- **Editor (ambos):** `.editorconfig` en la raíz

### Scripts recomendados

**Backend:**
```json
"format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
"lint": "oxlint --type-aware src/ test/",
"test": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js"
```

**Frontend:**
```json
"format": "prettier --write \"app/**/*.{ts,tsx}\"",
"lint": "eslint",
"test": "jest"
```

### Cómo aplicar

```bash
# Backend
cd backend && npm run format && npm run lint && npm test

# Frontend
cd frontend && npm run format && npm run lint && npm test
```

> Prettier se encarga exclusivamente de **formato** (espaciado, comillas, punto y coma, saltos de línea). ESLint / oxlint se encargan de **calidad de código** (tipos, buenas prácticas, reglas de framework).

---

## 7. Convenciones de nombrado

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Archivos (rutas, componentes) | `kebab-case` | `product-card.tsx`, `users.controller.ts` |
| Componentes React | `PascalCase` | `ProductCard.tsx` |
| Funciones / variables | `camelCase` | `calculateTotal`, `userId` |
| Clases / interfaces / types | `PascalCase` | `UserService`, `CreateUserDto` |
| Constantes estáticas | `UPPER_SNAKE_CASE` | `MAX_RETRY_ATTEMPTS` |
| Carpetas | `kebab-case` | `src/users/`, `app/products/` |

---

## 8. Importes

- Orden alfabético.
- Agrupados por tipo: externos → internos relativos → tipos.
- No dejar importes sin usar.

---

## 9. CI / GitHub Actions

Cada push o pull request a `main` o `develop` ejecuta:

- **Backend:** job `lint` (oxlint + prettier check) y job `test` (jest).
- **Frontend:** job `lint` (eslint + prettier check) y job `test` (jest).

Ambos jobs corren en paralelo y son independientes.

---

## 11. Migraciones de base de datos (@migrations/)

Los cambios de esquema y de datos en PostgreSQL se gestionan con **migraciones SQL versionadas** en la carpeta `@migrations/` (raíz del repositorio). Cada migración es un archivo `.sql` numerado con prefijo de 4 dígitos (`001_`, `002_`, …) que se aplica en orden alfabético/cronológico.

### Cómo funcionan

- **Formato:** archivos SQL puros, uno por migración. Ejemplos existentes:
  - `001_product_table.sql` — crea `product`, `product_variant` y el enum `product_type`.
  - `002_usage_table.sql` — crea `usage` y `product_use`, migra los datos de `product.usage` y elimina la columna antigua.
  - `003_brand_table.sql` — crea `brand`, agrega `brand_id` a `product`, migra los datos de `product.brand` y elimina la columna de texto.
  - `004_category_tag.sql` — crea `category`, `has_category`, `tag` y `has_tag`.
- **Orden de aplicación:** se ejecutan en orden numérico (`001` → `002` → `003` → `004`). Nunca saltarse ni reordenar migraciones ya aplicadas.
- **Idempotencia:** todas las migraciones usan `CREATE TABLE IF NOT EXISTS` y guardas (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, etc.) para poder reejecutarse sin fallar si parte del esquema ya existe.
- **Datos + esquema:** una migración puede incluir tanto DDL (`CREATE TABLE`, `ALTER TABLE`) como DML (`INSERT`, `UPDATE`, `DROP COLUMN`) para migrar datos existentes junto con el cambio de esquema.
- **Aplicación:** se aplican directamente contra la base de datos PostgreSQL (por ejemplo con `psql` o el cliente SQL de tu elección), no a través de la aplicación NestJS.

### Cómo agregar una nueva migración

1. Crea un archivo `NNNN_descripcion.sql` en `@migrations/` con el siguiente número correlativo.
2. Escribe SQL que sea idempotente (`IF NOT EXISTS`, `ON CONFLICT`, etc.).
3. Si la migración reemplaza una columna, primero carga los datos en la nueva estructura y solo al final elimina la columna antigua (como hacen `002` y `003`).
4. Prueba la migración en una base de datos de desarrollo antes de subirla.

### Qué NO se debe hacer

- **No usar Prisma Migrate (`prisma migrate dev` / `prisma migrate deploy`)**: este proyecto **no gestiona migraciones con Prisma**. El archivo `prisma/schema.prisma` solo refleja el estado actual del modelo para generar el cliente de Prisma; no es la fuente de verdad de migraciones ni se usa para aplicarlas.
- **No editar `prisma/schema.prisma` para crear o modificar tablas en la base de datos**: cualquier cambio de esquema debe hacerse mediante un archivo SQL en `@migrations/`.
- **No escribir SQL crudo ni usar `pg` directamente desde los servicios o controladores del backend**: el acceso a datos en runtime se hace exclusivamente con **Prisma** (`PrismaService`). Las migraciones son una operación de despliegue/esquema, no parte de la lógica de la aplicación.
- **No aplicar migraciones fuera de orden** ni omitir migraciones intermedias.
- **No modificar una migración ya aplicada y subida**: si necesita corregirse, agregue una nueva migración que revierta o ajuste lo anterior, en lugar de reescribir la existente.

---

## 12. Checklist antes de commit

- [ ] Tres capas creadas: module, controller, service.
- [ ] Prisma usado para acceso a datos (backend).
- [ ] Axios usado para llamadas HTTP (frontend).
- [ ] Cambios de esquema/datos realizados mediante migración SQL en `@migrations/` (no con Prisma Migrate).
- [ ] JSDoc en todas las funciones y clases públicas.
- [ ] Test cases escritos para la lógica implementada.
- [ ] `npm run format` ejecutado.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npm test` pasa sin errores.
