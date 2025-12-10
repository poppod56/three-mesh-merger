import { useCallback } from 'react'

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

export function FileUpload({ onFilesSelected, disabled }: FileUploadProps) {
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        onFilesSelected(files.filter((f) => f.name.endsWith('.glb')))
      }
    },
    [onFilesSelected]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer.files)
      onFilesSelected(files.filter((f) => f.name.endsWith('.glb')))
    },
    [onFilesSelected]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <div className="file-upload">
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <label htmlFor="file-input" className="file-label">
          <div className="upload-icon">📁</div>
          <div className="upload-text">
            Drop GLB files here or click to browse
          </div>
          <input
            id="file-input"
            type="file"
            accept=".glb"
            multiple
            onChange={handleFileChange}
            disabled={disabled}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>
  )
}
