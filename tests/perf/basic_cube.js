// Creates a basic cube in the setup and returns it as a scene object

// Object will eventually be moved to another file.
// Create a material for the mesh
var boxMaterial = new CubicVR.Material({
    textures: {
        color: new CubicVR.Texture("../images/6583-diffuse.jpg"),
        bump: new CubicVR.Texture("../images/6583-bump.jpg")
    }
});

// Add a box to mesh, size 1.0, apply material and UV parameters
boxMesh = CubicVR.primitives.box({
    size: 1.0,
    material: boxMaterial,
    uvmapper: {
        projectionMode: CubicVR.enums.uv.projection.CUBIC,
        scale: [1, 1, 1]
    }
});

// triangulate and buffer object to GPU, remove unused data
boxMesh.prepare();

//alert('Alert Box!');