import type { DecalInstance } from "@poppod/three-mesh-merger";

interface DecalListProps {
  decals: DecalInstance[];
  selectedDecalId?: string;
  onSelect: (id: string | undefined) => void;
  onRemove: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  disabled?: boolean;
}

/**
 * List of placed decals with controls
 */
export function DecalList({
  decals,
  selectedDecalId,
  onSelect,
  onRemove,
  onOpacityChange,
  disabled,
}: DecalListProps) {
  if (decals.length === 0) {
    return (
      <div className="panel decal-list">
        <h3>📍 Placed Decals</h3>
        <p className="empty-message">
          No decals placed yet. Select a decal from the library and click on a
          model to place it.
        </p>
      </div>
    );
  }

  return (
    <div className="panel decal-list">
      <h3>📍 Placed Decals ({decals.length})</h3>

      <ul className="decal-items">
        {decals.map((decal) => (
          <li
            key={decal.id}
            className={`decal-item ${
              selectedDecalId === decal.id ? "selected" : ""
            }`}
            onClick={() => onSelect(decal.id)}
          >
            <div className="decal-info">
              <span className="decal-id">{decal.id.slice(0, 8)}</span>
              <span className="decal-target">
                → {decal.targetModelId.slice(0, 8)}
              </span>
            </div>

            <div className="decal-controls">
              {/* Opacity slider */}
              <label className="opacity-control">
                <span>Opacity:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={decal.opacity}
                  onChange={(e) =>
                    onOpacityChange(decal.id, parseFloat(e.target.value))
                  }
                  disabled={disabled}
                  onClick={(e) => e.stopPropagation()}
                />
                <span>{Math.round(decal.opacity * 100)}%</span>
              </label>

              {/* Remove button */}
              <button
                className="remove-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(decal.id);
                }}
                disabled={disabled}
                title="Remove decal"
              >
                🗑️
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Deselect button */}
      {selectedDecalId && (
        <button className="deselect-button" onClick={() => onSelect(undefined)}>
          Deselect
        </button>
      )}
    </div>
  );
}
