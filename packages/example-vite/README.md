# Example Vite Application

Interactive demo application for [@poppod/three-mesh-merger](../core).

## Features

- 📁 **File Upload** - Drag & drop or browse for GLB files
- 🎛️ **Transform Controls** - Adjust position, rotation, and scale for each model
- 🖼️ **Atlas Configuration** - Choose which texture maps to combine
- 👁️ **Real-time Preview** - See your models in 3D before merging
- 📥 **Export** - Download merged GLB file

## Getting Started

### Install Dependencies

From the root of the monorepo:

```bash
pnpm install
```

### Run Development Server

```bash
pnpm dev
```

Or from the root:

```bash
pnpm --filter example-vite dev
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
pnpm build
```

## How to Use

1. **Upload Models**
   - Click the upload area or drag & drop GLB files
   - Multiple files can be uploaded at once

2. **Transform Models**
   - Click on a model in the list to select it
   - Use the transform controls to adjust:
     - Position (X, Y, Z)
     - Rotation (X, Y, Z in radians)
     - Scale (X, Y, Z)
   - Changes are visible in real-time in the 3D viewport

3. **Configure Merge Settings**
   - **Atlas Size**: Choose from 512, 1024, 2048, or 4096
   - **Quality**: Adjust texture quality (0-1)
   - **Texture Maps**: Select which maps to include in the atlas:
     - Albedo/Color (recommended)
     - Normal
     - Roughness
     - Metalness
     - Emissive

4. **Merge & Export**
   - Click "Merge Models" to combine all models
   - After merging, click "Export GLB" to download the result
   - Use "Clear & Start Over" to reset and start a new merge

## Technology Stack

- **React** - UI framework
- **React Three Fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for R3F
- **Three.js** - 3D graphics library
- **@poppod/three-mesh-merger** - Core merge library
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety

## Project Structure

```
src/
├── components/
│   ├── Scene.tsx           # R3F canvas and scene setup
│   ├── ModelPreview.tsx    # Display models in 3D
│   ├── FileUpload.tsx      # File upload UI
│   ├── ModelList.tsx       # List of loaded models
│   └── MergePanel.tsx      # Merge settings and controls
├── hooks/
│   └── useMeshMerger.ts   # Custom hook for MeshMerger
├── App.tsx                # Main application
├── main.tsx              # Entry point
└── styles.css            # Global styles
```

## Key Components

### `useMeshMerger` Hook

Custom React hook that wraps the MeshMerger API:

```tsx
const {
  merger,        // MeshMerger instance
  models,        // Array of loaded models
  isMerged,      // Boolean merge status
  progress,      // Current merge progress
  addModel,      // Add model function
  updateTransform, // Update transform function
  removeModel,   // Remove model function
  merge,         // Merge function
  exportGLB,     // Export function
  clear          // Clear function
} = useMeshMerger()
```

### Scene Component

React Three Fiber scene with:
- OrbitControls for camera
- Grid helper
- Environment lighting
- Model preview

### ModelPreview Component

Displays loaded models or merged result:
- Shows individual models before merge
- Shows single merged mesh after merge
- Supports transform controls (optional)

## Tips

- Start with small atlas sizes (1024) for testing
- Enable only the texture maps you need
- Use quality 0.9 for production builds
- Test merged models in external viewers (e.g., [glTF Viewer](https://gltf-viewer.donmccurdy.com/))

## Troubleshooting

### Models not displaying
- Ensure GLB files are valid
- Check browser console for errors
- Try different camera angles

### Merge fails
- Check that models have textures
- Reduce atlas size if out of memory
- Ensure all models are loaded before merging

### Export issues
- Ensure merge completed successfully
- Check browser console for errors
- Try smaller atlas size

## License

MIT © poppod
