/**/


var VehicleDebugGUI = function(vehicle) {
    this.toggleHelp = function() 
    { 
        var el = document.getElementById("help");  
        el.style.display = (el.style.display != "")?"":"none";           
    };
    
    this.initVehicle(vehicle);  

    this.gui = new dat.GUI();
    this.gui.width=350;
    this.init(this.gui);    
};

VehicleDebugGUI.prototype = {
  initVehicle: function(vehicle) {
    this.vehicle = vehicle;
    var wheel = this.vehicle.wheels[0];

    this.suspensionRest = wheel.getSuspensionRest();
    this.frictionSlip = wheel.getFrictionSlip();
    this.dampingCompression = wheel.getDampingCompression();
    this.dampingRelaxation = wheel.getDampingRelaxation();
    this.suspensionStiffness = wheel.getSuspensionStiffness();
    this.rollInfluence = wheel.getRollInfluence();
    this.mass = vehicle.getMass();
  },
  init: function(gui) {

    var context = this;
    var changeFunc = function() { context.onChange(); };
    gui.add(this, 'toggleHelp');
    gui.add(this, 'mass', 200, 1500).onChange(changeFunc);
    gui.add(this, 'suspensionRest', 0, 0.5).onChange(changeFunc);
    gui.add(this, 'frictionSlip', 0, 10).onChange(changeFunc);
    gui.add(this, 'dampingCompression', 0, 10).onChange(changeFunc);
    gui.add(this, 'dampingRelaxation', 0, 10).onChange(changeFunc);
    gui.add(this, 'suspensionStiffness', 0, 100).onChange(changeFunc);
    gui.add(this, 'rollInfluence', -1, 1).onChange(changeFunc);

    /*
    controller.onChange(function(value) {
    controller.onFinishChange(function(value) {
    */
  },
  update: function() {
    var gui = this.gui;

    for (var i in gui.__controllers) {
      gui.__controllers[i].updateDisplay();
    }  
  },
  onChange: function() {
    var wheels = this.vehicle.wheels;

    for (var i = 0, iMax = wheels.length; i<iMax; i++) {
        wheels[i].setSuspensionRest(this.suspensionRest);
        wheels[i].setFrictionSlip(this.frictionSlip);
        wheels[i].setDampingCompression(this.dampingCompression);
        wheels[i].setDampingRelaxation(this.dampingRelaxation);
        wheels[i].setSuspensionStiffness(this.suspensionStiffness);
    }
    
    this.vehicle.updateSuspension();
    this.vehicle.setMass(this.mass);
    
  }
};

/**/


function webGLStart() {

 
 
    // by default generate a full screen canvas with automatic resize
    var gl = CubicVR.init();
    var canvas = CubicVR.getCanvas();

    if (!gl) {
        alert("Sorry, no WebGL support.");
        return;
    };


 

    CubicVR.setSoftShadows(true);
    CubicVR.setGlobalAmbient([0.2,0.2,0.25]);

     // init physics manager
    var physics = new CubicVR.ScenePhysics();

    var level = new GameLevel("../models/collada/track/track1.dae","../models/collada/track/");
    
    scene = level.getLevel();

    scene.lights = [];

    scene.setSkyBox(new CubicVR.SkyBox({texture:"../images/cubemap1.jpg"}));

    var camera = new CubicVR.Camera({
            width: canvas.width, 
            height: canvas.height, 
            fov: 70,
            farclip: 1000,
            position: [15, 4, 15],
            target: [0, -3, 0]
        });
    scene.setCamera(camera);

    var light = new CubicVR.Light({
          type: "area",
          intensity: 0.8,
          color: [0.8,0.8,0.95],
          mapRes: 2048,
          areaCeiling: 80,
          areaFloor: -10,
          areaAxis: [-5,-2], // specified in degrees east/west north/south
          distance: 120
        });                
        
    scene.bind(light);

    level.setupRigidBody(physics);
    
    // load and initialize the vehicle
    var truck = loadVehicle("../models/collada/truck/truck_L200.dae","../models/collada/truck/","truck1","truck1Collision"); 
    var car = loadVehicle("../models/collada/sportscar/car1.dae","../models/collada/sportscar/","car1","car1Collision");

    var vehicle = truck;

    truck.getSceneObject().position = level.getPlayerStart();
    truck.getSceneObject().rotation = level.getPlayerStartRotation();

    car.getSceneObject().position = level.getPlayerStart();
    car.getSceneObject().position[2] -= 3.5;
    car.getSceneObject().rotation = level.getPlayerStartRotation();

    truck.getSceneObject().position[2] += 3.5;

    scene.bind(truck);
    physics.bind(truck);

    scene.bind(car);
    physics.bind(car);


    // initialize a mouse view controller
    mvc = new CubicVR.MouseViewController(canvas, scene.camera);

    // Add our scene to the window resize list
    CubicVR.addResizeable(scene);

    var gui = new VehicleDebugGUI(vehicle);

    var pickConstraint = null;
    var pickDist = 0;
    var steer = 0;
    var gas = 0;
    var brake = 0;
    var kbd = CubicVR.keyboard;
 
    mvc.setEvents({
        mouseMove: function (ctx, mpos, mdelta, keyState) {
        
            if (!ctx.mdown) return;

            if (pickConstraint) {
                pickConstraint.setPosition(scene.camera.unProject(mpos[0],mpos[1],pickDist));
            } else {                   
                ctx.orbitView(mdelta);
            }
            //          ctx.panView(mdelta);
        },
        mouseWheel: function (ctx, mpos, wdelta, keyState) {
            ctx.zoomView(wdelta);
        },
        mouseDown: function (ctx, mpos, keyState) {
          var rayTo = scene.camera.unProject(mpos[0],mpos[1]);
          var result = physics.getRayHit(scene.camera.position,rayTo);

          if (result && !pickConstraint) {
            pickConstraint = new CubicVR.Constraint({
                type: CubicVR.enums.physics.constraint.P2P,
                rigidBody: result.rigidBody,
                positionA: result.localPosition
            });                        
            
            physics.addConstraint(pickConstraint);                       
            pickDist = CubicVR.vec3.length(CubicVR.vec3.subtract(scene.camera.position,result.position));                        
            pickConstraint.setPosition(scene.camera.unProject(mpos[0],mpos[1],pickDist));
          }
          
        },
        mouseUp: function(ctx, mpos, keyState) {
            if (pickConstraint) {
                physics.removeConstraint(pickConstraint);
                pickConstraint = null;
            }                        
        },
       keyDown: function(ctx,mpos,keyCode,keyState) {
            if (keyCode == kbd.KEY_R) {
                physics.reset(); 
            }
                                    
            if (keyCode == kbd.UP_ARROW || keyCode == kbd.KEY_W) {
                gas = 1;
            } else if (keyCode == kbd.DOWN_ARROW || keyCode == kbd.KEY_S) {
                gas = -1;
            }

            if (keyCode == kbd.SPACE) {
               brake = 10000;
               return false;
            }


            if (keyCode == kbd.LEFT_ARROW || keyCode == kbd.KEY_A) {
                steer = 1;
            } 
            if (keyCode == kbd.RIGHT_ARROW || keyCode == kbd.KEY_D) {
                steer = -1;
            }
            return true;
        },
        keyUp: function(ctx,mpos,keyCode,keyState) {
            if (keyCode == kbd.UP_ARROW || keyCode == kbd.DOWN_ARROW || keyCode == kbd.KEY_W || keyCode == kbd.KEY_S) {
                gas = 0;
            }
            
            if (keyCode == kbd.SPACE) {
               brake = 0;
            }
   
            if (keyCode == kbd.LEFT_ARROW || keyCode == kbd.RIGHT_ARROW  || keyCode == kbd.KEY_A || keyCode == kbd.KEY_D) {
               steer = 0;
            }
            
            if (keyCode == kbd.KEY_1) {
               vehicle = truck;
               gui.initVehicle(truck);
               gui.update();
            }

            if (keyCode == kbd.KEY_2) {
               vehicle = car;
               gui.initVehicle(car);
               gui.update();
            }

            return true;
            
            
        }                });

   
    // Start our main drawing loop, it provides a timer and the gl context as parameters
    CubicVR.MainLoop(function(timer, gl) {
        var lus = timer.getLastUpdateSeconds();

        if (lus>0.1) lus = 0.1;
        
        if (steer) {
             vehicle.incSteering(steer*lus);
        } else {
            vehicle.setSteering(vehicle.getSteering()-(vehicle.getSteering()*lus*2.0));
        }
        
        if (gas > 0) {
           vehicle.incEngine(lus*300.0); 
        } else if (gas < 0) {
           if (vehicle.getEngineForce()>0) {
               vehicle.setEngineForce(vehicle.getEngineForce()-(vehicle.getEngineForce()*lus*10.0));                           
           }
           vehicle.decEngine(lus*200.0); 
        } else {
           vehicle.setEngineForce(vehicle.getEngineForce()-(vehicle.getEngineForce()*lus*2.0));
        }
        
        if (brake) {
            vehicle.setBrake(brake);
            vehicle.setEngineForce(0);
        } else {
            vehicle.setBrake(0);
        }

        physics.stepSimulation(lus,10);

        truck.evaluate();
        car.evaluate();

        scene.render();


        scene.camera.trackTarget(vehicle.getSceneObject().position,lus*5.0,6.0);
        scene.camera.target = vehicle.getSceneObject().position;
        
        var camFloor = 4.0;
        
        var rayTo = CubicVR.vec3.add(scene.camera.position,[0,-8,0]);
        var result = physics.getRayHit(scene.camera.position,rayTo,true);

        if (result) {
            if (camFloor < result.position[1]+camFloor) {
                camFloor = result.position[1]+camFloor;
            }
        }
        
        if (scene.camera.position[1] < camFloor) {
            scene.camera.position[1] = camFloor;
        }
        
    });
}
