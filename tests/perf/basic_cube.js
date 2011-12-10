// Create a basic cube along with its properties and bind it to the scene object in the parent
function SceneSetup() {
    // New scene with our canvas dimensions and default camera with FOV 80
    scene = new CubicVR.Scene(canvas.width, canvas.height, 80);
    // set initial camera position and target
    scene.camera.position = [1, 1, 1];
    scene.camera.target = [0, 0, 0];
    // Create a material for the mesh
    var boxMaterial = new CubicVR.Material({
        textures: {
            color: new CubicVR.Texture("../images/6583-diffuse.jpg"),
            bump: new CubicVR.Texture("../images/6583-bump.jpg")
        }
    });

    // Add a box to mesh, size 1.0, apply material and UV parameters
    var boxMesh = CubicVR.primitives.box({
        size: 1.0,
        material: boxMaterial,
        uvmapper: {
            projectionMode: CubicVR.enums.uv.projection.CUBIC,
            scale: [1, 1, 1]
        }
    });

    // triangulate and buffer object to GPU, remove unused data
    boxMesh.prepare();

    scene.bindSceneObject(new CubicVR.SceneObject(boxMesh));
}

// The following function is used to set the location of an object on each run of MainLoop
function MainLoopSetup() {
}