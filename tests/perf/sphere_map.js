// Create a Sphere aling with the necessary properties and bind it to the scene object in the parent
function SceneSetup() {
    // New scene with our canvas dimensions and default camera with FOV 80
    scene = new CubicVR.Scene(canvas.width, canvas.height, 80);
    // set initial camera position and target
    scene.camera.position = [0, 0, 2];
    scene.camera.target = [0, 0, 0];

    // Create Light Object
    var light = new CubicVR.Light({
        type: "point",
        method: "dynamic",
        diffuse:[1,1,1],
        specular:[1,1,1],
        position:[0,5,2],
        distance:20
    });
    
    // Bind light object to the Scene
    scene.bind(light);
    
    // Create Sphere Object
    var sphereMesh = new CubicVR.Mesh({
        primitive: {
            type: "sphere",
            radius: 0.5,
            lat: 24,
            lon: 24,
            material: {
                color: [80/255, 200/255, 120/255],
                specular:[1,1,1],
                shininess: 0.9,
                env_amount: 1.0,
                textures: {
                    color: new CubicVR.Texture("../images/2576-diffuse.jpg"),
                    normal: new CubicVR.Texture("../images/2576-normal.jpg"),
                    bump: new CubicVR.Texture("../images/2576-bump.jpg"),
                    envsphere: new CubicVR.Texture("../images/fract_reflections.jpg")
                }
            },
            uv: {
                projectionMode: "spherical",
                projectionAxis: "y",
                wrapW: 5,
                wrapH: 2.5
            }
        },
        compile: true
    });
    
    // Bind Sphere object to Scene
    scene.bind(new CubicVR.SceneObject({
        mesh:sphereMesh, 
        position:[0,0,0], 
        scale:[2,2,2]
    }));
}

// The following function is used to set the location of an object on each run of MainLoop
function MainLoopSetup() {
    
}