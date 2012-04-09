
function loadVehicle(modelFile,modelPath,meshName,collisionName) {
    // load the collada file, specify path for images
    var scene = CubicVR.loadCollada(modelFile,modelPath);
//                var scene = CubicVR.loadCollada("../models/collada/sportscar/car1.dae","../models/collada/sportscar/");

    var carModel = scene.getSceneObject(meshName).getMesh();
//                var carModel = scene.getSceneObject("car1").getMesh();
    
    // add some reflection
    var envTex = new CubicVR.Texture("../images/fract_reflections.jpg");                

    for (var i= 0; i < carModel.materials.length; i++) {
      var mat = carModel.materials[i];
      mat.setTexture(envTex,CubicVR.enums.texture.map.ENVSPHERE);  
      mat.env_amount=0.2;                                    
    }
    
    var vehicle_base = {
        body: scene.getSceneObject(meshName),
        wheel_fl:  scene.getSceneObject("wheel_fl"),
        wheel_fr:  scene.getSceneObject("wheel_fr"),
        wheel_bl:  scene.getSceneObject("wheel_bl"),
        wheel_br:  scene.getSceneObject("wheel_br"),
    };
    
    var wheelMesh = vehicle_base.wheel_fl.getMesh();

    var suspension_rest = 0.10;
    
    var vehicle = new CubicVR.Vehicle({
        collision: { 
            type: "convex_hull", 
            mesh: scene.getSceneObject(collisionName).getMesh()                            
        },
        mesh: vehicle_base.body.getMesh(),
        steeringClamp: 0.6,
        maxEngineForce: 800,
        wheels: [
            {
               mesh: wheelMesh,
               position: vehicle_base.wheel_fl.position,
               scale: [-1,1,1],
               steering: true,
               braking: false,
               driving: true,
               suspensionRest: suspension_rest,
               frictionSlip: 1.5,
               dampingCompression: 1.0
            },
            {
                mesh: wheelMesh,
                position: vehicle_base.wheel_fr.position,
                steering: true,
                braking: false,
                driving: true,
                suspensionRest:suspension_rest,
                frictionSlip: 1.5,
               dampingCompression: 1.0
            },
            {
                mesh: wheelMesh,
                position: vehicle_base.wheel_bl.position,
                scale: [-1,1,1],
                driving:true,
                braking:true,
                suspensionRest: suspension_rest,
                frictionSlip: 1.5,
               dampingCompression: 1.0
            },
            {
               mesh: wheelMesh,
               position: vehicle_base.wheel_br.position,
               driving: true,
               braking: true,
               suspensionRest: suspension_rest,
               frictionSlip: 1.5,
               dampingCompression: 1.0
            }
            
        ]
    });
     
    return vehicle;
}


function GameLevel(levelFile,levelImages) {
    this.body = null;
    this.levelModel = CubicVR.loadCollada(levelFile,levelImages);

    this.playerStart = this.levelModel.getSceneObject("vehicle_start");
    this.playerStart.visible = false;

    this.playerStartRotation = [0,0,0];
    if (this.playerStart) this.playerStartRotation = this.playerStart.rotation;
    if (this.playerStart) this.playerStart = this.playerStart.position;
}

GameLevel.prototype = {
    setupRigidBody: function(physics) {
       
        var sceneObjs = this.levelModel.sceneObjects;
        var collisionMaps = [];
        var undef;

        for (var i = 0; i < sceneObjs.length; i++) {
            var sceneObj = sceneObjs[i];
            var objMesh = sceneObj.getMesh();

            var nameSplit = sceneObj.name.split("-");

            if (nameSplit.length === 3) {
                if (nameSplit[0] === "static") {
                    if (nameSplit[1] == "cube") {
                        var body = new CubicVR.RigidBody(sceneObj,{
                            type: "static",
                            mass:0,
                            margin:0,
                            collision: {
                                type: "box",
                                size: sceneObj.scale,
                            }
                        });
                        physics.bind(body);
//                                    this.levelModel.removeSceneObject(sceneObj);
//                                    i--;
                    } else if (nameSplit[1] == "mesh") {
                        if (collisionMaps[objMesh.name]===undef) {
                            collisionMaps[objMesh.name] = new CubicVR.CollisionMap({
                                type: "mesh",
                                mesh: objMesh
                            });
                        }
                        
                        var meshMat = objMesh.getMaterials();
                        var ncToken = "no_collide";
                        var ncLen = ncToken.length;
                        var nvToken = "no_visible";
                        var nvLen = nvToken.length;
                        
                        for (var m = 0, mMax = meshMat.length; m < mMax; m++) {
                            var mat = meshMat[m];   
                            if (!mat.name) continue;
                            if (mat.name.substr(0,ncLen) == ncToken) {
                                mat.setCollision(false);
                            } 
                            if (mat.name.substr(0,nvLen) == nvToken) {
                                mat.setVisibility(false);
                            } 
                        }
                    
                        var body = new CubicVR.RigidBody(sceneObj,{
                            type: "static",
                            mass:0,
                            margin:0,
                            collision: collisionMaps[objMesh.name]
                        });
                        
                        physics.bind(body);
                    }

                } else if (nameSplit[0] === "dynamic") {
                    // ...
                }
            }
       }
    },
    getPlayerStart: function() {
        return (this.playerStart||[0,0,0]).slice(0);
    },
    getPlayerStartRotation: function() {
        return (this.playerStartRotation||[0,0,0]).slice(0);
    },
    getLevel: function() {
      return this.levelModel;
    }
}


