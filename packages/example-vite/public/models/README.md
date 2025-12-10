# Sample 3D Models

This directory contains sample GLB files for testing the mesh merger.

## Download Sample Models

You can download free GLB models from these sources:

### 1. Sketchfab (Free Downloads)
- [https://sketchfab.com/3d-models?features=downloadable&sort_by=-likeCount](https://sketchfab.com/3d-models?features=downloadable&sort_by=-likeCount)
- Look for models with "Download 3D Model" button
- Choose GLB format when downloading

### 2. glTF Sample Models (Official)
- [https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0](https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0)
- Great for testing different features
- Recommended models:
  - `Box/glTF-Binary/Box.glb` - Simple cube
  - `Duck/glTF-Binary/Duck.glb` - Duck model
  - `Avocado/glTF-Binary/Avocado.glb` - Avocado with textures
  - `DamagedHelmet/glTF-Binary/DamagedHelmet.glb` - Helmet with PBR materials

### 3. Poly Haven (Free CC0)
- [https://polyhaven.com/models](https://polyhaven.com/models)
- High-quality models
- Download as GLB format

## Quick Download Script

Run this to download sample models from glTF-Sample-Models:

```bash
# Duck
curl -L https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb -o Duck.glb

# Box
curl -L https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Box/glTF-Binary/Box.glb -o Box.glb

# Avocado
curl -L https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF-Binary/Avocado.glb -o Avocado.glb

# Damaged Helmet
curl -L https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb -o DamagedHelmet.glb
```

## Usage in Example App

Once downloaded, you can:
1. Drag & drop the GLB files into the app
2. Or place them in this folder and load via URL
