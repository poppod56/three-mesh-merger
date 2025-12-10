import { useState } from 'react'
import type { MergeOptions } from '@poppod/three-mesh-merger'

interface MergePanelProps {
  onMerge: (options: MergeOptions) => void
  onExport: () => void
  onClear: () => void
  isMerged: boolean
  disabled?: boolean
  progress?: { stage: string; value: number }
}

export function MergePanel({
  onMerge,
  onExport,
  onClear,
  isMerged,
  disabled,
  progress
}: MergePanelProps) {
  const [atlasSize, setAtlasSize] = useState(2048)
  const [quality, setQuality] = useState(0.9)
  const [albedo, setAlbedo] = useState(true)
  const [normal, setNormal] = useState(false)
  const [roughness, setRoughness] = useState(false)
  const [metalness, setMetalness] = useState(false)
  const [emissive, setEmissive] = useState(false)

  const handleMerge = () => {
    onMerge({
      atlasSize,
      textureQuality: quality,
      atlasMode: {
        albedo,
        normal,
        roughness,
        metalness,
        emissive
      }
    })
  }

  return (
    <div className="merge-panel">
      <h3>Merge Settings</h3>

      <div className="control-group">
        <label>Atlas Size</label>
        <select
          value={atlasSize}
          onChange={(e) => setAtlasSize(Number(e.target.value))}
          disabled={disabled}
        >
          <option value={512}>512</option>
          <option value={1024}>1024</option>
          <option value={2048}>2048</option>
          <option value={4096}>4096</option>
        </select>
      </div>

      <div className="control-group">
        <label>Quality ({quality})</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={quality}
          onChange={(e) => setQuality(parseFloat(e.target.value))}
          disabled={disabled}
        />
      </div>

      <div className="control-group">
        <label>Texture Maps</label>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={albedo}
              onChange={(e) => setAlbedo(e.target.checked)}
              disabled={disabled}
            />
            Albedo/Color
          </label>
          <label>
            <input
              type="checkbox"
              checked={normal}
              onChange={(e) => setNormal(e.target.checked)}
              disabled={disabled}
            />
            Normal
          </label>
          <label>
            <input
              type="checkbox"
              checked={roughness}
              onChange={(e) => setRoughness(e.target.checked)}
              disabled={disabled}
            />
            Roughness
          </label>
          <label>
            <input
              type="checkbox"
              checked={metalness}
              onChange={(e) => setMetalness(e.target.checked)}
              disabled={disabled}
            />
            Metalness
          </label>
          <label>
            <input
              type="checkbox"
              checked={emissive}
              onChange={(e) => setEmissive(e.target.checked)}
              disabled={disabled}
            />
            Emissive
          </label>
        </div>
      </div>

      {progress && progress.value > 0 && progress.value < 1 && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${progress.value * 100}%` }} />
          <span className="progress-text">{progress.stage}</span>
        </div>
      )}

      <div className="button-group">
        <button
          className="btn-primary"
          onClick={handleMerge}
          disabled={disabled || isMerged}
        >
          {isMerged ? 'Merged' : 'Merge Models'}
        </button>

        {isMerged && (
          <>
            <button className="btn-success" onClick={onExport} disabled={disabled}>
              Export GLB
            </button>
            <button className="btn-secondary" onClick={onClear}>
              Clear & Start Over
            </button>
          </>
        )}
      </div>
    </div>
  )
}
