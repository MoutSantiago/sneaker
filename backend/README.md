# Backend — Sneaker

API REST desarrollada con **NestJS**, **TypeScript**, **Prisma** y **PostgreSQL**. Parte del proyecto Sneaker, una plataforma de comercio electrónico de calzado deportivo y casual.

## Tecnologías

- [NestJS](https://nestjs.com/) 12 — Framework de Node.js
- [TypeScript](https://www.typescriptlang.org/) 6
- [Prisma](https://www.prisma.io/) 7 — ORM para PostgreSQL
- [@prisma/adapter-pg](https://www.prisma.io/docs/orm-reference/database-compatibility/postgresql) — Adaptador para PostgreSQL
- [pg](https://node-postgres.com/) 8 — Driver de PostgreSQL
- [Jest](https://jestjs.io/) 30 — Tests unitarios e e2e
- [oxlint](https://oxc-project.github.io/) — Linter de TypeScript
- [Prettier](https://prettier.io/) — Formato de código

## Estructura

```
backend/
├── src/
│   ├── app.module.ts        # Módulo raíz
│   ├── app.controller.ts    # Controlador de ejemplo
│   ├── app.service.ts       # Servicio de ejemplo
│   ├── main.ts              # Punto de entrada
│   └── prisma/
│       ├── prisma.module.ts # Módulo de Prisma (global)
│       └── prisma.service.ts# Servicio de Prisma
├── test/
│   └── app.e2e-spec.ts      # Tests end-to-end
├── prisma/
│   └── schema.prisma        # Esquema de base de datos (sin modelos aún)
├── .prettierrc              # Configuración de Prettier
├── .oxlintrc.json           # Configuración de oxlint
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env                     # Variables de entorno (no commitear)
```

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run build` | Compila el proyecto con Nest |
| `npm start` | Inicia en modo producción |
| `npm run start:dev` | Inicia en modo desarrollo (watch) |
| `npm run start:debug` | Inicia en modo debug |
| `npm run start:prod` | Ejecuta el build compilado |
| `npm run lint` | Ejecuta oxlint sobre `src/` y `test/` |
| `npm run format` | Formatea con Prettier `src/**/*.ts` y `test/**/*.ts` |
| `npm test` | Ejecuta tests unitarios (Jest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:cov` | Tests con reporte de cobertura |
| `npm run test:e2e` | Ejecuta tests end-to-end |
| `npm run test:debug` | Tests en modo debug |
| `npm run db:pull` | Sincroniza Prisma con la DB y genera el cliente |
| `npm run db:studio` | Abre Prisma Studio |

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

```
DATABASE_URL="postgresql://user:password@localhost:5432/sneaker?schema=public"
PORT=3000
```

> **Nota para CI:** `prisma generate` requiere la variable `DATABASE_URL` aunque no se conecte a la base de datos real. En GitHub Actions se usa un valor dummy:
> `DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"`

## Cómo ejecutar

```bash
# Instalar dependencias
npm ci

# Generar cliente de Prisma
npx prisma generate

# Ejecutar en desarrollo
npm run start:dev

# Ejecutar linter
npm run lint

# Ejecutar tests
npm test

# Ejecutar tests e2e
npm run test:e2e

# Verificar formato
npx prettier --check "src/**/*.ts" "test/**/*.ts"
```

## CI

Cada push o pull request a `main` o `develop` ejecuta dos jobs separados en GitHub Actions:

- **`lint`**: `npm ci` → `npx prisma generate` → `npm run lint` + `prettier --check`
- **`test`**: `npm ci` → `npx prisma generate` → `npm test`

## Reglas de desarrollo

Consultar [`docs/DEV_GUIDE.md`](../docs/DEV_GUIDE.md) para los estándares de programación, arquitectura de capas, JSDoc, tests y formato.
