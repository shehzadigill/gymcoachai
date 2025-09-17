# GymCoach AI

An AI-powered gym coach application built with Next.js, React Native, and AWS Lambda, using a monorepo architecture with Turborepo.

## 🏗️ Architecture

This project follows a modern monorepo structure with the following components:

### Frontend Applications

- **Web App** (`apps/web`): Next.js 15 with TypeScript and Tailwind CSS
- **Mobile App** (`apps/mobile`): React Native with Expo and NativeWind

### Backend Services

- **User Service** (`services/user-service`): Rust-based Lambda for user management
- **Workout Service** (`services/workout-service`): Rust-based Lambda for workout management
- **Nutrition Service** (`services/nutrition-service`): Rust-based Lambda for nutrition tracking
- **AI Service** (`services/ai-service`): Rust-based Lambda for AI recommendations

### Shared Packages

- **Types** (`packages/types`): Shared TypeScript type definitions
- **UI** (`packages/ui`): Shared React components with Tailwind CSS
- **ESLint Config** (`packages/eslint-config-custom`): Shared ESLint configuration
- **TypeScript Config** (`packages/tsconfig`): Shared TypeScript configurations

### Infrastructure

- **AWS CDK** (`infrastructure`): Infrastructure as Code for AWS resources
- **DynamoDB**: Single table design for data storage
- **CloudFront**: CDN for API distribution
- **API Gateway**: REST API endpoints

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Rust (for backend services)
- AWS CLI (for deployment)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd gymcoach-ai
```

2. Install dependencies:

```bash
pnpm install
```

3. Build all packages:

```bash
pnpm run build
```

### Development

Start all development servers:

```bash
pnpm run dev
```

This will start:

- Next.js web app on `http://localhost:3000`
- React Native mobile app (use Expo Go app)
- All backend services in watch mode

### Individual Commands

- **Build**: `pnpm run build`
- **Lint**: `pnpm run lint`
- **Type Check**: `pnpm run type-check`
- **Test**: `pnpm run test`
- **Clean**: `pnpm run clean`

### AWS Deployment

1. Configure AWS credentials:

```bash
aws configure
```

2. Deploy infrastructure:

```bash
pnpm run cdk:deploy
```

3. Synthesize CDK stack:

```bash
pnpm run cdk:synth
```

## 📁 Project Structure

```
gymcoach-ai/
├── apps/
│   ├── web/                 # Next.js web application
│   └── mobile/              # React Native mobile app
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── ui/                  # Shared UI components
│   ├── eslint-config-custom/ # Shared ESLint config
│   └── tsconfig/            # Shared TypeScript configs
├── services/
│   ├── user-service/        # User management Lambda
│   ├── workout-service/     # Workout management Lambda
│   ├── nutrition-service/   # Nutrition tracking Lambda
│   └── ai-service/          # AI recommendations Lambda
├── infrastructure/          # AWS CDK infrastructure
├── .github/workflows/       # GitHub Actions CI/CD
├── turbo.json              # Turborepo configuration
└── pnpm-workspace.yaml     # pnpm workspace configuration
```

## 🛠️ Technology Stack

### Frontend

- **Next.js 15** with App Router
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **NativeWind** for React Native styling
- **Expo** for mobile development

### Backend

- **Rust** for Lambda functions
- **AWS Lambda** for serverless compute
- **DynamoDB** for data storage
- **API Gateway** for REST APIs
- **CloudFront** for CDN

### DevOps

- **Turborepo** for monorepo management
- **pnpm** for package management
- **GitHub Actions** for CI/CD
- **AWS CDK** for infrastructure
- **ESLint** for code linting
- **Prettier** for code formatting

## 🗄️ Database Design

The application uses DynamoDB with a single table design following these patterns:

### Access Patterns

- **User Management**: `USER#<userId>` → User profile data
- **Workouts**: `WORKOUT#<workoutId>` → Workout details
- **Nutrition Plans**: `NUTRITION#<planId>` → Nutrition plan data
- **AI Recommendations**: `RECOMMENDATION#<recId>` → AI suggestions

### Global Secondary Indexes

- **GSI1**: For querying by user and date
- **GSI2**: For querying by type and status

## 🔧 Development Workflow

1. **Feature Development**: Create feature branches from `develop`
2. **Code Quality**: Run `pnpm run lint` and `pnpm run type-check`
3. **Testing**: Run `pnpm run test` for all packages
4. **Building**: Run `pnpm run build` to ensure everything compiles
5. **Pull Request**: Create PR to `develop` branch
6. **Deployment**: Auto-deploy to staging on `develop`, production on `main`

## 📱 Mobile Development

The mobile app is built with React Native and Expo:

```bash
cd apps/mobile
pnpm run ios      # Run on iOS simulator
pnpm run android  # Run on Android emulator
pnpm run web      # Run in web browser
```

## 🌐 Web Development

The web app is built with Next.js:

```bash
cd apps/web
pnpm run dev      # Development server
pnpm run build    # Production build
pnpm run start    # Production server
```

## 🚀 Deployment

### Staging

- Triggered on push to `develop` branch
- Deploys to staging environment
- Includes all infrastructure and applications

### Production

- Triggered on push to `main` branch
- Deploys to production environment
- Requires manual approval for critical changes

## 📊 Monitoring and Observability

- **CloudWatch Logs** for Lambda function logs
- **CloudWatch Metrics** for performance monitoring
- **X-Ray Tracing** for distributed tracing
- **Sentry** for error tracking (configured)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

Built with ❤️ using modern web technologies and best practices.
