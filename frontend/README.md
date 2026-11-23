# Frontend — Sneaker

Interfaz de usuario desarrollada con **Next.js 16**, **React 19**, **TypeScript** y **Tailwind CSS 4**. Parte del proyecto Sneaker, una plataforma de comercio electrónico de calzado deportivo y casual.

## Tecnologías

- [Next.js](https://nextjs.org/) 16.4.6 — Framework de React (App Router)
- [React](https://react.dev/) 19.3.0
- [TypeScript](https://www.typescriptlang.org/) 5
- [Tailwind CSS](https://tailwindcss.com/) 4.3.3
- [Axios](https://axios-http.com/) 1.21.1 — Llamadas HTTP a la API
- [Jest](https://jestjs.io/) 30 — Tests
- [ESLint](https://eslint.org/) 9 — Linter con `eslint-config-next`
- [Prettier](https://prettier.io/) — Formato de código

## Estructura

```
frontend/
├── app/
│   ├── layout.tsx         # Layout raíz
│   ├── page.tsx           # Página de inicio (plantilla por defecto)
│   └── globals.css        # Estilos globales
├── public/
│   ├── next.svg
│   ├── vercel.svg
│   └── ...
├── .prettierrc            # Configuración de Prettier
├── eslint.config.mjs      # Configuración de ESLint
├── jest.config.ts         # Configuración de Jest
├── next.config.ts         # Configuración de Next.js
├── tsconfig.json
├── package.json
└── .env*                  # Variables de entorno (no commitear)
```

## Scripts

| Script           | Descripción                               |
| ---------------- | ----------------------------------------- |
| `npm run dev`    | Inicia servidor de desarrollo             |
| `npm run build`  | Compila para producción                   |
| `npm start`      | Inicia en modo producción                 |
| `npm run lint`   | Ejecuta ESLint                            |
| `npm run format` | Formatea con Prettier `app/**/*.{ts,tsx}` |
| `npm test`       | Ejecuta tests con Jest                    |

## Variables de entorno

Crear un archivo `.env.local` (u otro según necesidad):

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Cómo ejecutar

```bash
# Instalar dependencias
npm ci

# Ejecutar en desarrollo
npm run dev

# Ejecutar linter
npm run lint

# Ejecutar tests
npm test

# Verificar formato
npx prettier --check "app/**/*.{ts,tsx}"
```

La aplicación estará disponible en `http://localhost:3000` (por defecto).

## CI

Cada push o pull request a `main` o `develop` ejecuta dos jobs separados en GitHub Actions:

- **`lint`**: `npm ci` → `npm run lint` + `prettier --check`
- **`test`**: `npm ci` → `npm test`

## Reglas de desarrollo

Consultar [`docs/DEV_GUIDE.md`](../docs/DEV_GUIDE.md) para los estándares de programación, uso de Axios, JSDoc, tests y formato.
