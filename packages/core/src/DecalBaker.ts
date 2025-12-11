import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import type { DecalInstance, DecalBakeOptions, UVProjection } from "./types";
import { textureToCanvas, canvasToTexture } from "./utils/textureUtils";

/**
 * Atlas region info for a material
 */
export interface AtlasRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  atlasSize: number;
}

/**
 * Model info for decal baking
 */
export interface ModelBakeInfo {
  id: string;
  mesh: THREE.Mesh;
  material: THREE.Material;
  atlasRegion: AtlasRegion;
  modelTransform?: {
    scale: [number, number, number];
  };
}

/**
 * Handles baking decals onto texture atlases
 * Projects 3D decal positions to UV space and composites textures
 */
export class DecalBaker {
  /**
   * Bake decals using GPU rendering (render-to-texture)
   * This matches the preview rendering exactly!
   */
  bakeDecalsToModelTextureGPU(
    mesh: THREE.Mesh,
    material: THREE.MeshStandardMaterial,
    decals: DecalInstance[],
    atlasSize: number
  ): THREE.Texture | null {
    if (!material.map || !material.map.image) {
      console.warn("No base texture found on material");
      return null;
    }

    const baseTexture = material.map;
    const textureSize = atlasSize || 2048;

    console.log("🎨 GPU Baking decals:", {
      decalCount: decals.length,
      textureSize,
    });

    // Create offscreen renderer
    const canvas = document.createElement("canvas");
    canvas.width = textureSize;
    canvas.height = textureSize;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(textureSize, textureSize);

    // Create render target
    const renderTarget = new THREE.WebGLRenderTarget(textureSize, textureSize, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    // Create scene with mesh in UV-projected space
    const scene = new THREE.Scene();

    // Clone mesh and transform vertices from 3D space to UV space
    const uvMesh = this.createUVProjectedMesh(mesh, baseTexture);
    scene.add(uvMesh);

    // Add decals in UV space
    for (const decal of decals) {
      if (!decal.texture?.image) continue;

      try {
        // Create DecalGeometry on the UV-projected mesh
        const decalGeo = new DecalGeometry(
          uvMesh,
          new THREE.Vector3(...decal.position),
          new THREE.Euler(...decal.rotation),
          new THREE.Vector3(...decal.scale)
        );

        const decalMat = new THREE.MeshBasicMaterial({
          map: decal.texture,
          transparent: true,
          opacity: decal.opacity,
          depthTest: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
        });

        const decalMesh = new THREE.Mesh(decalGeo, decalMat);
        scene.add(decalMesh);
      } catch (e) {
        console.warn(`Failed to create decal ${decal.id}:`, e);
      }
    }

    // Setup orthographic camera for UV space (0,0) to (1,1)
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
    camera.position.z = 1;

    // Render to target
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    // Read pixels and create texture
    const pixels = new Uint8Array(textureSize * textureSize * 4);
    renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      textureSize,
      textureSize,
      pixels
    );

    // Create canvas from pixels
    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = textureSize;
    resultCanvas.height = textureSize;
    const ctx = resultCanvas.getContext("2d");

    if (ctx) {
      const imageData = new ImageData(
        new Uint8ClampedArray(pixels),
        textureSize,
        textureSize
      );
      ctx.putImageData(imageData, 0, 0);
    }

    // Cleanup
    renderer.dispose();
    renderTarget.dispose();
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    // Create result texture
    const resultTexture = new THREE.CanvasTexture(resultCanvas);
    resultTexture.flipY = baseTexture.flipY;
    resultTexture.colorSpace = baseTexture.colorSpace || THREE.SRGBColorSpace;

    // Debug download
    const link = document.createElement("a");
    link.download = "baked_texture_gpu.png";
    link.href = resultCanvas.toDataURL("image/png");
    link.click();

    return resultTexture;
  }

  /**
   * Create a mesh where UV coordinates are used as vertex positions
   * This allows rendering in UV space (0-1, 0-1)
   */
  private createUVProjectedMesh(
    originalMesh: THREE.Mesh,
    baseTexture: THREE.Texture
  ): THREE.Mesh {
    const originalGeo = originalMesh.geometry as THREE.BufferGeometry;
    const uvAttr = originalGeo.attributes.uv;

    if (!uvAttr) {
      throw new Error("Mesh has no UV coordinates");
    }

    // Create new geometry with positions from UV
    const newGeo = new THREE.BufferGeometry();

    // Set positions from UVs (but in 3D space for DecalGeometry)
    const positions = new Float32Array(uvAttr.count * 3);
    for (let i = 0; i < uvAttr.count; i++) {
      positions[i * 3] = uvAttr.getX(i);
      positions[i * 3 + 1] = uvAttr.getY(i);
      positions[i * 3 + 2] = 0; // Flat in Z
    }

    newGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    newGeo.setAttribute("uv", uvAttr.clone());

    // Copy normals if available (pointing in Z direction)
    if (originalGeo.attributes.normal) {
      const normals = new Float32Array(uvAttr.count * 3);
      for (let i = 0; i < uvAttr.count; i++) {
        normals[i * 3] = 0;
        normals[i * 3 + 1] = 0;
        normals[i * 3 + 2] = 1;
      }
      newGeo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    }

    // Copy index if available
    if (originalGeo.index) {
      newGeo.setIndex(originalGeo.index.clone());
    }

    // Create material with base texture
    const material = new THREE.MeshBasicMaterial({
      map: baseTexture,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(newGeo, material);
  }

  /**
   * Bake decals onto a model's original texture BEFORE atlas merge
   * This is the simpler approach - work in original UV space
   */
  bakeDecalsToModelTexture(
    mesh: THREE.Mesh,
    material: THREE.MeshStandardMaterial,
    decals: DecalInstance[],
    options?: DecalBakeOptions
  ): THREE.Texture | null {
    const opts = {
      padding: 2,
      blendMode: "normal" as const,
      ...options,
    };

    // Get the base texture
    const baseTexture = material.map;
    if (!baseTexture || !baseTexture.image) {
      console.warn("No base texture found on material");
      return null;
    }

    // Convert base texture to canvas
    const originalWidth = baseTexture.image.width || 1024;
    const originalHeight = baseTexture.image.height || 1024;

    // If targetTextureSize is provided, create canvas at that size
    // This prevents quality loss from rescaling in MaterialAtlas
    const targetSize = opts.targetTextureSize;
    const canvasWidth = targetSize || originalWidth;
    const canvasHeight = targetSize || originalHeight;

    const baseCanvas = document.createElement("canvas");
    baseCanvas.width = canvasWidth;
    baseCanvas.height = canvasHeight;
    const ctx = baseCanvas.getContext("2d");

    if (!ctx) {
      console.warn("Failed to get 2D context");
      return null;
    }

    // Draw base texture, scaled up if needed
    ctx.drawImage(baseTexture.image, 0, 0, canvasWidth, canvasHeight);

    // Debug: compute and log geometry bbox
    const geometry = mesh.geometry as THREE.BufferGeometry;
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;

    console.log("Baking decals to model texture:", {
      meshName: mesh.name,
      textureSize: { w: baseCanvas.width, h: baseCanvas.height },
      decalCount: decals.length,
      textureFlipY: baseTexture.flipY,
      geometryBBox: bbox
        ? {
            min: `${bbox.min.x.toFixed(3)}, ${bbox.min.y.toFixed(
              3
            )}, ${bbox.min.z.toFixed(3)}`,
            max: `${bbox.max.x.toFixed(3)}, ${bbox.max.y.toFixed(
              3
            )}, ${bbox.max.z.toFixed(3)}`,
          }
        : null,
    });

    // Process each decal
    for (const decal of decals) {
      if (!decal.texture?.image) continue;

      // If decal has UV from raycaster hit, use it directly!
      if (decal.uv) {
        console.log(`Decal ${decal.id} using raycaster UV:`, decal.uv);
        this.drawDecalAtUV(ctx, decal, canvasWidth, canvasHeight);
      } else {
        // Fallback: use DecalGeometry approach
        console.log(`Decal ${decal.id} using DecalGeometry fallback`);
        this.drawDecalWithGeometry(
          ctx,
          mesh,
          decal,
          canvasWidth,
          canvasHeight,
          opts.blendMode
        );
      }
    }

    // Convert canvas back to texture
    const resultTexture = new THREE.CanvasTexture(baseCanvas);
    resultTexture.flipY = baseTexture.flipY;
    resultTexture.colorSpace = baseTexture.colorSpace || THREE.SRGBColorSpace;
    resultTexture.wrapS = baseTexture.wrapS;
    resultTexture.wrapT = baseTexture.wrapT;
    resultTexture.needsUpdate = true;

    console.log("🎨 Baked texture created:", {
      size: `${baseCanvas.width}x${baseCanvas.height}`,
      flipY: resultTexture.flipY,
    });

    // DEBUG: Download the baked texture to see where decal is
    const link = document.createElement("a");
    link.download = "baked_texture_debug.png";
    link.href = baseCanvas.toDataURL("image/png");
    link.click();
    console.log("📥 Downloaded baked texture for inspection");

    return resultTexture;
  }

  /**
   * Draw decal at UV coordinates from raycaster hit
   * This is the most accurate method!
   */
  private drawDecalAtUV(
    ctx: CanvasRenderingContext2D,
    decal: DecalInstance,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!decal.uv || !decal.texture?.image) return;

    const [hitU, hitV] = decal.uv;
    const decalImage = decal.texture.image as
      | HTMLImageElement
      | HTMLCanvasElement;

    // Calculate decal size in UV space based on scale
    // Assuming scale is in world units, convert to UV space (rough estimate)
    const avgScale = (decal.scale[0] + decal.scale[1] + decal.scale[2]) / 3;
    const decalSizeInUV = avgScale * 0.1; // Adjust this factor based on your needs

    // Calculate UV bounds (centered on hit point)
    const halfSize = decalSizeInUV / 2;
    const minU = hitU - halfSize;
    const maxU = hitU + halfSize;
    const minV = hitV - halfSize;
    const maxV = hitV + halfSize;

    console.log("Drawing decal at raycaster UV:", {
      hitUV: [hitU.toFixed(4), hitV.toFixed(4)],
      uvBounds: {
        minU: minU.toFixed(4),
        maxU: maxU.toFixed(4),
        minV: minV.toFixed(4),
        maxV: maxV.toFixed(4),
      },
      decalSizeInUV: decalSizeInUV.toFixed(4),
    });

    // Convert UV bounds to canvas coordinates (flip V)
    const x = minU * canvasWidth;
    const y = (1 - maxV) * canvasHeight;
    const w = (maxU - minU) * canvasWidth;
    const h = (maxV - minV) * canvasHeight;

    console.log("Canvas coordinates:", {
      x: x.toFixed(1),
      y: y.toFixed(1),
      w: w.toFixed(1),
      h: h.toFixed(1),
      canvasSize: `${canvasWidth}x${canvasHeight}`,
    });

    // Draw debug marker first (red square) to see if we're drawing at all
    ctx.save();
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Draw decal on top
    ctx.save();
    ctx.globalAlpha = decal.opacity;
    ctx.drawImage(decalImage, x, y, w, h);
    ctx.restore();

    console.log("✅ Decal drawn to canvas");
  }

  /**
   * Draw decal using DecalGeometry (fallback method)
   */
  private drawDecalWithGeometry(
    ctx: CanvasRenderingContext2D,
    mesh: THREE.Mesh,
    decal: DecalInstance,
    canvasWidth: number,
    canvasHeight: number,
    blendMode: "normal" | "multiply" | "overlay"
  ): void {
    try {
      const position = new THREE.Vector3(...decal.position);
      const rotation = new THREE.Euler(...decal.rotation);
      const size = new THREE.Vector3(...decal.scale);

      const decalGeo = new DecalGeometry(mesh, position, rotation, size);

      if (decalGeo.attributes.position.count === 0) {
        console.warn(`DecalGeometry has no vertices`);
        return;
      }

      this.drawDecalTriangles(
        ctx,
        decalGeo,
        decal.texture!.image as HTMLImageElement | HTMLCanvasElement,
        canvasWidth,
        canvasHeight,
        decal.opacity,
        blendMode,
        mesh,
        decal
      );

      decalGeo.dispose();
    } catch (e) {
      console.warn("Failed to create DecalGeometry:", e);
    }
  }

  /**
   * Draw decal triangles from DecalGeometry onto the texture canvas
   * Uses the UV coordinates from DecalGeometry which map to mesh UV space
   */
  private drawDecalTriangles(
    ctx: CanvasRenderingContext2D,
    decalGeo: THREE.BufferGeometry,
    decalImage: HTMLImageElement | HTMLCanvasElement,
    canvasWidth: number,
    canvasHeight: number,
    opacity: number,
    _blendMode: "normal" | "multiply" | "overlay",
    originalMesh: THREE.Mesh,
    decal: DecalInstance
  ): void {
    const decalPosAttr = decalGeo.attributes.position;
    const decalUVAttr = decalGeo.attributes.uv; // Decal's own UVs (for sampling decal texture)
    const posCount = decalPosAttr.count;

    if (!decalUVAttr || posCount === 0) return;

    // Get original mesh geometry for UV lookup
    const meshGeo = originalMesh.geometry as THREE.BufferGeometry;
    const meshPosAttr = meshGeo.attributes.position;
    const meshUVAttr = meshGeo.attributes.uv;

    if (!meshUVAttr || !meshPosAttr) {
      console.warn("Original mesh has no UVs");
      return;
    }

    // For each decal vertex, find its position on the mesh and get mesh UV
    // Then find the UV bounding box in mesh UV space
    let minU = Infinity,
      maxU = -Infinity;
    let minV = Infinity,
      maxV = -Infinity;

    // Sample some decal vertices and find their mesh UVs
    const sampleCount = Math.min(posCount, 100);
    const step = Math.max(1, Math.floor(posCount / sampleCount));

    for (let i = 0; i < posCount; i += step) {
      const decalPos = new THREE.Vector3().fromBufferAttribute(decalPosAttr, i);
      const meshUV = this.findMeshUVAtPosition(meshGeo, decalPos);
      if (meshUV) {
        minU = Math.min(minU, meshUV.x);
        maxU = Math.max(maxU, meshUV.x);
        minV = Math.min(minV, meshUV.y);
        maxV = Math.max(maxV, meshUV.y);
      }
    }

    if (minU === Infinity) {
      console.warn("Could not find mesh UVs for decal");
      return;
    }

    console.log("Decal MESH UV bounding box:", {
      minU: minU.toFixed(4),
      maxU: maxU.toFixed(4),
      minV: minV.toFixed(4),
      maxV: maxV.toFixed(4),
      centerU: ((minU + maxU) / 2).toFixed(4),
      centerV: ((minV + maxV) / 2).toFixed(4),
      decalPosition: `${decal.position[0].toFixed(
        3
      )}, ${decal.position[1].toFixed(3)}, ${decal.position[2].toFixed(3)}`,
    });

    // Convert UV bounds to canvas coordinates (flip V)
    const x = minU * canvasWidth;
    const y = (1 - maxV) * canvasHeight;
    const w = (maxU - minU) * canvasWidth;
    const h = (maxV - minV) * canvasHeight;

    console.log("Drawing decal at canvas:", {
      x: x.toFixed(1),
      y: y.toFixed(1),
      w: w.toFixed(1),
      h: h.toFixed(1),
    });

    // Draw decal image to the UV bounding box
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(decalImage, x, y, w, h);
    ctx.restore();
  }

  /**
   * Find mesh UV at a given 3D position using closest point on triangle surface
   * This is more accurate than using triangle center
   */
  private findMeshUVAtPosition(
    meshGeo: THREE.BufferGeometry,
    position: THREE.Vector3
  ): THREE.Vector2 | null {
    const posAttr = meshGeo.attributes.position;
    const uvAttr = meshGeo.attributes.uv;
    const indexAttr = meshGeo.index;

    if (!posAttr || !uvAttr) return null;

    let closestDist = Infinity;
    let closestUV: THREE.Vector2 | null = null;

    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const closestPoint = new THREE.Vector3();
    const triangle = new THREE.Triangle();

    const triCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

    for (let i = 0; i < triCount; i++) {
      let i0: number, i1: number, i2: number;
      if (indexAttr) {
        i0 = indexAttr.getX(i * 3);
        i1 = indexAttr.getX(i * 3 + 1);
        i2 = indexAttr.getX(i * 3 + 2);
      } else {
        i0 = i * 3;
        i1 = i * 3 + 1;
        i2 = i * 3 + 2;
      }

      v0.fromBufferAttribute(posAttr, i0);
      v1.fromBufferAttribute(posAttr, i1);
      v2.fromBufferAttribute(posAttr, i2);

      // Find closest point on triangle to our position
      triangle.set(v0, v1, v2);
      triangle.closestPointToPoint(position, closestPoint);
      const dist = position.distanceTo(closestPoint);

      if (dist < closestDist) {
        closestDist = dist;
        // Get barycentric coords of the closest point
        const bary = this.getBarycentricCoords(closestPoint, v0, v1, v2);
        const uv0 = new THREE.Vector2().fromBufferAttribute(
          uvAttr as THREE.BufferAttribute,
          i0
        );
        const uv1 = new THREE.Vector2().fromBufferAttribute(
          uvAttr as THREE.BufferAttribute,
          i1
        );
        const uv2 = new THREE.Vector2().fromBufferAttribute(
          uvAttr as THREE.BufferAttribute,
          i2
        );
        closestUV = new THREE.Vector2(
          uv0.x * bary.x + uv1.x * bary.y + uv2.x * bary.z,
          uv0.y * bary.x + uv1.y * bary.y + uv2.y * bary.z
        );
      }
    }

    return closestUV;
  }

  /**
   * Bake decals onto a base texture canvas
   * Returns a new canvas with decals composited
   */
  bakeDecalsToCanvas(
    baseCanvas: HTMLCanvasElement,
    mesh: THREE.Mesh,
    decals: DecalInstance[],
    options?: DecalBakeOptions
  ): HTMLCanvasElement {
    const opts = {
      padding: 2,
      blendMode: "normal" as const,
      ...options,
    };

    // Create output canvas
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = baseCanvas.width;
    outputCanvas.height = baseCanvas.height;
    const ctx = outputCanvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    // Draw base texture
    ctx.drawImage(baseCanvas, 0, 0);

    // Process each decal
    for (const decal of decals) {
      if (!decal.texture?.image) continue;

      // Project decal 3D position to UV space
      const uvProjection = this.projectToUV(
        mesh,
        decal.position,
        decal.rotation
      );

      if (!uvProjection.valid) {
        console.warn(`Decal ${decal.id} projection invalid, skipping`);
        continue;
      }

      // Calculate UV-space position and size
      const uvX = uvProjection.u * outputCanvas.width;
      const uvY = (1 - uvProjection.v) * outputCanvas.height; // Flip V for canvas coords

      // Calculate decal size in UV space (based on scale and mesh size)
      const decalSizeU = this.calculateDecalSizeInUV(mesh, decal.scale[0]);
      const decalSizeV = this.calculateDecalSizeInUV(mesh, decal.scale[1]);

      const decalWidth = decalSizeU * outputCanvas.width;
      const decalHeight = decalSizeV * outputCanvas.height;

      // Save context state
      ctx.save();

      // Apply opacity
      ctx.globalAlpha = decal.opacity;

      // Apply blend mode
      ctx.globalCompositeOperation = this.getCompositeOperation(opts.blendMode);

      // Translate to decal center, rotate, then draw
      ctx.translate(uvX, uvY);
      ctx.rotate(decal.rotation[2]); // Use Z rotation for 2D rotation on UV plane

      // Draw decal image centered
      ctx.drawImage(
        decal.texture.image as HTMLImageElement | HTMLCanvasElement,
        -decalWidth / 2 + opts.padding,
        -decalHeight / 2 + opts.padding,
        decalWidth - opts.padding * 2,
        decalHeight - opts.padding * 2
      );

      // Restore context state
      ctx.restore();
    }

    return outputCanvas;
  }

  /**
   * Project a 3D world position to UV coordinates on a mesh
   * Uses raycasting to find the closest point on mesh surface
   * NOTE: position is expected to be in model's local space (already converted from world space)
   */
  projectToUV(
    mesh: THREE.Mesh,
    position: [number, number, number],
    _rotation: [number, number, number]
  ): UVProjection {
    const geometry = mesh.geometry as THREE.BufferGeometry;

    if (!geometry.attributes.uv || !geometry.attributes.position) {
      console.warn("projectToUV: missing uv or position attributes");
      return { u: 0, v: 0, valid: false };
    }

    // Position is in model's local space (converted from world space in handleDecalClick)
    // The mesh geometry is also in the mesh's local space
    // For simple models, these are the same. For complex models with internal hierarchy,
    // we may need to account for internal transforms.

    const inputPos = new THREE.Vector3(...position);

    // Compute geometry bounding box for reference
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;

    console.log(
      `projectToUV debug: pos=[${position
        .map((v) => v.toFixed(3))
        .join(", ")}] ` +
        `bbox=[${bbox ? bbox.min.x.toFixed(3) : "?"}, ${
          bbox ? bbox.min.y.toFixed(3) : "?"
        }, ${bbox ? bbox.min.z.toFixed(3) : "?"}] to ` +
        `[${bbox ? bbox.max.x.toFixed(3) : "?"}, ${
          bbox ? bbox.max.y.toFixed(3) : "?"
        }, ${bbox ? bbox.max.z.toFixed(3) : "?"}]`
    );

    // Use position directly - it's already in model local space
    // which should match the mesh geometry space for most GLTF models
    const localPos = inputPos.clone();

    // Use closest triangle method (more reliable than raycast for decal positions)
    // because decal position IS on the surface, we need to find which triangle it's on
    const result = this.findClosestTriangleUV(geometry, localPos);

    console.log(
      `projectToUV result: u=${result.u.toFixed(4)}, v=${result.v.toFixed(
        4
      )}, valid=${result.valid}`
    );

    return result;
  }

  /**
   * Find the closest triangle to a point and return interpolated UV
   */
  private findClosestTriangleUV(
    geometry: THREE.BufferGeometry,
    point: THREE.Vector3
  ): UVProjection {
    const posAttr = geometry.attributes.position;
    const uvAttr = geometry.attributes.uv;

    if (!posAttr || !uvAttr) {
      return { u: 0, v: 0, valid: false };
    }

    let closestDist = Infinity;
    let closestU = 0;
    let closestV = 0;
    let found = false;

    const triCount = posAttr.count / 3;
    const v0 = new THREE.Vector3();
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const triangleCenter = new THREE.Vector3();

    for (let i = 0; i < triCount; i++) {
      const idx0 = i * 3;
      const idx1 = i * 3 + 1;
      const idx2 = i * 3 + 2;

      v0.fromBufferAttribute(posAttr, idx0);
      v1.fromBufferAttribute(posAttr, idx1);
      v2.fromBufferAttribute(posAttr, idx2);

      // Calculate triangle center
      triangleCenter.copy(v0).add(v1).add(v2).divideScalar(3);

      const dist = point.distanceTo(triangleCenter);

      if (dist < closestDist) {
        closestDist = dist;
        found = true;

        // Get barycentric coordinates
        const bary = this.getBarycentricCoords(point, v0, v1, v2);

        // Interpolate UV
        const uv0 = new THREE.Vector2().fromBufferAttribute(
          uvAttr as THREE.BufferAttribute,
          idx0
        );
        const uv1 = new THREE.Vector2().fromBufferAttribute(
          uvAttr as THREE.BufferAttribute,
          idx1
        );
        const uv2 = new THREE.Vector2().fromBufferAttribute(
          uvAttr as THREE.BufferAttribute,
          idx2
        );

        closestU = uv0.x * bary.x + uv1.x * bary.y + uv2.x * bary.z;
        closestV = uv0.y * bary.x + uv1.y * bary.y + uv2.y * bary.z;
      }
    }

    return {
      u: Math.max(0, Math.min(1, closestU)),
      v: Math.max(0, Math.min(1, closestV)),
      valid: found,
    };
  }

  /**
   * Calculate barycentric coordinates for a point relative to a triangle
   */
  private getBarycentricCoords(
    point: THREE.Vector3,
    v0: THREE.Vector3,
    v1: THREE.Vector3,
    v2: THREE.Vector3
  ): THREE.Vector3 {
    const edge0 = v1.clone().sub(v0);
    const edge1 = v2.clone().sub(v0);
    const v0ToPoint = point.clone().sub(v0);

    const dot00 = edge0.dot(edge0);
    const dot01 = edge0.dot(edge1);
    const dot02 = edge0.dot(v0ToPoint);
    const dot11 = edge1.dot(edge1);
    const dot12 = edge1.dot(v0ToPoint);

    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
    const w = 1 - u - v;

    // Clamp values to valid range
    const clampedU = Math.max(0, Math.min(1, u));
    const clampedV = Math.max(0, Math.min(1, v));
    const clampedW = Math.max(0, Math.min(1, w));

    // Normalize
    const sum = clampedU + clampedV + clampedW;
    return new THREE.Vector3(clampedW / sum, clampedU / sum, clampedV / sum);
  }

  /**
   * Calculate decal size in UV space based on mesh bounds
   */
  private calculateDecalSizeInUV(mesh: THREE.Mesh, worldScale: number): number {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    geometry.computeBoundingBox();

    if (!geometry.boundingBox) {
      return worldScale * 0.1; // Default fallback
    }

    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z);

    // Decal size relative to mesh size, mapped to 0-1 UV range
    return (worldScale / maxDimension) * 0.5;
  }

  /**
   * Get canvas composite operation from blend mode
   */
  private getCompositeOperation(
    blendMode: "normal" | "multiply" | "overlay"
  ): GlobalCompositeOperation {
    switch (blendMode) {
      case "multiply":
        return "multiply";
      case "overlay":
        return "overlay";
      default:
        return "source-over";
    }
  }

  /**
   * Bake decals into a texture atlas
   * Used during merge operation to combine decals with base textures
   */
  bakeDecalsToTexture(
    baseTexture: THREE.Texture,
    mesh: THREE.Mesh,
    decals: DecalInstance[],
    options?: DecalBakeOptions
  ): THREE.Texture {
    // Convert base texture to canvas
    const baseCanvas = textureToCanvas(baseTexture);

    // Bake decals
    const resultCanvas = this.bakeDecalsToCanvas(
      baseCanvas,
      mesh,
      decals,
      options
    );

    // Convert back to texture
    const resultTexture = canvasToTexture(resultCanvas);
    resultTexture.colorSpace = THREE.SRGBColorSpace;

    return resultTexture;
  }

  /**
   * Bake decals onto atlas texture using original model meshes
   * This handles the UV remapping from original mesh UV to atlas UV
   */
  bakeDecalsToAtlas(
    atlasCanvas: HTMLCanvasElement,
    modelBakeInfos: ModelBakeInfo[],
    decals: DecalInstance[],
    options?: DecalBakeOptions
  ): HTMLCanvasElement {
    const opts = {
      padding: 2,
      blendMode: "normal" as const,
      ...options,
    };

    // Create output canvas
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = atlasCanvas.width;
    outputCanvas.height = atlasCanvas.height;
    const ctx = outputCanvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    // Draw base atlas
    ctx.drawImage(atlasCanvas, 0, 0);

    // Group decals by target model
    const decalsByModel = new Map<string, DecalInstance[]>();
    for (const decal of decals) {
      const existing = decalsByModel.get(decal.targetModelId) || [];
      existing.push(decal);
      decalsByModel.set(decal.targetModelId, existing);
    }

    console.log("Baking decals to atlas:", {
      totalDecals: decals.length,
      modelCount: decalsByModel.size,
    });

    // Process each model's decals
    for (const [modelId, modelDecals] of decalsByModel) {
      // Find the model bake info
      const bakeInfo = modelBakeInfos.find((info) => info.id === modelId);
      if (!bakeInfo) {
        console.warn(
          `No bake info found for model ${modelId}, skipping decals`
        );
        continue;
      }

      const { mesh, atlasRegion } = bakeInfo;
      const { x: regionX, y: regionY, w: regionW, h: regionH } = atlasRegion;

      console.log(
        `Processing ${modelDecals.length} decals for model ${modelId}`,
        {
          atlasRegion: { x: regionX, y: regionY, w: regionW, h: regionH },
        }
      );

      // Process each decal for this model
      for (const decal of modelDecals) {
        if (!decal.texture?.image) continue;

        // Project decal position to UV on original mesh
        const uvProjection = this.projectToUV(
          mesh,
          decal.position,
          decal.rotation
        );

        if (!uvProjection.valid) {
          console.warn(`Decal ${decal.id} projection invalid, skipping`);
          continue;
        }

        // Transform UV from [0,1] to atlas region
        // UV (0,0) in original mesh -> (regionX, regionY) in atlas
        // UV (1,1) in original mesh -> (regionX + regionW, regionY + regionH) in atlas
        const atlasX = regionX + uvProjection.u * regionW;
        const atlasY = regionY + (1 - uvProjection.v) * regionH; // Flip V for canvas

        // Calculate decal size in atlas space
        // decal.scale is already in local space (divided by modelScale in useDecals)
        // calculateDecalSizeInUV also works in local space (uses mesh geometry dimensions)
        // So we DON'T need to multiply by modelScale - that would double-count!
        const decalSizeU = this.calculateDecalSizeInUV(mesh, decal.scale[0]);
        const decalSizeV = this.calculateDecalSizeInUV(mesh, decal.scale[1]);
        const decalWidth = decalSizeU * regionW;
        const decalHeight = decalSizeV * regionH;

        console.log(`Decal ${decal.id}:`, {
          decalScale: decal.scale,
          decalSizeUV: { u: decalSizeU.toFixed(4), v: decalSizeV.toFixed(4) },
          originalUV: {
            u: uvProjection.u.toFixed(3),
            v: uvProjection.v.toFixed(3),
          },
          atlasPos: { x: atlasX.toFixed(1), y: atlasY.toFixed(1) },
          size: { w: decalWidth.toFixed(1), h: decalHeight.toFixed(1) },
        });

        // Draw decal
        ctx.save();
        ctx.globalAlpha = decal.opacity;
        ctx.globalCompositeOperation = this.getCompositeOperation(
          opts.blendMode
        );

        ctx.translate(atlasX, atlasY);
        ctx.rotate(decal.rotation[2]);

        ctx.drawImage(
          decal.texture.image as HTMLImageElement | HTMLCanvasElement,
          -decalWidth / 2 + opts.padding,
          -decalHeight / 2 + opts.padding,
          decalWidth - opts.padding * 2,
          decalHeight - opts.padding * 2
        );

        ctx.restore();
      }
    }

    return outputCanvas;
  }

  /**
   * Create a preview of decal UV projection (for debugging)
   */
  createUVPreview(
    mesh: THREE.Mesh,
    decals: DecalInstance[],
    size: number = 512
  ): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    // Draw UV grid background
    ctx.fillStyle = "#333333";
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = "#666666";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const pos = (i / 10) * size;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    // Draw decal positions
    for (const decal of decals) {
      const projection = this.projectToUV(mesh, decal.position, decal.rotation);

      if (!projection.valid) continue;

      const x = projection.u * size;
      const y = (1 - projection.v) * size;

      // Draw decal marker
      ctx.fillStyle = "#ff6600";
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText(decal.id.slice(0, 6), x + 15, y + 5);
    }

    return canvas;
  }
}
