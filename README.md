# ARVR Mesh Manipulation

A real-time cloth simulation using WebGPU compute shaders and Three.js. This project implements a physically-based cloth simulation with volume-preserving thickness, spring dynamics, and interactive manipulation.

![Three.js](https://img.shields.io/badge/Three.js-0.181.1-blue)
![WebGPU](https://img.shields.io/badge/WebGPU-Compute-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

### Physics Simulation
- **Verlet Integration**: Position-based dynamics running at 360 steps/second for stable simulation
- **Dual-Layer Cloth**: Volume-preserving thickness with top and bottom layers connected by Z-springs
- **Spring System**: Structural, shear, and bending springs for realistic cloth behavior
- **Cloth Tearing**: Springs can break when stretched beyond threshold (190% by default)
- **Collision Detection**: Sphere and cylinder collision with proper response

### Interaction Modes
- **Ball Mode**: Animated sphere collision object for passive interaction
- **Mouse Mode**: Click and hold to extend a cylinder downward through the cloth
- **Tablet Mode**: Pen pressure-sensitive cylinder extension for precise manipulation

### Rendering
- **WebGPU Compute Shaders**: GPU-accelerated physics calculations
- **Physical Material**: Realistic cloth rendering with sheen and proper lighting
- **Wireframe View**: Debug visualization showing vertices and springs
- **Real-time FPS Display**: Performance monitoring

## Requirements

- A browser with WebGPU support (Chrome 113+, Edge 113+, Zen 1.5+, Brave or Firefox Nightly)
- Node.js 16+ for development

## Installation

```bash
# Clone the repository
git clone https://github.com/nikhilr612/arvr_mesh_manipulation.git
cd arvr_mesh_manipulation

# Install dependencies
npm install

# Start development server
npm run dev

# Or
npx vite

#Or you could use python instead
python3 -m http.server
```

## Usage

[![Real-Time Cloth Simulation Demo](https://img.youtube.com/vi/iJd5v5r6yRk/0.jpg)](https://youtu.be/iJd5v5r6yRk)


### Controls

| Control | Action |
|---------|--------|
| Left Mouse Drag | Rotate camera (orbit) |
| Scroll Wheel | Zoom in/out |
| Right Mouse Drag | Pan camera |

### Control Panel (Top Right)

- **FPS Display**: Shows current frames per second
- **Interaction Mode**: Switch between Ball, Mouse, and Tablet modes
- **Wireframe Toggle**: Show/hide wireframe debug view
- **Reset Mesh**: Restore cloth to initial state (repairs tears)

### Interaction Modes

1. **Ball Mode**: A sphere automatically moves through the scene, colliding with the cloth
2. **Mouse Mode**: Click and hold on the cloth to push a cylinder through it. The cylinder extends the longer you hold. Mouse mode restricts left-click based gyration.
3. **Tablet Mode**: Use a pressure-sensitive stylus to push through the cloth. Cylinder depth corresponds to pen pressure. Veikk tablet was used for testing. Compatibility with windows ink or other tablets haven't been tested yet.

## Project Structure

```
arvr_mesh_manipulation/
├── index.html              # Entry HTML file
├── package.json            # Project dependencies
├── vite.config.js          # Vite configuration
└── src/
    ├── main.js             # Application entry point, UI, render loop
    ├── compute/
    │   └── shaders.js      # WebGPU compute shaders for physics
    ├── config/
    │   └── constants.js    # Simulation parameters and configuration
    ├── objects/
    │   ├── cloth.js        # Cloth mesh rendering
    │   ├── sphere.js       # Collision sphere
    │   └── wireframe.js    # Debug wireframe visualization
    ├── scene/
    │   └── setup.js        # Three.js scene, camera, renderer setup
    ├── simulation/
    │   └── cloth.js        # Cloth simulation orchestrator
    ├── utils/
    │   └── uniforms.js     # Shader uniform management
    └── verlet/
        ├── buffers.js      # GPU buffer management
        └── geometry.js     # Verlet vertex and spring geometry
```

## Technical Details

### Cloth Model

The cloth is modeled as a dual-layer system for volume preservation:

- **Top Layer**: Visible surface of the cloth
- **Bottom Layer**: Inner surface, offset by `CLOTH_THICKNESS`
- **Z-Springs**: Connect corresponding vertices between layers

### Spring Types

| Spring Type | Purpose | Breakable |
|-------------|---------|-----------|
| Structural | Connect adjacent vertices | Yes |
| Shear | Connect diagonal vertices | Yes |
| Bending | Connect vertices 2 apart | Yes |
| Z-Springs | Connect layers (volume preservation) | Yes |

### Compute Shader Pipeline

1. **computeSpringForces**: Calculates forces for all springs based on displacement from rest length
2. **computeVertexForces**: Accumulates forces per vertex, applies gravity/wind, handles collisions, and integrates position

### Configuration

Key parameters in `src/config/constants.js`:

```javascript
// Cloth dimensions
CLOTH_WIDTH: 1.5
CLOTH_HEIGHT: 1.5
CLOTH_NUM_SEGMENTS_X: 50
CLOTH_NUM_SEGMENTS_Y: 50

// Physics
CLOTH_THICKNESS: 0.003
Z_SPRING_STIFFNESS: 0.8
SPRING_BREAK_THRESHOLD: 1.9  // 190% stretch to break

// Simulation
STEPS_PER_SECOND: 360
```

## Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Build for production
npm run preview  # Preview production build
```

- You can use `npx vite` to run the server too

## Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome 113+ | ✅ Supported |
| Edge 113+ | ✅ Supported |
| Firefox Nightly | ✅ Supported |
| Zen Browser 1.5+ | ✅ Supported |
| Safari | ❌ Not supported (no WebGPU) |

## Authors

- **Nikhil R.**
- **Prakyath P. Nayak**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Three.js](https://threejs.org/) - 3D graphics library
- [Three.js WebGPU Examples](https://threejs.org/examples/?q=webgpu) - WebGPU compute cloth reference
