// Create a constructor function which can be used to create a Torus, it returns the torus object.
function makeTorus(radius, thick, lat) {
    var pointList = new Array();

    var M_TWO_PI = Math.PI * 2.0;

    // generate a circle on the right side (radius) of the X/Y axis, circle radius of (thick)
    for (var i = 0; i <= M_TWO_PI; i += (M_TWO_PI / lat)) {
        pointList.push([radius + Math.cos(i) * thick, Math.sin(i) * thick, 0]);
    }

    var torusMesh = new CubicVR.Mesh({
        primitive: {
            type: "lathe",
            divisions: lat,
            points: pointList,
            material: {
                textures: {
                    color: new CubicVR.Texture("../images/2062-diffuse.jpg")
                }
            },
            uv: {
                projectionMode: "planar",
                projectionAxis: "y",
                scale: [0.5, 0.5, 0.5]
            }
        },
        compile: true
    });

    return torusMesh;
}

// Create the Torus by supplying the properties and bind it to the scene object in the parent
function SceneSetup() {
    // New scene with our canvas dimensions and default camera with FOV 80
    scene = new CubicVR.Scene(canvas.width, canvas.height, 80);
    // set initial camera position and target
    scene.camera.position = [1, 1, 1];
    scene.camera.target = [0, 0, 0];
    
    // Create a SceneObject container for the Torus mesh and Add the mesh to the scene
    scene.bind(new CubicVR.SceneObject(makeTorus(0.75, 0.3, 24)));
}

// The following function is used to set the location of an object on each run of MainLoop
function MainLoopSetup() {
    
}