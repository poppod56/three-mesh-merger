import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { ModelLoader } from "./ModelLoader";
import { GeometryMerger } from "./GeometryMerger";
import { MaterialAtlas } from "./MaterialAtlas";
import { DecalManager } from "./DecalManager";
import { DecalBaker } from "./DecalBaker";
import type {
  Transform,
  ModelInstance,
  MergeOptions,
  ProgressCallback,
  AtlasMode,
  MaterialOverrides,
  DecalInstance,
  DecalOptions,
} from "./types";
import { generateId, mergeTransform } from "./utils/mathUtils";

/**
 * Main class for merging multiple 3D models
 */
export class MeshMerger {
  private models: Map<string, ModelInstance> = new Map();
  private modelLoader: ModelLoader;
  private geometryMerger: GeometryMerger;
  private materialAtlas: MaterialAtlas;
  private decalManager: DecalManager;
  private decalBaker: DecalBaker;
  private onProgress?: ProgressCallback;
  private mergedScene?: THREE.Scene;
  private mergedMesh?: THREE.Mesh;

  constructor() {
    this.modelLoader = new ModelLoader();
    this.geometryMerger = new GeometryMerger();
    this.materialAtlas = new MaterialAtlas();
    this.decalManager = new DecalManager();
    this.decalBaker = new DecalBaker();
  }

  /**
   * Add a model from URL or Blob
   */
  async addModel(
    source: string | Blob,
    transform?: Transform
  ): Promise<string> {
    this.reportProgress("Loading model", 0);

    const scene =
      typeof source === "string"
        ? await this.modelLoader.load(source)
        : await this.modelLoader.loadFromBlob(source);

    const id = generateId();
    const url = typeof source === "string" ? source : "blob";

    this.models.set(id, {
      id,
      url,
      scene,
      transform: mergeTransform(transform),
    });

    this.reportProgress("Model loaded", 1);

    return id;
  }

  /**
   * Update transform for a model
   */
  updateTransform(id: string, transform: Partial<Transform>): void {
    const model = this.models.get(id);
    if (!model) {
      throw new Error(`Model with id ${id} not found`);
    }

    model.transform = mergeTransform({
      ...model.transform,
      ...transform,
    });
  }

  /**
   * Remove a model
   */
  removeModel(id: string): void {
    if (!this.models.has(id)) {
      throw new Error(`Model with id ${id} not found`);
    }

    this.models.delete(id);
  }

  /**
   * Get all models
   */
  getModels(): ModelInstance[] {
    return Array.from(this.models.values());
  }

  /**
   * Get a specific model by ID
   */
  getModel(id: string): ModelInstance | undefined {
    return this.models.get(id);
  }

  // ==================== DECAL METHODS ====================

  /**
   * Add a decal to a model from texture URL
   */
  async addDecal(
    targetModelId: string,
    textureUrl: string,
    options?: DecalOptions
  ): Promise<string> {
    if (!this.models.has(targetModelId)) {
      throw new Error(`Model with id ${targetModelId} not found`);
    }
    return this.decalManager.addDecal(targetModelId, textureUrl, options);
  }

  /**
   * Add a decal from existing THREE.Texture
   */
  addDecalFromTexture(
    targetModelId: string,
    texture: THREE.Texture,
    options?: DecalOptions
  ): string {
    if (!this.models.has(targetModelId)) {
      throw new Error(`Model with id ${targetModelId} not found`);
    }
    return this.decalManager.addDecalFromTexture(
      targetModelId,
      texture,
      options
    );
  }

  /**
   * Update decal transform
   */
  updateDecalTransform(id: string, transform: Partial<Transform>): void {
    this.decalManager.updateDecalTransform(id, transform);
  }

  /**
   * Update decal opacity
   */
  updateDecalOpacity(id: string, opacity: number): void {
    this.decalManager.updateDecalOpacity(id, opacity);
  }

  /**
   * Remove a decal
   */
  removeDecal(id: string): void {
    this.decalManager.removeDecal(id);
  }

  /**
   * Get all decals
   */
  getDecals(): DecalInstance[] {
    return this.decalManager.getDecals();
  }

  /**
   * Get decals for a specific model
   */
  getDecalsForModel(modelId: string): DecalInstance[] {
    return this.decalManager.getDecalsForModel(modelId);
  }

  /**
   * Get a specific decal by ID
   */
  getDecal(id: string): DecalInstance | undefined {
    return this.decalManager.getDecal(id);
  }

  /**
   * Get the DecalManager instance (for advanced usage)
   */
  getDecalManager(): DecalManager {
    return this.decalManager;
  }

  /**
   * Get the DecalBaker instance (for advanced usage)
   */
  getDecalBaker(): DecalBaker {
    return this.decalBaker;
  }

  // ==================== MERGE METHODS ====================

  /**
   * Collect mesh and material info from a model for decal baking
   * Apply internal mesh transforms (from mesh to scene root) to match preview behavior
   */
  private collectModelMeshInfo(model: ModelInstance): {
    mesh: THREE.Mesh | null;
    material: THREE.Material | null;
  } {
    const scene = model.scene;

    // Update matrices
    scene.updateWorldMatrix(true, true);

    // Find first mesh
    let firstMesh: THREE.Mesh | null = null;
    let firstMaterial: THREE.Material | null = null;

    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry && !firstMesh) {
        firstMesh = object;
        firstMaterial = object.material as THREE.Material;
      }
    });

    if (!firstMesh) {
      return { mesh: null, material: null };
    }

    const mesh = firstMesh as THREE.Mesh;

    // Clone geometry
    let geo = mesh.geometry.clone();

    // Convert indexed to non-indexed
    if (geo.index !== null) {
      geo = geo.toNonIndexed();
    }

    // Ensure normals exist
    if (!geo.attributes.normal) {
      geo.computeVertexNormals();
    }

    // Apply internal transforms: from mesh local space to scene root space
    // This matches what createMergedMeshFromGroup does in preview
    // relativeMatrix = mesh.matrixWorld * sceneWorldMatrixInverse
    // Since scene is root, scene.matrixWorld should be identity (or whatever GLTF set it to)
    // So this effectively applies mesh.localMatrix and parent transforms within the model
    const sceneWorldMatrixInverse = scene.matrixWorld.clone().invert();
    const relativeMatrix = mesh.matrixWorld
      .clone()
      .premultiply(sceneWorldMatrixInverse);

    console.log("collectModelMeshInfo internal transforms:", {
      meshName: mesh.name,
      hasInternalTransform: !relativeMatrix.equals(
        new THREE.Matrix4().identity()
      ),
      relativeScale: new THREE.Vector3()
        .setFromMatrixScale(relativeMatrix)
        .toArray()
        .map((v) => v.toFixed(4)),
    });

    geo.applyMatrix4(relativeMatrix);

    // Debug: log bbox after transform
    geo.computeBoundingBox();
    const bbox = geo.boundingBox;
    console.log("collectModelMeshInfo result:", {
      bbox: bbox
        ? {
            min: `${bbox.min.x.toFixed(4)}, ${bbox.min.y.toFixed(
              4
            )}, ${bbox.min.z.toFixed(4)}`,
            max: `${bbox.max.x.toFixed(4)}, ${bbox.max.y.toFixed(
              4
            )}, ${bbox.max.z.toFixed(4)}`,
          }
        : null,
    });

    // Create mesh with transformed geometry
    const resultMesh = new THREE.Mesh(geo, firstMaterial!);

    return { mesh: resultMesh, material: firstMaterial };
  }

  /**
   * Merge all models
   */
  async merge(options?: MergeOptions): Promise<void> {
    if (this.models.size === 0) {
      throw new Error("No models to merge");
    }

    const mergeOptions = this.getMergeOptions(options);

    this.reportProgress("Starting merge", 0);

    // Get scenes and transforms
    const modelList = Array.from(this.models.values());
    const scenes = modelList.map((m) => m.scene);
    const transforms = modelList.map((m) => m.transform);

    // Collect model-to-material info before merge (for decal baking)
    const modelMaterialMap = new Map<
      string,
      { mesh: THREE.Mesh; material: THREE.Material }
    >();
    modelList.forEach((model) => {
      const info = this.collectModelMeshInfo(model);
      if (info.mesh && info.material) {
        modelMaterialMap.set(model.id, {
          mesh: info.mesh,
          material: info.material,
        });
      }
    });

    // ===== BAKE DECALS TO MODEL TEXTURES BEFORE ATLAS =====
    this.reportProgress("Baking decals to model textures", 0.15);
    const allDecals = this.decalManager.getDecals();

    console.log("🔥🔥🔥 MERGE CALLED - allDecals count:", allDecals.length);

    if (allDecals.length > 0) {
      console.log("🎯🎯🎯 BAKING START:", allDecals.length, "decals");

      // Group decals by target model
      const decalsByModel = new Map<string, typeof allDecals>();
      for (const decal of allDecals) {
        const existing = decalsByModel.get(decal.targetModelId) || [];
        existing.push(decal);
        decalsByModel.set(decal.targetModelId, existing);
      }

      // Bake decals onto each model's texture
      for (const [modelId, modelDecals] of decalsByModel) {
        const meshInfo = modelMaterialMap.get(modelId);
        if (!meshInfo) {
          console.warn(`No mesh info for model ${modelId}, skipping decals`);
          continue;
        }

        const material = meshInfo.material as THREE.MeshStandardMaterial;
        if (!material.map) {
          console.warn(`Model ${modelId} has no texture, skipping decals`);
          continue;
        }

        console.log(
          `Baking ${modelDecals.length} decals onto model ${modelId}`
        );

        // Bake decals using canvas with UV-based positioning
        const bakedTexture = this.decalBaker.bakeDecalsToModelTexture(
          meshInfo.mesh,
          material,
          modelDecals,
          { targetTextureSize: options?.atlasSize || 2048 }
        );

        if (bakedTexture) {
          // Update the material's texture with the baked version
          const oldTexture = material.map;
          material.map = bakedTexture;
          material.needsUpdate = true;
          console.log(`Decals baked to model ${modelId} texture`, {
            oldTextureUUID: oldTexture?.uuid,
            newTextureUUID: bakedTexture.uuid,
            textureChanged: oldTexture?.uuid !== bakedTexture.uuid,
          });
        }
      }
    }

    // Merge geometries
    this.reportProgress("Merging geometries", 0.3);
    const { geometry, materials, materialMapping } = this.geometryMerger.merge(
      scenes,
      transforms
    );

    // Generate texture atlas (now with decals already baked into model textures)
    this.reportProgress("Generating texture atlas", 0.5);
    const atlasResult = await this.materialAtlas.generate(
      materials,
      materialMapping,
      geometry,
      {
        atlasSize: mergeOptions.atlasSize,
        quality: mergeOptions.textureQuality,
        atlasMode: mergeOptions.atlasMode as Required<AtlasMode>,
        materialOverrides: mergeOptions.materialOverrides,
      }
    );

    // Create merged mesh
    this.reportProgress("Creating merged mesh", 0.8);

    // Debug: Check if geometry has data
    console.log("Merged geometry info:", {
      vertexCount: geometry.attributes.position?.count || 0,
      hasUV: !!geometry.attributes.uv,
      hasNormal: !!geometry.attributes.normal,
      materialCount: materials.length,
    });

    this.mergedMesh = new THREE.Mesh(geometry, atlasResult.material);
    this.mergedMesh.name = "MergedMesh";

    // Create merged scene
    this.mergedScene = new THREE.Scene();
    this.mergedScene.add(this.mergedMesh);

    this.reportProgress("Merge complete", 1);
  }

  /**
   * Export merged result as GLB
   */
  async export(): Promise<Blob> {
    if (!this.mergedScene) {
      throw new Error("No merged model to export. Call merge() first.");
    }

    // Debug: Check merged mesh before export
    console.log("Export - Merged mesh info:", {
      hasMesh: !!this.mergedMesh,
      geometry: this.mergedMesh?.geometry,
      vertexCount: this.mergedMesh?.geometry?.attributes?.position?.count || 0,
      material: this.mergedMesh?.material,
    });

    // Debug: Check scene children
    console.log("Export - Scene children:", this.mergedScene.children.length);
    this.mergedScene.traverse((obj) => {
      console.log("  - Object:", obj.type, obj.name);
    });

    this.reportProgress("Exporting GLB", 0);

    return new Promise((resolve, reject) => {
      const exporter = new GLTFExporter();

      // Export the mesh directly instead of the scene
      const objectToExport = this.mergedMesh || this.mergedScene!;

      exporter.parse(
        objectToExport,
        (result) => {
          console.log(
            "Export result size:",
            (result as ArrayBuffer).byteLength
          );
          const blob = new Blob([result as ArrayBuffer], {
            type: "model/gltf-binary",
          });
          this.reportProgress("Export complete", 1);
          resolve(blob);
        },
        (error) => {
          console.error("Export error:", error);
          reject(new Error(`Export failed: ${error}`));
        },
        { binary: true }
      );
    });
  }

  /**
   * Get the merged scene (for preview)
   */
  getMergedScene(): THREE.Scene | undefined {
    return this.mergedScene;
  }

  /**
   * Get the merged mesh (for preview)
   */
  getMergedMesh(): THREE.Mesh | undefined {
    return this.mergedMesh;
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback;
  }

  /**
   * Clear all models and merged result
   */
  clear(): void {
    this.models.clear();
    this.decalManager.clear();
    this.mergedScene = undefined;
    this.mergedMesh = undefined;
  }

  /**
   * Get merge options with defaults
   */
  private getMergeOptions(options?: MergeOptions): Required<
    Omit<MergeOptions, "materialOverrides">
  > & {
    materialOverrides?: MaterialOverrides;
  } {
    const defaultAtlasMode: Required<AtlasMode> = {
      albedo: true,
      normal: false,
      roughness: false,
      metalness: false,
      emissive: false,
      aoMap: false,
    };

    return {
      atlasSize: options?.atlasSize ?? 2048,
      textureQuality: options?.textureQuality ?? 0.9,
      generateMipmaps: options?.generateMipmaps ?? true,
      atlasMode: {
        ...defaultAtlasMode,
        ...options?.atlasMode,
      } as Required<AtlasMode>,
      materialOverrides: options?.materialOverrides,
    };
  }

  /**
   * Report progress
   */
  private reportProgress(stage: string, progress: number): void {
    if (this.onProgress) {
      this.onProgress(stage, progress);
    }
  }
}
