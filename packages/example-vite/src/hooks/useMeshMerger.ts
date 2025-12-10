import { useState, useCallback, useRef, useEffect } from 'react'
import { MeshMerger, Transform, MergeOptions } from '@poppod/three-mesh-merger'

export interface LoadedModel {
  id: string
  name: string
  transform: Required<Transform>
}

export function useMeshMerger() {
  const mergerRef = useRef<MeshMerger>(new MeshMerger())
  const [models, setModels] = useState<LoadedModel[]>([])
  const [isMerged, setIsMerged] = useState(false)
  const [progress, setProgress] = useState<{ stage: string; value: number }>({
    stage: '',
    value: 0
  })

  // Setup progress callback
  useEffect(() => {
    mergerRef.current.setProgressCallback((stage, value) => {
      setProgress({ stage, value })
    })
  }, [])

  const addModel = useCallback(async (file: File, transform?: Transform) => {
    console.log('Adding model:', file.name)
    const id = await mergerRef.current.addModel(file, transform)

    const modelData = mergerRef.current.getModel(id)
    if (!modelData) {
      console.error('Failed to get model data for:', id)
      return id
    }

    setModels((prev) => [
      ...prev,
      {
        id,
        name: file.name,
        transform: modelData.transform
      }
    ])

    setIsMerged(false)
    console.log('Model added:', id)
    return id
  }, [])

  const updateTransform = useCallback((id: string, transform: Partial<Transform>) => {
    mergerRef.current.updateTransform(id, transform)

    setModels((prev) =>
      prev.map((model) =>
        model.id === id
          ? { ...model, transform: mergerRef.current.getModel(id)!.transform }
          : model
      )
    )
  }, [])

  const removeModel = useCallback((id: string) => {
    mergerRef.current.removeModel(id)
    setModels((prev) => prev.filter((m) => m.id !== id))
    setIsMerged(false)
  }, [])

  const merge = useCallback(async (options?: MergeOptions) => {
    console.log('Starting merge with options:', options)
    await mergerRef.current.merge(options)
    setIsMerged(true)
    console.log('Merge complete')
  }, [])

  const exportGLB = useCallback(async () => {
    const blob = await mergerRef.current.export()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'merged-model.glb'
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  const clear = useCallback(() => {
    mergerRef.current.clear()
    setModels([])
    setIsMerged(false)
  }, [])

  return {
    merger: mergerRef.current,
    models,
    isMerged,
    progress,
    addModel,
    updateTransform,
    removeModel,
    merge,
    exportGLB,
    clear
  }
}
