// Create the landscape and the boxes along with the necessary properties and bind it to the scene object in the parent
function SceneSetup() {
    // New scene with our canvas dimensions and default camera with FOV 80
    scene = new CubicVR.Scene(canvas.width, canvas.height, 80);
    // Add a box to mesh, size 1.0, apply material and UV parameters
    var boxMesh = new CubicVR.Mesh({
        primitive: {
            type: "box",
            size: 1.0,
            material: {
                textures: {
                    color: new CubicVR.Texture("../images/6583-diffuse.jpg")
                }
            },
            uvmapper: {
                projectionMode: "cubic",
                scale: [1, 1, 1]
            }
        },
        compile:true
    });

    // Generate a grass material for the landscape
    var landscapeMaterial = new CubicVR.Material({
        textures: {
            color: new CubicVR.Texture("../images/grass.jpg")
        }
    });
                
    // Generate a planar UVMapper for the landscape material.
    var landscapeUV = new CubicVR.UVMapper({
        projectionMode: "planar",
        projectionAxis: "y",
        scale: [1, 1, 1]
    });

    // Generate a size 400 landscape with 92 divisions in the X and Z axis, apply landscapeMaterial to faces.
    landscape = new CubicVR.Landscape(200,92,92,landscapeMaterial);
                
    landscape.mapGen(function(x,z) {
        return 2.0*Math.sin(x/4.0)+2.0*Math.cos(z/5.0)-4.0;
    });
                
    // Apply the UVMapper coordinates to the landscape
    landscapeUV.apply(landscape.getMesh(),landscapeMaterial);
                
    // Compile the heightfield mesh and prepare it for rendering, pass false to keep mesh data for landscape mapping
    landscape.getMesh().prepare(false);

    // Bind the landscape to the scene
    scene.bindSceneObject(landscape);

    // set initial camera position and target
    scene.camera.position = [10, 10, 10];
    scene.camera.target = [0, 0, 0];

    // Add a point light
    var light = new CubicVR.Light({ 
        type:"point",
        position: [0,20,0],
        distance: 100 
    });
                
    scene.bind(light);

    boxes = [];
    num_boxes = 64;
    for (var i = 0; i < num_boxes; i++) {
        // SceneObject container for the mesh
        boxes[i] = new CubicVR.SceneObject(boxMesh);
        // Add SceneObject containing the mesh to the scene
        boxes[i].scale=[1+Math.random()*4.0,1+Math.random()*4.0,1+Math.random()*4.0];
        scene.bind(boxes[i]);
    }
}

// The following function is used to set the location of an object on each run of MainLoop
function MainLoopSetup(timer, gl) {
    // input seed for box positions
    var t = 1000+timer.getSeconds()/100.0;
    
    for (var i = 0; i < num_boxes; i++) {
                      
        var boxObject = boxes[i];
        // use a simple deterministic position for each box
        boxObject.position[0] = 50*Math.sin(t*(1.5+(0.33*i)));
        boxObject.position[2] = 50*Math.cos(t*(2.1+(0.29*i)));

        // query the orientation for the current box X/Z position and X/Z scale
        var orientval = landscape.orient(boxObject.position[0],boxObject.position[2],boxObject.scale[0],boxObject.scale[2],0);
        // use the results to set the orientation
        boxObject.position = orientval[0];
        boxObject.rotation = orientval[1];
        // push the box out of the ground so it rests on it's base (1/2 height)
        boxObject.position[1] += boxObject.scale[1]/2.0;
    }
}