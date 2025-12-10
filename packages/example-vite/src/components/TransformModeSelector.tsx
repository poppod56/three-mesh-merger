interface TransformModeSelectorProps {
  mode: 'translate' | 'rotate' | 'scale'
  onChange: (mode: 'translate' | 'rotate' | 'scale') => void
  disabled?: boolean
}

export function TransformModeSelector({ mode, onChange, disabled }: TransformModeSelectorProps) {
  return (
    <div className="transform-mode-selector">
      <label>Transform Mode</label>
      <div className="mode-buttons">
        <button
          className={`mode-btn ${mode === 'translate' ? 'active' : ''}`}
          onClick={() => onChange('translate')}
          disabled={disabled}
          title="Move (G)"
        >
          ⬌ Move
        </button>
        <button
          className={`mode-btn ${mode === 'rotate' ? 'active' : ''}`}
          onClick={() => onChange('rotate')}
          disabled={disabled}
          title="Rotate (R)"
        >
          ↻ Rotate
        </button>
        <button
          className={`mode-btn ${mode === 'scale' ? 'active' : ''}`}
          onClick={() => onChange('scale')}
          disabled={disabled}
          title="Scale (S)"
        >
          ⇲ Scale
        </button>
      </div>
    </div>
  )
}
