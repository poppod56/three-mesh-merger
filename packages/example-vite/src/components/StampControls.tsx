import type { StampSettings } from "../hooks/useDecals";
import * as THREE from "three";

interface StampControlsProps {
  texture: THREE.Texture | null;
  decalName: string;
  settings: StampSettings;
  onSettingsChange: (settings: Partial<StampSettings>) => void;
  onCancel: () => void;
}

/**
 * Controls for adjusting decal stamp settings before placing
 */
export function StampControls({
  texture,
  decalName,
  settings,
  onSettingsChange,
  onCancel,
}: StampControlsProps) {
  if (!texture) return null;

  return (
    <div className="panel stamp-controls">
      <div className="stamp-header">
        <h3>🎯 Stamp Mode</h3>
        <button className="cancel-button" onClick={onCancel} title="Cancel">
          ✕
        </button>
      </div>

      <div className="stamp-preview">
        {texture.image && (
          <img
            src={texture.image.src || ""}
            alt={decalName}
            className="preview-image"
          />
        )}
        <span className="decal-name">{decalName || "Custom Decal"}</span>
      </div>

      <p className="stamp-hint">👆 Click on a model to stamp the decal</p>

      <div className="stamp-settings">
        {/* Scale */}
        <label className="setting-row">
          <span>Scale:</span>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={settings.scale}
            onChange={(e) =>
              onSettingsChange({ scale: parseFloat(e.target.value) })
            }
          />
          <span className="value">{settings.scale.toFixed(1)}</span>
        </label>

        {/* Rotation */}
        <label className="setting-row">
          <span>Rotation:</span>
          <input
            type="range"
            min="0"
            max="360"
            step="15"
            value={settings.rotation}
            onChange={(e) =>
              onSettingsChange({ rotation: parseFloat(e.target.value) })
            }
          />
          <span className="value">{settings.rotation}°</span>
        </label>

        {/* Opacity */}
        <label className="setting-row">
          <span>Opacity:</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={settings.opacity}
            onChange={(e) =>
              onSettingsChange({ opacity: parseFloat(e.target.value) })
            }
          />
          <span className="value">{Math.round(settings.opacity * 100)}%</span>
        </label>
      </div>

      <div className="stamp-actions">
        <button className="done-button" onClick={onCancel}>
          ✓ Done Stamping
        </button>
      </div>
    </div>
  );
}
