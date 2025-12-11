import { useState } from "react";
import { Scene } from "./components/Scene";
import { FileUpload } from "./components/FileUpload";
import { SampleModels } from "./components/SampleModels";
import { TransformModeSelector } from "./components/TransformModeSelector";
import { ModelList } from "./components/ModelList";
import { MergePanel } from "./components/MergePanel";
import { DecalLibrary } from "./components/DecalLibrary";
import { DecalList } from "./components/DecalList";
import { StampControls } from "./components/StampControls";
import { useMeshMerger } from "./hooks/useMeshMerger";
import { useDecals } from "./hooks/useDecals";
import "./styles.css";

export function App() {
  const {
    merger,
    models,
    isMerged,
    progress,
    addModel,
    updateTransform,
    removeModel,
    merge,
    exportGLB,
    clear,
  } = useMeshMerger();

  const [selectedModelId, setSelectedModelId] = useState<string>();
  const [transformMode, setTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");

  // Decal management
  const {
    decals,
    selectedDecalId,
    activeDecalTexture,
    activeDecalName,
    isPlacingMode,
    stampSettings,
    selectDecalTexture,
    updateStampSettings,
    cancelStampMode,
    addDecal,
    updateDecalTransform,
    updateDecalOpacity,
    removeDecal,
    selectDecal,
  } = useDecals(merger);

  const handleFilesSelected = async (files: File[]) => {
    for (const file of files) {
      await addModel(file);
    }
  };

  const handleLoadSample = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], `${name}.glb`, {
        type: "model/gltf-binary",
      });
      await addModel(file);
    } catch (error) {
      console.error("Failed to load sample:", error);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🔷 Three Mesh Merger</h1>
        <p>Load, transform, and merge 3D models with texture atlas</p>
      </header>

      <div className="main-content">
        {/* 3D Viewport */}
        <div className="viewport">
          <Scene
            merger={merger}
            isMerged={isMerged}
            selectedModelId={selectedModelId}
            transformMode={transformMode}
            onModelSelect={setSelectedModelId}
            onTransformChange={updateTransform}
            onModeChange={setTransformMode}
            // Decal props
            decals={decals}
            selectedDecalId={selectedDecalId}
            isPlacingDecal={isPlacingMode}
            activeDecalTexture={activeDecalTexture}
            stampScale={stampSettings.scale}
            stampRotation={stampSettings.rotation}
            onPlaceDecal={addDecal}
            onSelectDecal={selectDecal}
            onDecalTransformChange={updateDecalTransform}
          />
        </div>

        {/* Controls Panel */}
        <div className="controls-panel">
          <FileUpload
            onFilesSelected={handleFilesSelected}
            disabled={isMerged}
          />

          <SampleModels onLoadSample={handleLoadSample} disabled={isMerged} />

          {models.length > 0 && !isMerged && (
            <TransformModeSelector
              mode={transformMode}
              onChange={setTransformMode}
              disabled={isMerged}
            />
          )}

          <ModelList
            models={models}
            selectedModelId={selectedModelId}
            onSelect={setSelectedModelId}
            onRemove={removeModel}
            onTransformChange={updateTransform}
            disabled={isMerged}
          />

          {/* Decal Section */}
          {models.length > 0 && !isMerged && (
            <>
              {/* Show Stamp Controls when in stamp mode */}
              {isPlacingMode ? (
                <StampControls
                  texture={activeDecalTexture}
                  decalName={activeDecalName}
                  settings={stampSettings}
                  onSettingsChange={updateStampSettings}
                  onCancel={cancelStampMode}
                />
              ) : (
                <DecalLibrary
                  onSelectDecal={(texture, name) => {
                    selectDecalTexture(texture, name);
                  }}
                  disabled={isMerged}
                />
              )}

              <DecalList
                decals={decals}
                selectedDecalId={selectedDecalId}
                onSelect={selectDecal}
                onRemove={removeDecal}
                onOpacityChange={updateDecalOpacity}
                disabled={isMerged}
              />
            </>
          )}

          {models.length > 0 && (
            <MergePanel
              onMerge={merge}
              onExport={exportGLB}
              onClear={clear}
              isMerged={isMerged}
              progress={progress}
            />
          )}
        </div>
      </div>

      <footer className="footer">
        <p>
          Built with{" "}
          <a
            href="https://threejs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Three.js
          </a>
          {" · "}
          <a
            href="https://github.com/poppod/three-mesh-merger"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
