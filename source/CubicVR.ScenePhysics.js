CubicVR.RegisterModule("ScenePhysics",function(base) {

  var undef = base.undef;
  var util = CubicVR.util;
  var vec3 = CubicVR.vec3;
  var enums = CubicVR.enums;

  enums.physics = {
    body: {
      STATIC: 0,
      DYNAMIC: 1,
      SOFT: 2 // TODO: SoftBody implementation
    } 
  };

  
  var utrans;
  var uquat;

  function vec3bt(a) {
    return new btVector3(a[0],a[1],a[2]);
  }

  function vec3btquat(a) {
    uquat.fromEuler(a[0],a[1],a[2]);
    return new btQuaternion(uquat.x,uquat.y,uquat.z,uquat.w);
  }
  
  function btvec3(a) {
    return [a.x(),a.y(),a.z()];
  }

  var shapeBin = [];

  function generateCollisionShape(rigidBody) {
      var cmap = rigidBody.getCollisionMap();
      var shapes = cmap.getShapes();
      var shape, i, iMax, btShapes = [];   
      
      for (i = 0, iMax = shapes.length; i<iMax; i++) {
        shape = shapes[i];
        
        var btShape = null;
      /*
        //    TODO: optimize shape allocation with a shapeBin:

        if (shape_in.type !== enums.collision.shape.MESH && shapeBin[shape_in.type] === undef) {
          shapeBin[shape_in.type] = [];
        }
        
        var cached = false;

        if (shape_in.type !== enums.collision.shape.MESH) {
          if (!shapeBin[shape_in.type][scale[0]]) shapeBin[shape_in.type][scale[0]] = [];
          if (!shapeBin[shape_in.type][scale[0]][scale[1]]) shapeBin[shape_in.type][scale[0]][scale[1]] = [];
        }
        
        if (shapeBin[shape_in.type][scale[0]][scale[1][scale[2]]) {
          
        } else {
          shapeBin[shape_in.type][scale[0]][scale[1][scale[2]] = shape_in;
        }
      
      */
        
        if (shape.type === enums.collision.shape.BOX) {
          btShape = new btBoxShape(new btVector3(shape.size[0]/2,shape.size[1]/2,shape.size[2]/2));
        } else if (shape.type === enums.collision.shape.SPHERE) {
          btShape = new btSphereShape(shape.radius);
        } else if (shape.type === enums.collision.shape.CAPSULE) {
          btShape = new new btCapsuleShape(shape.radius,shape.height);
        } else if (shape.type === enums.collision.shape.MESH) {
          var mesh = shape.mesh;

          var mTriMesh = new btTriangleMesh();
	
          for (f = 0, fMax = mesh.faces.length; f < fMax; f++)
	        {
	            var face = mesh.faces[i];
	            var scale = shape.size;
	            
		          if (face.points.length !== 3) continue;
		
		          var v0 = new btVector3(mesh.points[face.points[0]][0]*scale[0],mesh.points[face.points[0]][1]*scale[1],mesh.points[face.points[0]][2]*scale[2]); 
		          var v1 = new btVector3(mesh.points[face.points[1]][0]*scale[0],mesh.points[face.points[1]][1]*scale[1],mesh.points[face.points[1]][2]*scale[2]); 
		          var v2 = new btVector3(mesh.points[face.points[2]][0]*scale[0],mesh.points[face.points[2]][1]*scale[1],mesh.points[face.points[2]][2]*scale[2]); 
		
		          mTriMesh.addTriangle(v0,v1,v2);
	          }
	
	          if (rigidBody.getMass() === 0.0 || rigidBody.getType() == enums.physics.body.STATIC)  // static
	          {
	            rigidBody.setMass(0);
		          btShape = new btBvhTriangleMeshShape(mTriMesh,true);
	          }
	          else
	          {
		          btShape = new btConvexTriangleMeshShape(mTriMesh);
	          }
        } else if (shape.type === enums.collision.shape.HEIGHTFIELD) {
            // TODO: Heightfield (optimized for landscape)
        }
        
        if (btShape) {
          if (shape.margin!==0.0) {
            btShape.setMargin(shape.margin);
          }
          btShapes.push({cShape:shape, btShape:btShape});
        }
      }
      
      var btResultShape = null;
        
      if (btShapes.length===1) {  // single shape, just return it
        btResultShape = btShapes[0].btShape;
      } else if (btShapes.length>1) { // compound multi-shape
        utrans = new btTransform();
        btResultShape = new btCompoundShape(false); // not animating internal shape yet, set to false for now

        for (i = 0, iMax=btShapes.length; i < iMax; i++)
        {
          // use relative transform for shape
          utrans.setIdentity();
          utrans.setOrigin(vec3bt(btShapes[i].cShape.position));
          utrans.setRotation(vec3bt(btShapes[i].cShape.rotation));

          btResultShape.addChildShape(utrans,btShapes[i].btShape);
        }
      } // TODO: btMultiSphereShape optimized for sphere clusters

      return btResultShape;
  }

  var RigidProperties = function(obj_init) {
    this.type = (obj_init.type!==undef)?obj_init.type:enums.physics.body.DYNAMIC;
    this.mass = (obj_init.mass!==undef)?obj_init.mass:(this.type?1.0:0.0);
    this.restitution = obj_init.restitution||(this.type?0.0:1.0);
    this.friction = obj_init.friction||1.0;
    this.collision = obj_init.collision;
    if (this.collision && !this.collision.getShapes) {
      this.collision = new CubicVR.CollisionMap(this.collision);
    }
  };

  var RigidBody = function(sceneObj_in,properties_in,cmap_in) {

    this.properties = new CubicVR.RigidProperties(properties_in?properties_in:{});
    this.collisionEvents = [];  // TODO: registration for collision event callbacks during updateSceneObject()
    this.parent = null; // TODO: rigid body parenting with default 6DOF constraint

    this.init_position = sceneObj_in.position.slice(0);
    this.init_rotation = sceneObj_in.rotation.slice(0);
    
    this.sceneObject = sceneObj_in;
    
    this.transform = new btTransform();
    this.transform.setIdentity();
    this.transform.setOrigin(vec3bt(this.init_position));
    this.transform.setRotation(vec3btquat(this.init_rotation));

    this.shape = null;
    this.motionState = new btDefaultMotionState(this.transform);
    this.localInertia = new btVector3(0, 0, 0);
    this.bodyInit = null;
    this.body = null;
  };
  
  
  RigidBody.prototype = {
    getProperties: function() {
      return this.properties;
    },
    getSceneObject: function() {
      return this.sceneObject;      
    },
    getInitialPosition: function() {
      return this.init_position;
    },
    getInitialRotation: function() {
      return this.init_rotation;
    },
    setInitialPosition: function() {
      this.init_position = init_position_in;
    },
    setInitialRotation: function() {
      this.init_rotation = init_rotation_in;
    },
    getType: function() {
      return this.properties.type;
    },
    getMass: function() {
      return this.properties.mass;
    },
    getRestitution: function() {
      return this.properties.restitution;      
    },
    getCollisionMap: function() {
      return this.properties.collision;
    },
    setMass: function(mass_in) {
      this.properties.mass = mass_in;
      // TODO: update collision shape
    },
    setRestitution: function(restitution_in) {
      this.restitution = restitution_in;
      // TODO: update collision shape
    },
    getBody: function() {
      if (!this.body) {
        var shape = this.getCollisionShape();
        if (this.getMass()) {
          shape.calculateLocalInertia(this.getMass(), this.localInertia);
        }
        this.bodyInit = new btRigidBodyConstructionInfo(this.getMass(), this.motionState, shape, this.localInertia);
        this.body = new btRigidBody(this.bodyInit);
      }

      return this.body;
    },
    updateSceneObject: function(pos, quat) {
      if (1||this.body.isActive()) {
        this.body.getMotionState().getWorldTransform(utrans);

        // optional optimization if not using the position/rotation, avoids quaternion conversion
        // var m;  utrans.getOpenGLMatrix(m);  this.sceneObject.tMatrix = m;

        var origin = utrans.getOrigin();
        this.sceneObject.position[0] = origin.x();
        this.sceneObject.position[1] = origin.y();
        this.sceneObject.position[2] = origin.z();

        var quat_rotation = utrans.getRotation();
        uquat.x = quat_rotation.x();
        uquat.y = quat_rotation.y();
        uquat.z = quat_rotation.z();
        uquat.w = quat_rotation.w();
        
        if (uquat.x != uquat.x) {
          // Nan?          
        } else {
          var rotation = uquat.toEuler();
          this.sceneObject.rotation[0] = rotation[0];
          this.sceneObject.rotation[1] = rotation[1];
          this.sceneObject.rotation[2] = rotation[2];
        }
                
        return true;
      }
      
      return false;
    },
    getCollisionShape: function() {
      if (!this.shape) {
          this.shape = generateCollisionShape(this);
      }
      return this.shape;
    }
  };


  var ScenePhysics = function() {
    this.rigidObjects = [];
    this.active_count = 0;
    
    this.collisionConfiguration = new btDefaultCollisionConfiguration();
    this.dispatcher = new btCollisionDispatcher(this.collisionConfiguration);
    this.overlappingPairCache = new btDbvtBroadphase();
    this.solver = new btSequentialImpulseConstraintSolver();
    this.dynamicsWorld = new btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);
    this.dynamicsWorld.setGravity(new btVector3(0, -10, 0));    
    
    if (!utrans || !uquat) {
      utrans = new btTransform();
      uquat = new CubicVR.Quaternion();
    }
  };

    
  ScenePhysics.prototype = {
    bindSceneObject: function(sceneObject_in,physProperties_in) {
      var rigidBody = new CubicVR.RigidBody(sceneObject_in,physProperties_in);
      this.rigidObjects.push(rigidBody);

      rigidBody.getBody().activate();

      this.dynamicsWorld.addRigidBody(rigidBody.getBody());

      
      return rigidBody;
    },
    bindRigidBody: function(rigidBody_in) {
      if (this.rigidObjects.indexOf(rigidBody_in) !== -1) return;
      this.rigidObjects.push(rigidBody_in);
      
      var body = rigidBody_in.getBody();
      body.activate();
     
      this.dynamicsWorld.addRigidBody(body);
    },
    getActiveCount: function() {
      return this.active_count;
    },
    stepSimulation: function(lus,substep) {
      this.dynamicsWorld.stepSimulation(lus, substep||2);

      var active_count = 0;
      
      for (var i = 0, iMax = this.rigidObjects.length; i<iMax; i++) {
        var rb = this.rigidObjects[i];
        
        if (rb.updateSceneObject()) {
          active_count++;
        }
      }
      
      this.active_count = active_count;
    }      
  };
  
  
  var extend = {
    ScenePhysics: ScenePhysics,
    RigidProperties: RigidProperties,
    RigidBody: RigidBody
  };
  
  return extend;
});


/*

	// TODO: handle collision contact callbacks	
	virtual void handleCollision(ScenePhysicsObject *collision_obj, btPersistentManifold &manifold);

*/

