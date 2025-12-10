interface SampleModelsProps {
  onLoadSample: (url: string, name: string) => void
  disabled?: boolean
}

export function SampleModels({ onLoadSample, disabled }: SampleModelsProps) {
  const samples = [
    { name: 'Duck', url: '/models/Duck.glb' },
    { name: 'Box', url: '/models/Box.glb' },
    { name: 'Avocado', url: '/models/Avocado.glb' }
  ]

  return (
    <div className="sample-models">
      <h3>Sample Models</h3>
      <div className="sample-grid">
        {samples.map((sample) => (
          <button
            key={sample.name}
            className="sample-btn"
            onClick={() => onLoadSample(sample.url, sample.name)}
            disabled={disabled}
          >
            {sample.name}
          </button>
        ))}
      </div>
    </div>
  )
}
