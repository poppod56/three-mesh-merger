const fs = require("fs");
const path = require("path");

// Simple GLB parser to check structure
function analyzeGLB(filePath) {
  const buffer = fs.readFileSync(filePath);
  const magic = buffer.toString("utf8", 0, 4);

  if (magic !== "glTF") {
    console.log("Not a valid GLB file");
    return;
  }

  const version = buffer.readUInt32LE(4);
  const length = buffer.readUInt32LE(8);

  console.log("File:", path.basename(filePath));
  console.log("  Size:", buffer.length, "bytes");
  console.log("  glTF Version:", version);

  // Read JSON chunk
  let offset = 12;
  const jsonChunkLength = buffer.readUInt32LE(offset);
  const jsonChunkType = buffer.readUInt32LE(offset + 4);
  offset += 8;

  const jsonData = buffer.toString("utf8", offset, offset + jsonChunkLength);
  const gltf = JSON.parse(jsonData);

  console.log("  Meshes:", gltf.meshes?.length || 0);
  console.log("  Materials:", gltf.materials?.length || 0);
  console.log("  Textures:", gltf.textures?.length || 0);
  console.log("  Images:", gltf.images?.length || 0);

  if (gltf.meshes) {
    gltf.meshes.forEach((mesh, i) => {
      console.log("  Mesh", i, ":", mesh.name || "unnamed");
      mesh.primitives.forEach((prim, j) => {
        const attrs = Object.keys(prim.attributes || {});
        console.log("    Primitive", j, "- attributes:", attrs.join(", "));
        if (prim.material !== undefined) {
          console.log("    Material index:", prim.material);
        }
      });
    });
  }

  if (gltf.materials) {
    gltf.materials.forEach((mat, i) => {
      console.log("  Material", i, ":", mat.name || "unnamed");
      if (mat.pbrMetallicRoughness?.baseColorTexture) {
        console.log("    Has baseColorTexture");
      }
    });
  }

  console.log("");
}

analyzeGLB("./packages/example-vite/public/models/Box.glb");
analyzeGLB("./packages/example-vite/public/models/Duck.glb");
