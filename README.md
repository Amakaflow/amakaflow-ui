
# Workout Content Transformation

This is a code bundle for Workout Content Transformation. The original project is available at https://www.figma.com/design/4BiETidVajMqGCS57Nn3wG/Workout-Content-Transformation.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Testing

This project includes comprehensive unit tests using Vitest and React Testing Library.

### Running Tests

- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

### Test Coverage

The test suite includes:

- **Library Functions** (`src/lib/__tests__/`):
  - `mock-api.test.ts` - API functions (generateWorkoutStructure, validateWorkout, autoMapWorkout, etc.)
  - `workout-history.test.ts` - Workout history management
  - `storage.test.ts` - LocalStorage utilities
  - `exercise-library.test.ts` - Exercise search and confidence calculation
  - `devices.test.ts` - Device management functions

- **Components** (`src/components/__tests__/`):
  - `AddSources.test.tsx` - Source input component

All tests are passing with 84 test cases covering core functionality.

## Documentation

All project documentation has been organized into the `/docs` folder:

- **`/docs/auth`** - Authentication setup (Clerk, Supabase Auth, user management)
- **`/docs/oauth`** - OAuth provider setup (Google, Apple)
- **`/docs/database`** - Database setup and migrations (Supabase)
- **`/docs/getting-started`** - Quick start guides

See [`/docs/README.md`](./docs/README.md) for a complete documentation index.

## Quick Links

- [Quick Start Guide](./docs/getting-started/QUICK_START.md)
- [Clerk Setup](./docs/auth/CLERK_SETUP.md)
- [Supabase Setup](./docs/database/SUPABASE_SETUP.md)
- [Google OAuth](./docs/oauth/GOOGLE_OAUTH_SETUP.md)
- [Apple OAuth](./docs/oauth/APPLE_OAUTH_SETUP.md)

## Utility Scripts

Utility scripts are organized in the `/scripts` folder:

- **`/scripts/auth`** - User deletion scripts (Clerk, Supabase)
- **`/scripts/oauth`** - OAuth helper scripts (Apple JWT generator)
- **`/scripts/database`** - Database setup scripts

See [`/scripts/README.md`](./scripts/README.md) for usage instructions.
  