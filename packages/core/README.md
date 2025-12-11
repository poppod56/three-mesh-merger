# @poppod/three-mesh-merger

[![npm version](https://img.shields.io/npm/v/@poppod/three-mesh-merger.svg)](https://www.npmjs.com/package/@poppod/three-mesh-merger)
[![npm downloads](https://img.shields.io/npm/dm/@poppod/three-mesh-merger.svg)](https://www.npmjs.com/package/@poppod/three-mesh-merger)
[![license](https://img.shields.io/npm/l/@poppod/three-mesh-merger.svg)](https://github.com/poppod56/three-mesh-merger/blob/main/LICENSE)

A powerful TypeScript library for merging multiple 3D GLB files into a single optimized mesh with flexible texture atlas support.

## Features

- 🎯 **Merge Multiple GLB Files** - Combine any number of 3D models into a single mesh
- 🔄 **Independent Transforms** - Position, rotate, and scale each model before merging
- 🎨 **Decal System** - Place customizable decals on models with transform controls
- 🖼️ **Flexible Texture Atlas** - Choose which texture maps to combine:
  - Albedo/Color maps
  - Normal maps
  - Roughness maps
  - Metalness maps
  - Emissive maps
  - AO maps
- ⚡ **Optimized Output** - Single mesh with single material for maximum performance
- 🎨 **Material Customization** - Override material properties or use averaged values
- 📦 **Client-Side Only** - Lightweight, browser-native implementation
- 🌳 **Tree-Shakeable** - Optimized for modern bundlers
- 📘 **TypeScript First** - Full type safety and IntelliSense support

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
import { MeshMerger } from "@poppod/three-mesh-merger";

// Create merger instance
const merger = new MeshMerger();

// Add models with transforms
const cube = await merger.addModel("/models/cube.glb", {
  position: [0, 0, 0],
});

const sphere = await merger.addModel("/models/sphere.glb", {
  position: [2, 0, 0],
  scale: [0.5, 0.5, 0.5],
});

// Merge with options
await merger.merge({
  atlasSize: 2048,
  textureQuality: 0.9,
  atlasMode: {
    albedo: true,
    normal: true,
    roughness: true,
  },
});

// Export as GLB
const blob = await merger.export();
const url = URL.createObjectURL(blob);
// Download or use the merged GLB
```

## API Reference

### `MeshMerger`

Main class for merging 3D models.

#### Methods

##### `addModel(source: string | Blob, transform?: Transform): Promise<string>`

Add a model from URL or Blob.

```typescript
const id = await merger.addModel("/model.glb", {
  position: [0, 1, 0],
  rotation: [0, Math.PI / 4, 0],
  scale: [1, 1, 1],
});
```

**Parameters:**

- `source`: URL string or Blob/File object
- `transform` (optional): Initial transform

**Returns:** Model ID

##### `updateTransform(id: string, transform: Partial<Transform>): void`

Update transform for a specific model.

```typescript
merger.updateTransform(id, {
  position: [1, 0, 0],
});
```

##### `removeModel(id: string): void`

Remove a model from the merger.

```typescript
merger.removeModel(id);
```

##### `getModels(): ModelInstance[]`

Get all loaded models.

```typescript
const models = merger.getModels();
```

##### `getModel(id: string): ModelInstance | undefined`

Get a specific model by ID.

```typescript
const model = merger.getModel(id);
```

### Decal Methods

##### `addDecal(targetModelId: string, textureUrl: string, options?: DecalOptions): Promise<string>`

Add a decal to a model from texture URL.

```typescript
const decalId = await merger.addDecal(modelId, "/decals/logo.png", {
  position: [0, 1, 0],
  rotation: [0, 0, 0],
  scale: [0.5, 0.5, 0.5],
  opacity: 1,
});
```

##### `addDecalFromTexture(targetModelId: string, texture: THREE.Texture, options?: DecalOptions): string`

Add a decal from existing THREE.Texture.

```typescript
const texture = new THREE.TextureLoader().load("/decals/logo.png");
const decalId = merger.addDecalFromTexture(modelId, texture, {
  position: [0, 1, 0],
  scale: [0.5, 0.5, 0.5],
});
```

##### `updateDecalTransform(id: string, transform: Partial<Transform>): void`

Update decal transform.

```typescript
merger.updateDecalTransform(decalId, {
  position: [1, 1, 0],
  rotation: [0, Math.PI / 4, 0],
});
```

##### `updateDecalOpacity(id: string, opacity: number): void`

Update decal opacity.

```typescript
merger.updateDecalOpacity(decalId, 0.8);
```

##### `removeDecal(id: string): void`

Remove a decal.

```typescript
merger.removeDecal(decalId);
```

##### `getDecals(): DecalInstance[]`

Get all decals.

```typescript
const decals = merger.getDecals();
```

##### `getDecalsForModel(modelId: string): DecalInstance[]`

Get decals for a specific model.

```typescript
const modelDecals = merger.getDecalsForModel(modelId);
```

##### `getDecal(id: string): DecalInstance | undefined`

Get a specific decal by ID.

```typescript
const decal = merger.getDecal(decalId);
```

### Merge Methods

##### `merge(options?: MergeOptions): Promise<void>`

Merge all models with specified options.

```typescript
await merger.merge({
  atlasSize: 2048,
  textureQuality: 0.9,
  atlasMode: {
    albedo: true,
    normal: true,
    roughness: true,
    metalness: true,
  },
  materialOverrides: {
    roughness: 0.5,
    metalness: 0.8,
  },
});
```

##### `export(): Promise<Blob>`

Export merged result as GLB Blob.

```typescript
const blob = await merger.export();
const url = URL.createObjectURL(blob);

// Download
const link = document.createElement("a");
link.href = url;
link.download = "merged.glb";
link.click();
```

##### `getMergedScene(): THREE.Scene | undefined`

Get the merged scene for preview.

##### `getMergedMesh(): THREE.Mesh | undefined`

Get the merged mesh for preview.

##### `setProgressCallback(callback: ProgressCallback): void`

Set progress callback for merge operations.

```typescript
merger.setProgressCallback((stage, progress) => {
  console.log(`${stage}: ${progress * 100}%`);
});
```

##### `clear(): void`

Clear all models and merged result.

```typescript
merger.clear();
```

### Types

#### `Transform`

```typescript
interface Transform {
  position?: [number, number, number];
  rotation?: [number, number, number]; // Euler angles in radians
  scale?: [number, number, number];
}
```

#### `MergeOptions`

```typescript
interface MergeOptions {
  atlasSize?: number; // Default: 2048
  textureQuality?: number; // 0-1, Default: 0.9
  generateMipmaps?: boolean; // Default: true
  atlasMode?: AtlasMode;
  materialOverrides?: MaterialOverrides;
}
```

#### `AtlasMode`

```typescript
interface AtlasMode {
  albedo?: boolean; // Default: true
  normal?: boolean; // Default: false
  roughness?: boolean; // Default: false
  metalness?: boolean; // Default: false
  emissive?: boolean; // Default: false
  aoMap?: boolean; // Default: false
}
```

#### `MaterialOverrides`

```typescript
interface MaterialOverrides {
  roughness?: number;
  metalness?: number;
  color?: number | string; // THREE.Color compatible
  emissive?: number | string;
  emissiveIntensity?: number;
}
```

#### `ProgressCallback`

```typescript
type ProgressCallback = (stage: string, progress: number) => void;
```

#### `DecalInstance`

```typescript
interface DecalInstance {
  id: string;
  textureUrl: string;
  texture?: THREE.Texture;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  targetModelId: string;
  opacity: number;
}
```

#### `DecalOptions`

```typescript
interface DecalOptions {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  opacity?: number;
}
```

## Usage with Frameworks

### React

```tsx
import { MeshMerger } from "@poppod/three-mesh-merger";
import { useEffect, useRef } from "react";

function MyComponent() {
  const mergerRef = useRef(new MeshMerger());

  const handleMerge = async () => {
    await mergerRef.current.addModel("/model1.glb");
    await mergerRef.current.addModel("/model2.glb");
    await mergerRef.current.merge();
    const blob = await mergerRef.current.export();
    // Handle blob
  };

  return <button onClick={handleMerge}>Merge</button>;
}
```

### Next.js

```tsx
"use client";

import { MeshMerger } from "@poppod/three-mesh-merger";
import { useState } from "react";

export default function MergePage() {
  const [merger] = useState(() => new MeshMerger());

  // Your implementation
}
```

### Vue 3

```vue
<script setup>
import { MeshMerger } from "@poppod/three-mesh-merger";
import { ref } from "vue";

const merger = ref(new MeshMerger());

const handleMerge = async () => {
  await merger.value.addModel("/model.glb");
  await merger.value.merge();
  const blob = await merger.value.export();
  // Handle blob
};
</script>
```

## How It Works

1. **Load Models**: GLB files are loaded using Three.js GLTFLoader
2. **Apply Transforms**: Each model can be positioned, rotated, and scaled independently
3. **Geometry Merging**: All geometries are merged into a single BufferGeometry
4. **Texture Atlas**: Textures are packed into atlases using potpack algorithm
5. **UV Remapping**: UV coordinates are updated to match atlas layout
6. **Material Creation**: Single material is created with all atlas textures
7. **Export**: Final merged model is exported as GLB using Three.js GLTFExporter

## Performance Considerations

- **Atlas Size**: Larger atlas = better quality but more memory
- **Texture Quality**: Lower quality = smaller file size
- **Map Selection**: Only enable needed maps to save memory
- **Model Count**: More models = longer merge time

## Browser Support

- Modern browsers with WebGL support
- ES2020+ JavaScript features
- Canvas API for texture processing

## Peer Dependencies

- `three` >= 0.150.0

## License

MIT © poppod

## Links

- [GitHub Repository](https://github.com/poppod56/three-mesh-merger)
- [npm Package](https://www.npmjs.com/package/@poppod/three-mesh-merger)
- [Example Application](../example-vite)
- [Three.js Documentation](https://threejs.org/docs)
