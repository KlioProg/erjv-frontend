# 💻 ERJV Enterprise Frontend & POS Platform

<p align="center">
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/TanStack_Query-FF4154?style=for-the-badge&logo=react-query&logoColor=white" alt="TanStack Query" />
  <img src="https://img.shields.io/badge/Radix_UI-161618?style=for-the-badge&logo=radix-ui&logoColor=white" alt="Radix UI" />
</p>

The modern web application for the **ERJV Enterprise Business Platform**. Built with **React 18**, **Vite**, **TypeScript**, **Tailwind CSS**, and **TanStack Query**, it provides responsive, real-time interfaces for Executive Dashboards, Staffing Management, Inventory & Multi-Warehouse Stock Tracking, Fleet Logistics, and Client Management.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Application Modules](#-application-modules)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Installation & Development](#installation--development)
  - [Building for Production](#building-for-production)
- [Architecture & Design System](#-architecture--design-system)
- [Project Directory Structure](#-project-directory-structure)

---

## ✨ Key Features

- **Executive & Operations Dashboards**: High-level KPIs, inventory alerts, fleet utilization, and quick action bars.
- **Staffing & User Roles**: Employee profiles, user account linking, position assignments, and role-based permissions (`OWNER`, `ADMIN`, `STAFF`).
- **Warehouse & Stock Management**: Multi-warehouse allocation, real-time quantity adjustments (increments, decrements, and exact audits), and pricing oversight.
- **Fleet & Transport Tracking**: Delivery vehicle status management (`Available`, `In Delivery`, `Maintenance`, `Out of Service`), payload capacity specs, and dispatch readiness.
- **Client Relations (CRM)**: Searchable client directory, contact person management, and delivery locations.
- **Archive & Restore UX**: Unified `ArchiveTabNav` tabs across all enterprise lists allowing seamless deactivation, viewing archived assets, and one-click reactivation.
- **Optimistic Updates & Caching**: Powered by TanStack Query for instant UI updates, cache invalidation, and background synchronization.

---

## 🛠 Tech Stack

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Core Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Modern component architecture with type safety |
| **Bundler & Dev Server** | [Vite 8](https://vite.dev/) | Instant HMR and optimized production bundling |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) + Custom Design Tokens | Utility-first responsive styling with Dark Mode |
| **UI Primitives** | [Radix UI](https://www.radix-ui.com/) / [shadcn](https://ui.shadcn.com/) | Accessible dialogs, dropdown menus, and tabs |
| **Server State & Data Fetching** | [TanStack React Query v5](https://tanstack.com/query) | Cache synchronization, mutations, and optimistic UI |
| **HTTP Client** | [Axios](https://axios-http.com/) | Custom interceptors for JWT token injection and error formatting |
| **Notifications** | [Sonner](https://sonner.emilkowal.ski/) | Toast notification system with custom actions |
| **Icons** | [Lucide React](https://lucide.dev/) | Comprehensive vector icons |

---

## 📱 Application Modules

1. **Dashboard (`/dashboard`)**:
   - Live fleet KPI cards, low-stock alerts, quick dispatch stats, and recent system activities.
2. **Staffing & HR (`/staffing`)**:
   - Employee directory, job position manager, and role groupings with account linking.
3. **Operations & Inventory (`/operations`)**:
   - Product catalog, warehouse management, stock adjustments, and delivery vehicle dispatch.
4. **Clients / CRM (`/crm`)**:
   - Client records, contact details, search filters, and delivery addresses.
5. **Authentication (`/login`, `/signup`)**:
   - JWT authentication, session persistence, role-aware route protection, and account profile management.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.x or later (v20+ recommended)
- **npm**: v9.x or later
- Running **ERJV Backend** API server (default at `http://localhost:3000`)

---

### Environment Configuration

1. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. Configure the API endpoint:
   ```env
   # ERJV Backend API Base URL
   VITE_API_URL=http://localhost:3000
   ```

---

### Installation & Development

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server with HMR
npm run dev
```

The application will be accessible at [`http://localhost:5173`](http://localhost:5173).

---

### Building for Production

```bash
# Type-check and build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 🎨 Architecture & Design System

- **API Layer (`src/features/**/api.ts`)**: Pure async API functions communicating with backend REST endpoints via `apiClient`.
- **Query Hooks (`src/features/**/hooks.ts`)**: TanStack Query custom hooks encapsulating query keys, cache invalidation, and toast feedback.
- **Components (`src/components/`)**:
  - `ui/`: Reusable primitive components (Buttons, Dialogs, Cards, Tables, Tabs, Badges, ArchiveTabNav).
  - `operations/`, `staffing/`, `crm/`, `dashboard/`: Feature-specific views and interactive modals.
- **Centralized Error Handling**: `getErrorMessage` in `src/lib/api-client.ts` translates server constraints and network failures into clear, actionable toast notifications.

---

## 📁 Project Directory Structure

```text
erjv-frontend/
├── public/                     # Static assets & favicon
├── src/
│   ├── components/
│   │   ├── auth/               # Login, Signup, Profile modals
│   │   ├── crm/                # Client list & modals
│   │   ├── dashboard/          # Executive and Operations dashboards
│   │   ├── layout/             # Sidebar, Header, and Dashboard layouts
│   │   ├── operations/         # Warehouses, Stock items, Vehicles, Inventory
│   │   ├── staffing/           # Employees, Job positions, Role assignments
│   │   └── ui/                 # Reusable UI component library (shadcn/radix)
│   ├── features/               # Feature domain API clients, hooks & TypeScript types
│   │   ├── auth/               # AuthContext & token management
│   │   ├── crm/                # Client API & hooks
│   │   ├── logistics/          # Warehouses, Vehicles & Stock hooks/APIs
│   │   ├── products/           # Product catalog hooks/APIs
│   │   └── staffing/           # Employee & Job hooks/APIs
│   ├── lib/                    # API client instance, phone utils, utility classes
│   ├── App.tsx                 # Root application component & routing
│   ├── index.css               # Global Tailwind CSS and design tokens
│   └── main.tsx                # React DOM entrypoint
├── index.html                  # HTML template
├── vite.config.ts              # Vite bundler configuration
└── tsconfig.json               # TypeScript configuration
```

---

<p align="center">
  <sub>Built with ❤️ for ERJV Enterprise Management</sub>
</p>
