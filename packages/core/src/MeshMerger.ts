import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { ModelLoader } from './ModelLoader'
import { GeometryMerger } from './GeometryMerger'
import { MaterialAtlas } from './MaterialAtlas'
import type {
  Transform,
  ModelInstance,
  MergeOptions,
  ProgressCallback,
  AtlasMode,
  MaterialOverrides
} from './types'
import { generateId, mergeTransform } from './utils/mathUtils'

/**
 * Main class for merging multiple 3D models
 */
export class MeshMerger {
  private models: Map<string, ModelInstance> = new Map()
  private modelLoader: ModelLoader
  private geometryMerger: GeometryMerger
  private materialAtlas: MaterialAtlas
  private onProgress?: ProgressCallback
  private mergedScene?: THREE.Scene
  private mergedMesh?: THREE.Mesh

  constructor() {
    this.modelLoader = new ModelLoader()
    this.geometryMerger = new GeometryMerger()
    this.materialAtlas = new MaterialAtlas()
  }

  /**
   * Add a model from URL or Blob
   */
  async addModel(
    source: string | Blob,
    transform?: Transform
  ): Promise<string> {
    this.reportProgress('Loading model', 0)

    const scene =
      typeof source === 'string'
        ? await this.modelLoader.load(source)
        : await this.modelLoader.loadFromBlob(source)

    const id = generateId()
    const url = typeof source === 'string' ? source : 'blob'

    this.models.set(id, {
      id,
      url,
      scene,
      transform: mergeTransform(transform)
    })

    this.reportProgress('Model loaded', 1)

    return id
  }

  /**
   * Update transform for a model
   */
  updateTransform(id: string, transform: Partial<Transform>): void {
    const model = this.models.get(id)
    if (!model) {
      throw new Error(`Model with id ${id} not found`)
    }

    model.transform = mergeTransform({
      ...model.transform,
      ...transform
    })
  }

  /**
   * Remove a model
   */
  removeModel(id: string): void {
    if (!this.models.has(id)) {
      throw new Error(`Model with id ${id} not found`)
    }

    this.models.delete(id)
  }

  /**
   * Get all models
   */
  getModels(): ModelInstance[] {
    return Array.from(this.models.values())
  }

  /**
   * Get a specific model by ID
   */
  getModel(id: string): ModelInstance | undefined {
    return this.models.get(id)
  }

  /**
   * Merge all models
   */
  async merge(options?: MergeOptions): Promise<void> {
    if (this.models.size === 0) {
      throw new Error('No models to merge')
    }

    const mergeOptions = this.getMergeOptions(options)

    this.reportProgress('Starting merge', 0)

    // Get scenes and transforms
    const modelList = Array.from(this.models.values())
    const scenes = modelList.map((m) => m.scene)
    const transforms = modelList.map((m) => m.transform)

    // Merge geometries
    this.reportProgress('Merging geometries', 0.2)
    const { geometry, materialMapping } = this.geometryMerger.merge(
      scenes,
      transforms
    )

    // Get all unique materials
    const materials = this.geometryMerger.getMaterials(scenes)

    // Generate texture atlas
    this.reportProgress('Generating texture atlas', 0.5)
    const atlasResult = await this.materialAtlas.generate(
      materials,
      materialMapping,
      geometry,
      {
        atlasSize: mergeOptions.atlasSize,
        quality: mergeOptions.textureQuality,
        atlasMode: mergeOptions.atlasMode as Required<AtlasMode>,
        materialOverrides: mergeOptions.materialOverrides
      }
    )

    // Create merged mesh
    this.reportProgress('Creating merged mesh', 0.8)
    this.mergedMesh = new THREE.Mesh(geometry, atlasResult.material)
    this.mergedMesh.name = 'MergedMesh'

    // Create merged scene
    this.mergedScene = new THREE.Scene()
    this.mergedScene.add(this.mergedMesh)

    this.reportProgress('Merge complete', 1)
  }

  /**
   * Export merged result as GLB
   */
  async export(): Promise<Blob> {
    if (!this.mergedScene) {
      throw new Error('No merged model to export. Call merge() first.')
    }

    this.reportProgress('Exporting GLB', 0)

    return new Promise((resolve, reject) => {
      const exporter = new GLTFExporter()

      exporter.parse(
        this.mergedScene!,
        (result) => {
          const blob = new Blob([result as ArrayBuffer], {
            type: 'model/gltf-binary'
          })
          this.reportProgress('Export complete', 1)
          resolve(blob)
        },
        (error) => {
          reject(new Error(`Export failed: ${error}`))
        },
        { binary: true }
      )
    })
  }

  /**
   * Get the merged scene (for preview)
   */
  getMergedScene(): THREE.Scene | undefined {
    return this.mergedScene
  }

  /**
   * Get the merged mesh (for preview)
   */
  getMergedMesh(): THREE.Mesh | undefined {
    return this.mergedMesh
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.onProgress = callback
  }

  /**
   * Clear all models and merged result
   */
  clear(): void {
    this.models.clear()
    this.mergedScene = undefined
    this.mergedMesh = undefined
  }

  /**
   * Get merge options with defaults
   */
  private getMergeOptions(options?: MergeOptions): Required<Omit<MergeOptions, 'materialOverrides'>> & { materialOverrides?: MaterialOverrides } {
    const defaultAtlasMode: Required<AtlasMode> = {
      albedo: true,
      normal: false,
      roughness: false,
      metalness: false,
      emissive: false,
      aoMap: false
    }

    return {
      atlasSize: options?.atlasSize ?? 2048,
      textureQuality: options?.textureQuality ?? 0.9,
      generateMipmaps: options?.generateMipmaps ?? true,
      atlasMode: {
        ...defaultAtlasMode,
        ...options?.atlasMode
      } as Required<AtlasMode>,
      materialOverrides: options?.materialOverrides
    }
  }

  /**
   * Report progress
   */
  private reportProgress(stage: string, progress: number): void {
    if (this.onProgress) {
      this.onProgress(stage, progress)
    }
  }
}
