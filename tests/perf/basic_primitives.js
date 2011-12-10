// Create multiple objects along with their properties and bind it to the scene object in the parent
function SceneSetup() {
    // New scene with our canvas dimensions and default camera with FOV 80
    scene = new CubicVR.Scene(canvas.width, canvas.height, 80);
    // set initial camera position and target
    scene.camera.position = [0, 2, 2];
    scene.camera.target = [0, 0, 0];
    
    // Create a material for the mesh
    var material1 = new CubicVR.Material({
        textures: {
            color: new CubicVR.Texture("../images/2576-diffuse.jpg"),
            bump: new CubicVR.Texture("../images/2576-bump.jpg")
        }
    });

    var material2 = new CubicVR.Material({
        textures: {
            color: new CubicVR.Texture("../images/2062-diffuse.jpg")
        }
    });

    var material3 = new CubicVR.Material({
        textures: {
            color: new CubicVR.Texture("../images/6583-diffuse.jpg"),
            bump: new CubicVR.Texture("../images/6583-bump.jpg")
        }
    });

    var uvplanar = {
        projectionMode: "planar",
        projectionAxis: "y",
        scale: [0.5, 0.5, 0.5]
    };

    var uvplane = {
        projectionMode: "planar",
        projectionAxis: "z",
        scale: [0.5, 0.5, 0.5]
    };
                
    var uvcubic = {
        projectionMode: "cubic",
        scale: [0.5, 0.5, 0.5]
    };
                
    var torusMesh = new CubicVR.Mesh({
        primitive: { 
            type: "torus",
            innerRadius: 0.5, 
            outerRadius: 0.75, 
            lat: 24, 
            lon: 24, 
            material: material1,
            uvmapper: uvplanar
        },
        compile: true                   
    });

    var planeMesh = new CubicVR.Mesh({
        primitive: {
            type: "plane",
            size: 1.0,
            material: material2,
            uvmapper: uvplane
        },
        compile: true
    });

    var boxMesh = new CubicVR.Mesh({
        primitive: {
            type: "box",
            size: 1.0,
            material: material3,
            uvmapper: uvcubic
        },
        compile: true
    });

    var sphereMesh = new CubicVR.Mesh({
        primitive: {
            type: "sphere",
            radius: 0.5,
            lat: 24,
            lon: 24,
            material: material3,
            uvmapper: uvcubic
        },
        compile: true
    });

    var coneMesh = new CubicVR.Mesh({
        primitive: {
            type: "cone",
            base: 1.0,
            material: material2,
            uvmapper: uvcubic
        },
        compile: true
    });

    var cylinderMesh = new CubicVR.Mesh({
        primitive: {
            type: "cylinder",
            radius: 0.5,
            height: 1.0,
            lon: 24,
            material: material1,
            uvmapper: uvcubic
        },
        compile: true
    });
               

    // Add SceneObjects                
    scene.bindSceneObject(new CubicVR.SceneObject({
        mesh:torusMesh, 
        position:[-1.5,0,-1]
        }));
    scene.bindSceneObject(new CubicVR.SceneObject({
        mesh:planeMesh, 
        position:[0,0,-1]
        }));
    scene.bindSceneObject(new CubicVR.SceneObject({
        mesh:boxMesh, 
        position:[1.5,0,-1]
        }));
    scene.bindSceneObject(new CubicVR.SceneObject({
        mesh:sphereMesh, 
        position:[-1.5,0,1]
        }));
    scene.bindSceneObject(new CubicVR.SceneObject({
        mesh:coneMesh, 
        position:[0,0,1]
        }));
    scene.bindSceneObject(new CubicVR.SceneObject({
        mesh:cylinderMesh, 
        position:[1.5,0,1]
        }));
}

// The following function is used to set the location of an object on each run of MainLoop
function MainLoopSetup() {
    
}