# Strava Heatmap - Documentation

Welcome to the Strava Heatmap project documentation. This project is built with Next.js 15 and Supabase, implementing modern design patterns for scalability and maintainability.

## 📚 Documentation Structure

- **[Architecture](./architecture.md)** - System architecture and design patterns
- **[Database Schema](./database-schema.md)** - Supabase database structure
- **[API Reference](./api-reference.md)** - API endpoints and usage
- **[Components](./components.md)** - React components documentation
- **[Services](./services.md)** - Business logic and external integrations
- **[Deployment](./deployment.md)** - Deployment and hosting guide
- **[Development](./development.md)** - Development setup and guidelines

## 🏗️ Design Patterns Implemented

This project implements several key design patterns:

1. **Server Components + Client Components Pattern** - Efficient data fetching and UI rendering
2. **Repository Pattern** - Clean data access layer
3. **Service Layer Pattern** - Business logic separation
4. **Real-time Subscriptions** - Live data updates
5. **Optimistic Updates** - Enhanced user experience

## 🚀 Quick Start

1. **Setup Environment**
   ```bash
   cp .env.local.example .env.local
   # Add your Supabase and Strava credentials
   ```

2. **Install Dependencies**
   ```bash
   yarn install
   ```

3. **Setup Database**
   ```bash
   # Run the schema in Supabase SQL Editor
   cat supabase/schema.sql
   ```

4. **Migrate Data**
   ```bash
   node scripts/migrate-to-supabase.js
   ```

5. **Start Development**
   ```bash
   yarn dev
   ```

## 📊 Project Structure

```
strava-heatmap/
├── app/                    # Next.js App Router
│   ├── components/         # Shared components
│   ├── dashboard/          # Dashboard pages
│   ├── activities/         # Activities pages
│   ├── segments/           # Segments pages
│   └── api/               # API routes
├── lib/                   # Core libraries
│   ├── repositories/      # Data access layer
│   ├── services/          # Business logic
│   └── supabase.ts        # Supabase configuration
├── types/                 # TypeScript definitions
├── supabase/              # Supabase configuration
│   ├── schema.sql         # Database schema
│   └── functions/         # Edge functions
├── scripts/               # Utility scripts
└── docs/                  # Documentation
```

## 🔧 Key Technologies

- **Next.js 15** - React framework with App Router
- **Supabase** - Backend as a Service (Database, Auth, Real-time)
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **React Leaflet** - Interactive maps
- **Recharts** - Data visualization

## 📈 Features

- ✅ **Activity Dashboard** - Overview of Strava activities
- ✅ **Segment Analysis** - Detailed segment performance tracking
- ✅ **Real-time Updates** - Live data synchronization
- ✅ **Interactive Maps** - Activity and segment visualization
- ✅ **Performance Charts** - Historical data analysis
- ✅ **Responsive Design** - Mobile-friendly interface

## 🤝 Contributing

See [Development Guide](./development.md) for contribution guidelines.

## 📄 License

This project is licensed under the MIT License. 