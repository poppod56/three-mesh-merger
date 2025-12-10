# @poppod/three-mesh-merger

A TypeScript library for merging multiple 3D GLB files into a single optimized mesh with texture atlas support.

## Features

- 🎯 **Merge Multiple GLB Files** - Load and combine any number of 3D models
- 🔄 **Independent Transforms** - Position, rotate, and scale each model before merging
- 🖼️ **Flexible Texture Atlas** - Choose which texture maps to combine (albedo, normal, roughness, metalness, emissive)
- ⚡ **Optimized Output** - Single mesh with single material for maximum performance
- 🎨 **Material Customization** - Override material properties or use averaged values
- 📦 **Client-Side Only** - Lightweight, browser-native implementation
- 🌳 **Tree-Shakeable** - Optimized for modern bundlers

## Installation

```bash
pnpm add @poppod/three-mesh-merger three
# or
npm install @poppod/three-mesh-merger three
# or
yarn add @poppod/three-mesh-merger three
```

## Quick Start

```typescript
import { MeshMerger } from '@poppod/three-mesh-merger'

// Create merger instance
const merger = new MeshMerger()

// Add models
const id1 = await merger.addModel('/models/cube.glb', {
  position: [0, 0, 0]
})

const id2 = await merger.addModel('/models/sphere.glb', {
  position: [2, 0, 0],
  scale: [0.5, 0.5, 0.5]
})

// Merge with options
await merger.merge({
  atlasSize: 2048,
  textureQuality: 0.9,
  atlasMode: {
    albedo: true,
    normal: true,
    roughness: true
  }
})

// Export as GLB
const blob = await merger.export()
// Download or use the merged GLB
```

## Packages

This monorepo contains:

- **@poppod/three-mesh-merger** - Core library ([packages/core](./packages/core))
- **example-vite** - Interactive demo application ([packages/example-vite](./packages/example-vite))

## Development

```bash
# Install dependencies
pnpm install

# Build core library
pnpm build:core

# Run example app
pnpm dev

# Build all packages
pnpm build
```

## Documentation

- [Core Library Documentation](./packages/core/README.md)
- [Example App Documentation](./packages/example-vite/README.md)

## Requirements

- Three.js >= 0.150.0
- Modern browser with WebGL support
- TypeScript (recommended)

## License

MIT © poppod
