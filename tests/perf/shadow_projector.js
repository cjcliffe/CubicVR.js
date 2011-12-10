// Create the landscape and the boxes along with the necessary properties and bind it to the scene object in the parent
function SceneSetup() {
  // Create a material for the mesh
  var boxPrimitive = {
    primitive: {
      type: "box",
      size: 1.0,
      material: {
        textures: {
          color: "../images/crate.jpg",
          alpha: "../images/crate-alpha.jpg"
        }
      },
      uv: {
        projectionMode: "cubic",
        scale: [1, 1, 1]
      }
    }
  };

  // create an outer box mesh for the outside faces
  var boxMeshOuter = new CubicVR.Mesh(boxPrimitive);

  // create an inner box mesh for the inside faces
  var boxMeshInner = new CubicVR.Mesh(boxPrimitive);
  // flip the inner mesh faces so they face inwards
  boxMeshInner.flipFaces();

  // Create a new target mesh
  var boxMesh = new CubicVR.Mesh();

  // Add our inner and outer mesh to the target mesh
  boxMesh.booleanAdd(boxMeshOuter);
  boxMesh.booleanAdd(boxMeshInner);

  // triangulate and buffer object to GPU, remove unused data
  boxMesh.prepare();

  // Create a room
  var roomMesh = new CubicVR.Mesh({
    primitive: {
      type: "box",
      size: 30,
      material: {
        textures: {
          color: "../images/6583-diffuse.jpg"
        }
      },
      uv: {
        projectionMode: "cubic",
        scale: [5, 5, 5]
      }
    },
    flipFaces: true,
    compile: true
  });

  // definition for the 4 shadowed spotlights, map resolution 1024, distance (far clip): 200, intensity 0.6, cutoff angle 90
  var spotLightShadowed = {
    type: "spot_shadow_projector",
    intensity: 1,
    distance: 100,
    map_res: 1024,
    cutoff: 90,
    projector: "../images/sky.png"
  };

  // New scene with our canvas dimensions and default camera with FOV 80
  scene = new CubicVR.Scene({
    camera: {
      width: canvas.width,
      height: canvas.height,
      fov: 80,
      near: 0.1,
      far: 50.0,
      position: [2, 2, 2],
      target: [0, 0, 0]
    },
    lights: [
    spotLightShadowed,
    spotLightShadowed,
    spotLightShadowed,
    spotLightShadowed
    ],
    sceneObject: {
      mesh:roomMesh,
      position:[0,0,0]
    }
  });

  // SceneObject container for the box mesh
  boxObject = new CubicVR.SceneObject(boxMesh);

  // Add SceneObject containing the mesh to the scene
  scene.bindSceneObject(boxObject);

  // target the spotlights to set their direction
  scene.lights[0].lookat([-1,0,0]);
  scene.lights[1].lookat([1,0,0]);
  scene.lights[2].lookat([0,0,1]);
  scene.lights[3].lookat([0,0,-1]);

  for (var i = 0; i < 4; i++) {
    scene.lights[i].setParent(boxObject);
  };

  CubicVR.setGlobalAmbient([0.2,0.2,0.2]);
}

// The following function is used to set the location of an object on each run of MainLoop
function MainLoopSetup(timer, gl) {
  var seconds = timer.getSeconds();
  var lus = timer.getLastUpdateSeconds();

  boxObject.rotation = [seconds*60,0,seconds*50];
  boxObject.position = [8.0*Math.sin(seconds/2),8.0*Math.sin(seconds/2),8.0*Math.cos(1.5*seconds/2)];
  scene.camera.target = boxObject.position;

  if (!mvc.mdown) scene.camera.trackTarget(boxObject.position,lus*2.0,2.0);
}