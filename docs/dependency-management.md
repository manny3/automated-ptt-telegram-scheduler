# Dependency Management Guide

This document describes the dependency management strategy implemented to ensure consistent and reliable dependency installation across local development and CI environments.

## Overview

The project uses an enhanced dependency management approach that addresses React 19 compatibility issues, peer dependency conflicts, and ensures consistency between local and CI environments.

## Key Features

### 1. Enhanced Installation Scripts

- **`scripts/install-dependencies.sh`**: Main dependency installation script with retry mechanism and error handling
- **`scripts/setup-local-dev.sh`**: Local development environment setup script
- **`scripts/validate-dependencies.sh`**: Dependency validation and compatibility checking

### 2. Configuration Files

- **`.npmrc`**: npm configuration for consistent behavior
- **`.nvmrc`**: Node.js version specification (created by setup script)
- **`package.json`**: Enhanced with dependency management scripts

### 3. CI/CD Integration

- Enhanced GitHub Actions workflow with improved caching and error handling
- Retry mechanisms for dependency installation
- Dependency validation steps

## Usage

### Local Development Setup

For first-time setup or when switching between branches:

```bash
npm run setup:local
```

This script will:
- Check Node.js and npm versions
- Configure npm settings for consistency with CI
- Clean existing installation
- Install dependencies with error handling
- Verify installation
- Create `.nvmrc` file

### Installing Dependencies

For regular dependency installation:

```bash
npm run install:deps
```

Or use the standard npm command (configured via `.npmrc`):

```bash
npm install
```

### Validating Dependencies

To validate that dependencies are correctly installed and compatible:

```bash
npm run deps:validate
```

### Verifying Dependencies

To list installed dependencies:

```bash
npm run deps:verify
```

### Security Audit

To check for security vulnerabilities:

```bash
npm run deps:audit
```

## Configuration Details

### npm Configuration (`.npmrc`)

```ini
# Use legacy peer deps to handle React 19 compatibility issues
legacy-peer-deps=true

# Set audit level to moderate to avoid blocking on minor issues
audit-level=moderate

# Disable funding messages to reduce noise
fund=false

# Enable package-lock for consistent installs
package-lock=true
```

### Key Dependencies

- **React 19.1.1**: Latest React version
- **@testing-library/react 16.x**: Compatible with React 19
- **Jest 29.x**: Testing framework
- **TypeScript 5.x**: Type checking
- **Next.js 15.x**: Framework

## Troubleshooting

### Common Issues

1. **ERESOLVE errors**: Resolved by using `--legacy-peer-deps` flag
2. **Peer dependency warnings**: Expected with React 19, handled by configuration
3. **Engine version warnings**: Handled by `engine-strict=false` in `.npmrc`

### Error Recovery

If you encounter dependency issues:

1. Clean installation:
   ```bash
   rm -rf node_modules package-lock.json
   npm run setup:local
   ```

2. Validate installation:
   ```bash
   npm run deps:validate
   ```

3. Check for conflicts:
   ```bash
   npm run deps:verify
   ```

### CI Environment

The CI environment uses the same scripts and configuration as local development:

- Uses `npm ci --legacy-peer-deps` for faster, deterministic installs
- Implements retry mechanisms with exponential backoff
- Includes comprehensive caching strategy
- Validates dependencies after installation

## Best Practices

1. **Always use the provided scripts** for dependency management
2. **Keep `.npmrc` in version control** for consistency
3. **Update `package-lock.json`** when adding new dependencies
4. **Run validation** after major dependency updates
5. **Use Node.js version specified in `.nvmrc`**

## Maintenance

### Updating Dependencies

1. Update `package.json` with new versions
2. Run `npm run setup:local` to reinstall
3. Run `npm run deps:validate` to verify compatibility
4. Test thoroughly before committing

### Adding New Dependencies

1. Add to `package.json` or use `npm install <package>`
2. Verify compatibility with React 19
3. Update validation script if needed for critical dependencies
4. Commit both `package.json` and `package-lock.json`

## CI/CD Integration

The GitHub Actions workflow includes:

- Multi-layer caching (npm cache, node_modules, build cache)
- Retry mechanisms for dependency installation
- Dependency validation steps
- Consistent environment setup across all jobs

### Workflow Steps

1. **Setup Node.js** with version caching
2. **Cache dependencies** using package-lock.json hash
3. **Install dependencies** with retry mechanism
4. **Validate installation** to ensure compatibility
5. **Run tests/build** with validated dependencies

This approach ensures reliable, fast, and consistent dependency management across all environments.