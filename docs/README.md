# StravaHeatmap - Documentation 📚

Welcome to the comprehensive documentation for the StravaHeatmap project. This project is built with Next.js 15 and Supabase, implementing modern design patterns for scalability and maintainability.

## 📋 Documentation Index

### 🏗️ Architecture & Design
- **[Architecture](./architecture.md)** - System architecture and design patterns
- **[Design Patterns](./design-patterns.md)** - Implemented design patterns and best practices
- **[Services](./services.md)** - Business logic and external integrations
- **[Crawler Architecture](./crawler-architecture.md)** - Strava data crawler system design

### 🚀 Setup & Development
- **[Development Setup](./development-setup.md)** - Development environment setup guide
- **[Environment Setup](./environment-setup.md)** - Environment variables and configuration
- **[Local Supabase Setup](./local-supabase-setup.md)** - Setting up Supabase locally
- **[Supabase Setup](./supabase-setup.md)** - Production Supabase configuration

### 🗄️ Database & Migrations
- **[Supabase Operations](./supabase-operations.md)** - Complete guide for migrations, seeding, and database operations
- **[Migration Guide](./migration-guide.md)** - Database migration procedures
- **[Supabase Commands](./supabase-commands.md)** - Useful Supabase CLI commands
- **[Testing Without Triggers](./testing-without-triggers.md)** - Database testing strategies

### 🧪 Testing
- **[Testing Strategy](./testing-strategy.md)** - Comprehensive testing guidelines and examples

### 🔧 Troubleshooting & Deployment
- **[Strava OAuth Troubleshooting](./strava-oauth-troubleshooting.md)** - Common OAuth issues and solutions
- **[Deployment Fixes](./deployment-fixes.md)** - Deployment issues and solutions

### 📖 Reference Guides
- **[Quick Reference](./quick-reference.md)** - Quick commands and shortcuts
- **[Package.json Scripts](./package-json-scripts.md)** - Available npm/yarn scripts

## 🏗️ Design Patterns Implemented

This project implements several key design patterns:

1. **Server Components + Client Components Pattern** - Efficient data fetching and UI rendering
2. **Repository Pattern** - Clean data access layer
3. **Service Layer Pattern** - Business logic separation
4. **Real-time Subscriptions** - Live data updates
5. **Optimistic Updates** - Enhanced user experience
6. **Rate Limiting Strategy** - Intelligent API call management
7. **Crawler Architecture** - Automated data synchronization

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
│   ├── migrations/        # Database migrations
│   └── config.toml        # Supabase configuration
├── scripts/               # Utility scripts
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
└── docs/                  # Documentation
```

## 🔧 Key Technologies

- **Next.js 15** - React framework with App Router
- **Supabase** - Backend as a Service (Database, Auth, Real-time)
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **React Leaflet** - Interactive maps
- **Recharts** - Data visualization
- **Jest & Playwright** - Testing framework

## 📈 Features

- ✅ **Activity Dashboard** - Overview of Strava activities
- ✅ **Segment Analysis** - Detailed segment performance tracking
- ✅ **Real-time Updates** - Live data synchronization
- ✅ **Interactive Maps** - Activity and segment visualization
- ✅ **Performance Charts** - Historical data analysis
- ✅ **Responsive Design** - Mobile-friendly interface
- ✅ **Automated Crawler** - Background data synchronization
- ✅ **Rate Limit Management** - Intelligent API usage
- ✅ **Comprehensive Testing** - Unit, integration, and E2E tests

## 🧪 Testing

The project includes comprehensive testing:

- **Unit Tests** - Individual component testing
- **Integration Tests** - Component interaction testing
- **E2E Tests** - Complete workflow testing
- **Performance Tests** - Load and stress testing

Run tests with:
```bash
yarn test          # Unit and integration tests
yarn test:e2e      # End-to-end tests
yarn test:coverage # Coverage report
```

## 🤝 Contributing

See [Development Setup](./development-setup.md) for contribution guidelines and [Testing Strategy](./testing-strategy.md) for testing requirements.

## 📄 License

This project is licensed under the MIT License.

---

**Need help?** Check the troubleshooting guides or create an issue in the repository. 