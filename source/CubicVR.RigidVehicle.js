CubicVR.RegisterModule("RigidVehicle", function (base) {

  var undef = base.undef;
  var util = CubicVR.util;
  var vec3 = CubicVR.vec3;
  var enums = CubicVR.enums;
  
  
  var utrans;
  var uquat, ubtquat;
  var uvec,uvec2;

  var Vehicle = function (scenePhysics, bodyMesh, bodyCollision, wheelMesh) {
      this.gEngineForce = 0.0;
      this.gBreakingForce = 0.0;
      this.maxEngineForce = 2000.0;
      this.maxBreakingForce = 125.0;
      this.gVehicleSteering = 0.0;
      this.steeringClamp = 0.51;
      this.rightIndex = 0;
      this.upIndex = 1;
      this.forwardIndex = 2;

      this.m_vehicleRayCaster = null
      this.m_vehicle = null;
      this.m_tuning = null;

      this.wheelDirectionCS0 = new Ammo.btVector3();
      this.wheelAxleCS = new Ammo.btVector3();

      this.wheels = [];

      this.bodyMesh = bodyMesh;
      this.bodyCollision = new CubicVR.CollisionMap(bodyCollision);      
      this.wheelMesh = wheelMesh;
      this.sceneObject = new CubicVR.SceneObject(this.bodyMesh);
      this.scenePhysics = scenePhysics;
      
      if (!utrans || !uquat) {
        uvec = new Ammo.btVector3();
        uvec2 = new Ammo.btVector3();
        utrans = new Ammo.btTransform();
        uquat = new CubicVR.Quaternion();
        ubtquat = new Ammo.btQuaternion();
      }
    };


  Vehicle.prototype = {
    getSceneObject: function() {
        return this.sceneObject;
    },
    initBody: function () {
      this.body = new CubicVR.RigidBody(this.sceneObject, {
        collision: this.bodyCollision,
        mass: 800,
        restitution: 0.1
      });

      CubicVR.vec3bt_copy([0, -1, 0], this.wheelDirectionCS0);
      CubicVR.vec3bt_copy([-1, 0, 0], this.wheelAxleCS);

      this.gVehicleSteering = 0;
      //        mRigidBody->setCenterOfMassTransform(btTransform::getIdentity());
      this.body.setLinearVelocity([0, 0, 0]);
      this.body.setAngularVelocity([0, 0, 0]);

      /// create vehicle
      this.m_vehicleRayCaster = new Ammo.btDefaultVehicleRaycaster(this.scenePhysics.dynamicsWorld);
      this.m_tuning = new Ammo.btVehicleTuning();
      this.m_vehicle = new Ammo.btRaycastVehicle(this.m_tuning, this.body.getBody(), this.m_vehicleRayCaster);
      ///never deactivate the vehicle
      this.body.getBody().setActivationState(enums.physics.collision_states.DISABLE_DEACTIVATION);

      //choose coordinate system
      this.m_vehicle.setCoordinateSystem(this.rightIndex, this.upIndex, this.forwardIndex);

      var wpos = new Ammo.btVector3();

      for (var i = 0; i < this.wheels.length; i++) {
        CubicVR.vec3bt_copy(this.wheels[i].getWheelPosition(), wpos);
        this.m_vehicle.addWheel(wpos, this.wheelDirectionCS0, this.wheelAxleCS, this.wheels[i].getSuspensionRest(), this.wheels[i].getWheelRadius(), this.m_tuning, this.wheels[i].getSteering());
     //   console.log("Added Wheel "+i+"",wpos, this.wheels[i].getSuspensionRest(), this.wheels[i].getWheelRadius(), this.m_tuning, this.wheels[i].getSteering());
      }

      this.scenePhysics.dynamicsWorld.addVehicle(this.m_vehicle);

      this.updateSuspension();
    },
    evaluate: function () {
      var m = [];

      var numWheels = this.m_vehicle.getNumWheels();

      for (var i = 0; i < numWheels; i++) {
        if (this.wheels[i].isSteering()) {
          this.m_vehicle.setSteeringValue(this.gVehicleSteering, i);
        }

        if (this.wheels[i].isBraking()) {
          this.m_vehicle.setBrake(this.gBrakingForce, i);
        }

        if (this.wheels[i].isDriving()) {
          this.m_vehicle.applyEngineForce(this.gEngineForce, i);
        }

        //synchronize the wheels with the (interpolated) chassis worldtransform
        this.m_vehicle.updateWheelTransform(i, true);
        var wtrans = this.m_vehicle.getWheelTransformWS(i)  //.getOpenGLMatrix(this.wheels[i].wheelObj.tMatrix);

        // this.body.getBody().getMotionState().getWorldTransform();
        // optional optimization if not using the position/rotation, avoids quaternion conversion
        // var m;  utrans.getOpenGLMatrix(m);  this.sceneObject.tMatrix = m;

        var origin = wtrans.getOrigin();
        this.wheels[i].wheelObj.position[0] = origin.x();
        this.wheels[i].wheelObj.position[1] = origin.y();
        this.wheels[i].wheelObj.position[2] = origin.z();
        
        var quat_rotation = wtrans.getRotation();
        uquat.x = quat_rotation.x();
        uquat.y = quat_rotation.y();
        uquat.z = quat_rotation.z();
        uquat.w = quat_rotation.w();
        
        var rotation = uquat.toEuler();
        this.wheels[i].wheelObj.rotation[0] = rotation[0];
        this.wheels[i].wheelObj.rotation[1] = rotation[1];
        this.wheels[i].wheelObj.rotation[2] = rotation[2];
      }
      
      if (!this.body.isActive()) {
         this.body.activate();
      }

      this.updateSceneObject(true);
    },
    updateSceneObject: function(force_update) {
      if (!this.body) return;
      if (this.body.isActive() || force_update) {
        this.body.getBody().getMotionState().getWorldTransform(utrans);
        // optional optimization if not using the position/rotation, avoids quaternion conversion
        // var m;  utrans.getOpenGLMatrix(m);  this.sceneObject.tMatrix = m;

        var origin = utrans.getOrigin();
        if (origin.x != origin.x) {
          // Nan?
          console.log("origin is NaN");
        } else {
          this.sceneObject.position[0] = origin.x();
          this.sceneObject.position[1] = origin.y();
          this.sceneObject.position[2] = origin.z();
        }
        var quat_rotation = utrans.getRotation();
        uquat.x = quat_rotation.x();
        uquat.y = quat_rotation.y();
        uquat.z = quat_rotation.z();
        uquat.w = quat_rotation.w();
        
        if (uquat.x != uquat.x) {
          // Nan?          
          console.log("rotation is NaN");
        } else {
          var rotation = uquat.toEuler();
          this.sceneObject.rotation[0] = rotation[0];
          this.sceneObject.rotation[1] = rotation[1];
          this.sceneObject.rotation[2] = rotation[2];
        }
                
        return true;
      } else {

//          this.transform.setRotation(vec3btquat(this.init_rotation));
      }
    },
    setEngineForce: function (engineForce) {
      this.gEngineForce = engineForce;
    },
    setSteering: function (steering) {
      this.gVehicleSteering = steering;
    },
    incSteering: function (steeringVal) {
      this.gVehicleSteering += steeringVal;

      if (this.gVehicleSteering > this.steeringClamp) this.gVehicleSteering = steeringClamp;
      if (this.gVehicleSteering < -this.steeringClamp) this.gVehicleSteering = -steeringClamp;
    },
    setBrake: function (brake_val) {
      this.gBreakingForce = brake_val;
    },
    getWheelGroundPosition: function (wheelNum) {
      //      if (wheelNum > 3) return [0,0,0];
      return this.wheels[wheelNum].wheelObj.getWorldPosition() - [0, wheels[wheelNum].getWheelRadius(), 0];
    },
    getWheelSkid: function (wheelNum) {
      var wheelInfo = this.m_vehicle.getWheelInfo(wheelNum);

      return wheelInfo.get_m_skidInfo();
    },
    getRigidGround: function (wheelNum) {
      var wheelInfo = this.m_vehicle.getWheelInfo(wheelNum);

//console.log(wheelInfo.get_m_raycastInfo());   // Fails

//Working
//console.log(wheelInfo.get_m_worldTransform());
//console.log(wheelInfo.get_m_chassisConnectionPointCS());
//console.log(wheelInfo.get_m_wheelDirectionCS());
//console.log(wheelInfo.get_m_suspensionRestLength1());
//console.log(wheelInfo.get_m_wheelDirectionCS());
//console.log(wheelInfo.get_m_maxSuspensionTravelCm());
//console.log(wheelInfo.get_m_wheelsRadius());
//console.log(wheelInfo.get_m_suspensionStiffness());
//console.log(wheelInfo.get_m_wheelsDampingCompression());
//console.log(wheelInfo.get_m_wheelsDampingRelaxation());
//console.log(wheelInfo.get_m_frictionSlip());
//console.log(wheelInfo.get_m_steering());
//console.log(wheelInfo.get_m_rotation());
//console.log(wheelInfo.get_m_deltaRotation());
//console.log(wheelInfo.get_m_rollInfluence());
//console.log(wheelInfo.get_m_maxSuspensionForce());
//console.log(wheelInfo.get_m_brake());
//console.log(wheelInfo.get_m_clientInfo());
//console.log(wheelInfo.get_m_clippedInvContactDotSuspension());
//console.log(wheelInfo.get_m_suspensionRelativeVelocity());
//console.log(wheelInfo.get_m_wheelsSuspensionForce());
//console.log(wheelInfo.get_m_skidInfo());
//console.log(wheelInfo.getSuspensionRestLength());
//console.log(wheelInfo.get_m_bIsFrontWheel());


//      return wheelInfo.get_m_raycastInfo().get_m_groundObject()._cvr_rigidbody||null;
    },
    addWheel: function (wheel_in, wheelNum) {
        if (wheelNum===undef) {            
            wheelNum = this.wheels.length;
        }
      this.wheels[wheelNum] = wheel_in;
    },
    getWheel: function (wheelNum) {
      return this.wheels[wheelNum];
    },
    updateSuspension: function () {
      var numWheels = this.m_vehicle.getNumWheels();
      for (var i = 0; i < numWheels; i++) {
        var wheel = this.m_vehicle.getWheelInfo(i);

        wheel.set_m_suspensionStiffness(this.wheels[i].getSuspensionStiffness());
        wheel.set_m_wheelsDampingRelaxation(this.wheels[i].getDampingRelaxation());
        wheel.set_m_wheelsDampingCompression(this.wheels[i].getDampingCompression());
        wheel.set_m_frictionSlip(this.wheels[i].getFrictionSlip());
        wheel.set_m_rollInfluence(this.wheels[i].getRollInfluence());
      }

      if (this.m_vehicle) {
        this.m_vehicle.resetSuspension();
        for (var i = 0; i < numWheels; i++) {
          this.m_vehicle.updateWheelTransform(i, true);
        }
      }
    }
  };

  var VehicleWheel = function () {
      this.wheelRef = new CubicVR.SceneObject();
      this.wheelObj = new CubicVR.SceneObject();

      this.suspensionStiffness = 40.0;
      this.suspensionRest = 0.05;

      this.dampingRelaxation = 2.3;
      this.dampingCompression = 2.4;

      this.frictionSlip = 0.94;
      this.rollInfluence = 1.0;

      // These will be initialized automatically from the model if not provided
      this.wheelRadius = 0.7;
      this.wheelWidth = 0.2;

      // Relative position/rotation ( right wheels typicaly have rotation XYZ(0,180,0) );
      this.wheelRotation = [0, 0, 0];
      this.wheelPosition = [0, 0, 0];

      // Is this a steering, braking and / or driving wheel?
      this.steering = false;
      this.braking = false;
      this.driving = false;
    };


  VehicleWheel.prototype = {
    setModel: function (wheelModel_in, wheelRadius_in, wheelWidth_in) {
      this.wheelModel = wheelModel_in;
      this.wheelRadius = wheelRadius_in || 0.0;
      this.wheelWidth = wheelWidth_in || 0.0;

      if (this.wheelRadius === 0.0) {
        // average front to back & top to bottom to hopefully even out any tesselation misalignment
        this.wheelRadius = (this.wheelModel.bb[1][1] - this.wheelModel.bb[0][1]) / 2.0;
        this.wheelRadius += (this.wheelModel.bb[1][2] - this.wheelModel.bb[0][2]) / 2.0;
        this.wheelRadius /= 2.0;
      }

      if (this.wheelWidth == 0.0) {
        this.wheelWidth = this.wheelModel.bb[1][0] - this.wheelModel.bb[0][0];
      }

      this.wheelRef.obj = this.wheelModel;
      this.wheelObj.bindChild(this.wheelRef);
    },
    setSuspensionStiffness: function (suspensionStiffness_in) {
      this.suspensionStiffness = suspensionStiffness_in;
    },
    getSuspensionStiffness: function () {
      return this.suspensionStiffness;
    },
    setSuspensionRest: function (suspensionRest_in) {
      this.suspensionRest = suspensionRest_in;
    },
    getSuspensionRest: function () {
      return this.suspensionRest;
    },
    setDampingRelaxation: function (dampingRelaxation_in) {
      this.dampingRelaxation = dampingRelaxation_in;
    },
    getDampingRelaxation: function () {
      return this.dampingRelaxation;
    },
    setDampingCompression: function (dampingCompression_in) {
      this.dampingCompression = dampingCompression_in;
    },
    getDampingCompression: function () {
      return this.dampingCompression;
    },
    setFrictionSlip: function (frictionSlip_in) {
      this.frictionSlip = frictionSlip_in;
    },
    getFrictionSlip: function () {
      return this.frictionSlip;
    },
    setRollInfluence: function (rollInfluence_in) {
      this.rollInfluence = rollInfluence_in;
    },
    getRollInfluence: function () {
      return this.rollInfluence;
    },
    setWheelRadius: function (wheelRadius_in) {
      this.wheelRadius = wheelRadius_in;
    },
    getWheelRadius: function () {
      return this.wheelRadius;
    },
    setWheelWidth: function (wheelWidth_in) {
      this.wheelWidth = wheelWidth_in;
    },
    getWheelWidth: function () {
      return this.wheelWidth;
    },
    setWheelRotation: function (wheelRotation_in) {
      this.wheelRotation = wheelRotation_in;
      this.wheelRef.setRotation(wheelRotation);
    },
    getWheelRotation: function () {
      return this.wheelRotation;
    },
    setWheelPosition: function (wheelPosition_in) {
      this.wheelPosition = wheelPosition_in;
      this.wheelObj.position = wheelPosition;
    },
    getWheelPosition: function () {
      return this.wheelPosition;
    },
    setSteering: function (steering_in) {
      this.steering = steering_in;
    },
    getSteering: function(){
      return this.steering;
    },
    isSteering: function () {
      return this.steering;
    },
    setBraking: function (braking_in) {
      this.braking = this.braking_in;
    },
    isBraking: function () {
      return this.braking;
    },
    setDriving: function (driving_in) {
      this.driving = driving_in;
    },
    isDriving: function () {
      return this.driving;
    }
  };


  var extend = {
    Vehicle: Vehicle,
    VehicleWheel: VehicleWheel
  };

  return extend;
});


/*
  void loadFrom(DataNode *elem)
  {
    setDefaults();
    
    if (elem->hasAnother("suspension_stiffness")) elem->child("suspension_stiffness").element().get(suspensionStiffness);
    if (elem->hasAnother("suspension_rest")) elem->child("suspension_rest").element().get(suspensionRest);
    if (elem->hasAnother("damping_relaxation")) elem->child("damping_relaxation").element().get(dampingRelaxation);
    if (elem->hasAnother("damping_compression")) elem->child("damping_compression").element().get(dampingCompression);
    if (elem->hasAnother("friction_slip")) elem->child("friction_slip").element().get(frictionSlip);
    if (elem->hasAnother("roll_influence")) elem->child("roll_influence").element().get(rollInfluence);
    if (elem->hasAnother("wheel_radius")) elem->child("wheel_radius").element().get(wheelRadius);
    if (elem->hasAnother("wheel_width")) elem->child("wheel_width").element().get(wheelWidth);
    if (elem->hasAnother("wheel_rotation")) elem->child("wheel_rotation").element().get(wheelRotation);
    if (elem->hasAnother("wheel_model")) elem->child("wheel_model").element().get(wheelModelId);
    if (elem->hasAnother("wheel_position")) elem->child("wheel_position").element().get(wheelPosition);
    if (elem->hasAnother("steering")) elem->child("steering").element().get((int &)steering);    
    if (elem->hasAnother("braking")) elem->child("braking").element().get((int &)braking);    
    if (elem->hasAnother("driving")) elem->child("driving").element().get((int &)driving);    
    
    setWheelPosition(wheelPosition);
    setWheelRotation(wheelRotation);
  };
  
bool Vehicle::onLoad() 
{
  if (!properties) return false;
  
  
  if (properties->rootNode().hasAnother("position")) properties->rootNode().child("position").element().get(position);
  if (properties->rootNode().hasAnother("rotation")) properties->rootNode().child("rotation").element().get(rotation);

  if (properties->rootNode().hasAnother("mesh")) properties->rootNode().child("mesh").element().get(meshModelId);
//  if (properties->rootNode().hasAnother("wheel")) properties->rootNode().child("wheel").element().get(wheelModelId);
  if (properties->rootNode().hasAnother("collision")) properties->rootNode().child("collision").element().get(collisionModelId);
  
  if (properties->rootNode().hasAnother("mass")) properties->rootNode().child("mass").element().get(mass);
  
  unsigned int wheelCount = 0;
  
  properties->rootNode().rewind("wheel");
  while (properties->rootNode().hasAnother("wheel")) 
  {
//    properties->rootNode().child("wheel").element().get(wheelModelId);
    
    VehicleWheel *newWheel = new VehicleWheel();
    newWheel->loadFrom(&properties->rootNode().getNext("wheel"));
    addWheel(wheelCount,newWheel);
    wheelCount++;
  }
  
  w_init = l_init = false;
  
  return true;
};
*/
