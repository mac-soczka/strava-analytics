# StravaHeatmap 🚴‍♂️

A modern web application for visualizing and analyzing Strava activities and segments with interactive maps, performance charts, and real-time data synchronization.

## 🌟 Features

- **📊 Activity Dashboard** - Comprehensive overview of your Strava activities
- **🗺️ Interactive Maps** - Visualize your routes with Leaflet maps
- **📈 Performance Analytics** - Track your progress with detailed charts
- **🏁 Segment Analysis** - Analyze your performance on Strava segments
- **🔄 Real-time Sync** - Automated data synchronization with Strava API
- **📱 Responsive Design** - Works perfectly on desktop and mobile
- **🔐 Secure Authentication** - OAuth 2.0 integration with Strava

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd strava-heatmap
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   # Add your Supabase and Strava credentials
   ```

4. **Start the development server**
   ```bash
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Maps**: React Leaflet
- **Charts**: Recharts
- **Authentication**: Strava OAuth 2.0
- **Testing**: Jest, Playwright

## 📁 Project Structure

```
strava-heatmap/
├── app/                    # Next.js App Router
│   ├── components/         # Shared React components
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
├── scripts/               # Utility scripts
├── tests/                 # Test files
└── docs/                  # Documentation
```

## 📚 Documentation

For detailed documentation, see the [docs](./docs/) directory:

- **[📖 Documentation Overview](./docs/README.md)** - Complete documentation index
- **[🏗️ Architecture](./docs/architecture.md)** - System design and patterns
- **[🔧 Development Setup](./docs/development-setup.md)** - Getting started guide
- **[🚀 Deployment](./docs/deployment-fixes.md)** - Deployment instructions
- **[🧪 Testing Strategy](./docs/testing-strategy.md)** - Testing guidelines

## 🔧 Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn test` - Run unit and integration tests
- `yarn test:e2e` - Run end-to-end tests
- `yarn lint` - Run ESLint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Strava API](https://developers.strava.com/) for activity data
- [Supabase](https://supabase.com/) for backend services
- [Next.js](https://nextjs.org/) for the React framework
- [Leaflet](https://leafletjs.com/) for interactive maps

## 📞 Support

If you have any questions or need help, please:

1. Check the [documentation](./docs/)
2. Search existing [issues](../../issues)
3. Create a new issue with detailed information

---

**Happy coding! 🚴‍♂️💨**
