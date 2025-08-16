# Raspberry Pi Aliases for Swanson Light Calendar

## Available Aliases

After SSH'ing into your Raspberry Pi, you can use these shortcuts:

### Development

- `cal-dev` - Start frontend development server (Vite)
- `cal-server` - Start backend development server (watch mode)
- `cal-dev-all` - Start both frontend and backend in development mode

### Building

- `cal-build` - Build frontend for production
- `cal-build-all` - Build both frontend and backend

### Running Production

- `cal-preview` - Preview built frontend
- `cal-start` - Start the application
- `cal-stop` - Stop the application

### Code Quality

- `cal-lint` - Run ESLint
- `cal-fix` - Fix all linting and formatting issues
- `cal-check` - Run all type checks, linting, and format checks

### Navigation

- `cal-cd` - Navigate to project directory

## Usage Examples

```bash
# SSH into Pi
ssh jswan@192.168.68.54

# Start development (frontend only)
cal-dev

# Start full development environment
cal-dev-all

# Build for production
cal-build-all

# Navigate to project
cal-cd
```

## Setup on New Terminal Sessions

Aliases are automatically loaded when you SSH in. If you need to reload them manually:

```bash
source ~/.bashrc
```

## Accessing the Application

- **Frontend Development**: http://192.168.68.54:5173
- **Backend Development**: http://192.168.68.54:3001
- **Production Preview**: http://192.168.68.54:4173

## Network Access

To access from other devices on your network, use the Pi's IP address (192.168.68.54) with the appropriate port.
