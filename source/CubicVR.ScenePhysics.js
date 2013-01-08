CubicVR.RegisterModule("ScenePhysics",function(base) {

  var undef = base.undef;
  var util = base.util;
  var vec3 = base.vec3;
  var enums = base.enums;
  var nop = base.nop;

  enums.physics = {
    body: {
      STATIC: 0,
      DYNAMIC: 1,
      GHOST: 2,
      SOFT: 3 // TODO: SoftBody implementation
    },
    constraint: {
      P2P: 0      
    },
    collision_flags: {
      STATIC_OBJECT: 1,
      KINEMATIC_OBJECT: 2,
      NO_CONTACT_RESPONSE: 4,       //object->hasContactResponse()
      CUSTOM_MATERIAL_CALLBACK: 8,  //this allows per-triangle material (friction/restitution)
      CHARACTER_OBJECT: 16,
      DISABLE_VISUALIZE_OBJECT: 32  //disable debug drawing
    },
    rigid_flags: {
      DISABLE_WORLD_GRAVITY: 1
    },
    collision_types: {
      COLLISION_OBJECT: 1,
      RIGID_BODY: 2,
      GHOST_OBJECT: 3,
      SOFT_BODY: 4,
      HF_FLUID: 5      
    },
    collision_states: {
      ACTIVE_TAG: 1,
      ISLAND_SLEEPING: 2,
      WANTS_DEACTIVATION: 3,
      DISABLE_DEACTIVATION: 4,
      DISABLE_SIMULATION: 5
    }
  };

  
  var utrans;
  var uquat, ubtquat;
  var uvec,uvec2;

  function vec3bt_copy(a,b) {
    b.setX(a[0]);
    b.setY(a[1]);
    b.setZ(a[2]);
  }

  function btvec3_copy(a,b) {
    b[0] = a.x();
    b[1] = a.y();
    b[2] = a.z();    
  }

  function quatbt_copy(a,b) {
    b.setX(a.x);
    b.setY(a.y);
    b.setZ(a.z);
    b.setW(a.w);
  }

  function btquat_copy(a,b) {
    b.x = a.x();
    b.y = a.y();
    b.z = a.z();    
    b.w = a.w();    
  }


  function vec3bt(a) {
    return new Ammo.btVector3(a[0],a[1],a[2]);
  }

  function vec3btquat(a) {
//    uquat.fromEuler(a[0],a[1],a[2]);
    var q = new Ammo.btQuaternion();
    q.setEulerZYX(a[2]*(Math.PI/180.0),a[1]*(Math.PI/180.0),a[0]*(Math.PI/180.0));
    return q;
  }

  function vec3quat(a) {
    uquat.fromEuler(a[0],a[1],a[2]);
    return [uquat.x,uquat.y,uquat.z,uquat.w];
  }
  
  function btvec3(a) {
    return [a.x(),a.y(),a.z()];
  }

  var shapeBin = [];

  function generateCollisionShape(rigidBody) {
      var cmap = rigidBody.getCollisionMap();
      if (cmap.getResult()) return cmap.getResult();
      
      var shapes = cmap.getShapes();
      var shape, i, iMax, f, fMax, scale, mesh, btShapes = [];   
      var btShape = null;
      
      for (i = 0, iMax = shapes.length; i<iMax; i++) {
        shape = shapes[i];
        btShape = null;
        
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
          btShape = new Ammo.btBoxShape(new Ammo.btVector3(shape.size[0]/2,shape.size[1]/2,shape.size[2]/2));
        } else if (shape.type === enums.collision.shape.SPHERE) {
          btShape = new Ammo.btSphereShape(shape.radius);
        } else if (shape.type === enums.collision.shape.CAPSULE) {
          btShape = new Ammo.btCapsuleShape(shape.radius,shape.height);
        } else if (shape.type === enums.collision.shape.CYLINDER) {
          btShape = new Ammo.btCylinderShape(new Ammo.btVector3(shape.size[0]/2,shape.size[1]/2,shape.size[2]/2));
        } else if (shape.type === enums.collision.shape.CONE) {
          btShape = new Ammo.btConeShape(shape.radius,shape.height);
        } else if (shape.type === enums.collision.shape.MESH) {
          mesh = shape.mesh;

          var mTriMesh = new Ammo.btTriangleMesh();

          scale = shape.size;

          var v0 = new Ammo.btVector3(0,0,0);
          var v1 = new Ammo.btVector3(0,0,0); 
          var v2 = new Ammo.btVector3(0,0,0); 
    
          var mats = mesh.getMaterials();

          for (f = 0, fMax = mesh.faces.length; f < fMax; f++)
          {
              var face = mesh.faces[f];
              var mat = mats[face.material];
              if (!mat.collision) continue;
              
              if (face.points.length !== 3) continue;

              v0.setValue(mesh.points[face.points[0]][0]*scale[0],mesh.points[face.points[0]][1]*scale[1],mesh.points[face.points[0]][2]*scale[2]);
              v1.setValue(mesh.points[face.points[1]][0]*scale[0],mesh.points[face.points[1]][1]*scale[1],mesh.points[face.points[1]][2]*scale[2]);
              v2.setValue(mesh.points[face.points[2]][0]*scale[0],mesh.points[face.points[2]][1]*scale[1],mesh.points[face.points[2]][2]*scale[2]);
    
              mTriMesh.addTriangle(v0,v1,v2);
            }
  
            if (rigidBody.getMass() === 0.0 || rigidBody.getType() == enums.physics.body.STATIC || rigidBody.getType() == enums.physics.body.GHOST)  // static
            {
              rigidBody.setMass(0);
              // btScaledBvhTriangleMeshShape -- if scaled instances
              btShape = new Ammo.btBvhTriangleMeshShape(mTriMesh,true);
            }
            else
            { 
              // btGimpactTriangleMeshShape -- complex?
              // btConvexHullShape -- possibly better?
              btShape = new Ammo.btConvexTriangleMeshShape(mTriMesh,true);
            }
        } else if (shape.type === enums.collision.shape.CONVEX_HULL) {
          mesh = shape.mesh;
          scale = shape.size;

          var v = new Ammo.btVector3(0,0,0);
          btShape = new Ammo.btConvexHullShape();

          for (f = 0, fMax = mesh.points.length; f < fMax; f++)
          {
            vec3bt_copy([mesh.points[f][0]*scale[0],mesh.points[f][1]*scale[1],mesh.points[f][2]*scale[2]],v);
            btShape.addPoint(v);
          }
        } else if (shape.type === enums.collision.shape.HEIGHTFIELD) {
            mesh = shape.mesh;
            var xdiv = 0, xsize = 0;
            var zdiv = 0, zsize = 0;
            var points,heightfield;

            // allow heightfield type patch-over
            if (shape.landscape && !shape.getHeightField && shape.landscape instanceof base.HeightField) {
                shape.heightfield = shape.landscape;    // patch
            } else if (shape.landscape && shape.landscape instanceof base.Landscape) {
              xdiv = shape.landscape.getHeightField().getDivX();
              zdiv = shape.landscape.getHeightField().getDivZ();
              xsize = shape.landscape.getHeightField().getSizeX();
              zsize = shape.landscape.getHeightField().getSizeZ();
              points = shape.landscape.getHeightField().getFloat32Buffer();
              heightfield = shape.landscape.getHeightField();

              // TODO: store this pointer for doing updates!
              // todo: convert this to use the heightfield data, not the mesh data...
              var ptr = Ammo.allocate(points.length*4, "float", Ammo.ALLOC_NORMAL);

              for (f = 0, fMax = xdiv*zdiv; f < fMax; f++) {
  //              Ammo.HEAPF32[(ptr>>2)+f] = points[f][1];   // also works in place of next line
                Ammo.setValue(ptr+(f<<2), points[f], 'float');
  //              console.log(Ammo.getValue(ptr+(f<<2), 'float'));
              }

            } 
            
            // heightfield direct
            if (shape.heightfield && shape.heightfield instanceof base.HeightField) {
              xdiv = shape.heightfield.getDivX();
              zdiv = shape.heightfield.getDivZ();
              xsize = shape.heightfield.getSizeX();
              zsize = shape.heightfield.getSizeZ();
              points = shape.heightfield.getFloat32Array(); //.getMesh().points;  // todo: eliminate this, not needed with new heightfield
              heightfield = shape.heightfield;

              var ptr = Ammo.allocate(points.length*4, "float", Ammo.ALLOC_NORMAL);

              for (f = 0, fMax = xdiv*zdiv; f < fMax; f++) {
                Ammo.setValue(ptr+(f<<2), points[f], 'float');
              }
            }

            var upIndex = 1; 
	        var maxHeight = 100;	
	        var flipQuadEdges=false;


/* 
            var ptr = Ammo.allocate(points.length*8, "double", Ammo.ALLOC_NORMAL);
            var heapf64 = new Float64Array(Ammo.HEAPF32.buffer);
            for (f = 0, fMax = xdiv*zdiv; f < fMax; f++) {
                heapf64[(ptr>>3)+f] = points[f][1];
//                Ammo.setValue(ptr+(f<<3), points[f][1], 'double');
//                console.log(Ammo.getValue(ptr+(f<<3), 'double'));
            }
*/

            var scalarType = {
                FLOAT: 0,
                DOUBLE: 1,
                INTEGER: 2,
                SHORT: 3,
                FIXEDPOINT88: 4,
                UCHAR: 5
            };

	        btShape = new Ammo.btHeightfieldTerrainShape(xdiv, zdiv, ptr, 1, -maxHeight, maxHeight, upIndex, scalarType.FLOAT, flipQuadEdges);
//	        btShape = new Ammo.btHeightfieldTerrainShape(xdiv, zdiv, ptr, 1, -maxHeight, maxHeight, upIndex, scalarType.DOUBLE, flipQuadEdges);

	        btShape.setUseDiamondSubdivision(true);

            var localScaling = new Ammo.btVector3(xsize/(xdiv),1,zsize/(zdiv));

	        btShape.setLocalScaling(localScaling);

	        // todo: investigate why we're 1/2 cell size off of ammo heightfield..
            // patch start
            // utrans = new Ammo.btTransform();
            // btMetaShape = new Ammo.btCompoundShape(false);
            // 
            // utrans.setIdentity();
            // utrans.setOrigin(vec3bt([-heightfield.getCellSize()/2,0,-heightfield.getCellSize()/2]));
            // 
            // btMetaShape.addChildShape(utrans,btShape);
            // btShape = btMetaShape;
            // patch end
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
        utrans = new Ammo.btTransform();
        btResultShape = new Ammo.btCompoundShape(false); // not animating internal shape yet, set to false for now

        for (i = 0, iMax=btShapes.length; i < iMax; i++)
        {
          // use relative transform for shape
          utrans.setIdentity();
          utrans.setOrigin(vec3bt(btShapes[i].cShape.position));
          utrans.setRotation(vec3btquat(btShapes[i].cShape.rotation));

          btResultShape.addChildShape(utrans,btShapes[i].btShape);
        }
      } // TODO: btMultiSphereShape optimized for sphere clusters

      // cache the completed shape for collision map re-use
      cmap.setResult(btResultShape);

      return btResultShape;
  }

  var RigidProperties = function(obj_init) {
    this.type = base.parseEnum(enums.physics.body,obj_init.type);
    this.mass = (obj_init.mass!==undef)?obj_init.mass:(this.type?1.0:0.0);
    this.size = obj_init.size||[1,1,1];
    this.restitution = obj_init.restitution||(this.type?0.0:1.0);
    this.friction = obj_init.friction||1.0;
    this.collision = obj_init.collision;
    if (this.collision && !this.collision.getShapes) {
      this.collision = new base.CollisionMap(this.collision);
    }
    this.blocker = obj_init.blocker||false;
  };

  var RigidBody = function(sceneObj_in,properties_in,cmap_in) {
    
    var obj_init;

    if (!sceneObj_in.position && sceneObj_in.sceneObject) {
      obj_init = sceneObj_in;
      sceneObj_in = sceneObj_in.sceneObject;
      properties_in = obj_init.properties;
      cmap_in = obj_init.collision;
    }

    obj_init = base.get(obj_init) || {};


    this.properties = new base.RigidProperties(properties_in?base.get(properties_in):{collision:cmap_in});
    this.collisionEvents = [];  // TODO: registration for collision event callbacks during updateSceneObject()
    this.parent = null; // TODO: rigid body parenting with default 6DOF constraint

    this.init_position = sceneObj_in.position.slice(0);
    this.init_rotation = sceneObj_in.rotation.slice(0);
    this.init_linearVelocity = this.linearVelocity = obj_init.linearVelocity||[0,0,0];
    this.init_angularVelocity = this.angularVelocity = obj_init.angularVelocity||[0,0,0];
    this.init_impulse = this.impulse = obj_init.impulse||[0,0,0];
    this.init_impulsePosition = this.impulsePosition = obj_init.impulsePosition||[0,0,0];

    this.rigid_flags = null;
    this.collision_flags = null;
    
    this.sceneObject = sceneObj_in;
    
    this.transform = new Ammo.btTransform();
    this.transform.setIdentity();
    this.transform.setOrigin(vec3bt(this.init_position));
    this.transform.setRotation(vec3btquat(this.init_rotation));

    this.shape = null;
    this.motionState = new Ammo.btDefaultMotionState(this.transform);
    this.localInertia = new Ammo.btVector3(0, 0, 0);
    this.bodyInit = null;
    this.body = null;
    this.ghost = null;
    this.noDeactivate = false;
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
      if (this.body) {
          this.body.setMassProps(mass_in,this.localInertia);
      }
      // TODO: update collision shape
    },
    setRestitution: function(restitution_in) {
      this.restitution = restitution_in;
      // TODO: update collision shape
    },
    getBody: function() {
      if (!this.body && !this.ghost) {
        var shape = this.getCollisionShape();
        
        if (this.getType() === enums.physics.body.GHOST) {
          this.body = null;
          this.ghost = new Ammo.btGhostObject();
          
          this.ghost.setCollisionShape(shape);
          this.ghost.setWorldTransform(this.transform);
          this.ghost._cvr_rigidbody = this;
        } else {
          if (this.getMass()) {
            shape.calculateLocalInertia(this.getMass(), this.localInertia);
          }
          this.bodyInit = new Ammo.btRigidBodyConstructionInfo(this.getMass(), this.motionState, shape, this.localInertia);
          if (this.friction) {
            this.bodyInit.set_m_friction(this.friction);
          }
          this.body = new Ammo.btRigidBody(this.bodyInit);
          if (this.getRestitution()) {
            this.body.setRestitution(this.getRestitution());
          }

          vec3bt_copy(this.linearVelocity,uvec);
          this.body.setLinearVelocity(uvec);
          vec3bt_copy(this.angularVelocity,uvec);
          this.body.setAngularVelocity(uvec);
          if (!base.vec3.equal([0,0,0],this.impulse)) {
            vec3bt_copy(this.impulse,uvec);
            vec3bt_copy(this.impulsePosition,uvec2);
            this.body.applyImpulse(uvec,uvec2);
          }
          
          if (this.rigid_flags) {
            this.body.setFlags(this.rigid_flags);
          }
          if (this.collision_flags) {
            this.body.setFlags(this.collision_flags);          
          }
          this.body._cvr_rigidbody = this;
        }

//        Ammo.wrapPointer(this.body,Ammo.btRigidBody)._cvr_ref = this;
//        this.body._sceneObject = this.sceneObject;
      }

      return this.body||this.ghost;
    },
    updateSceneObject: function(force_update) {
      if (!this.body) return;
      if (this.body.isActive() || force_update) {
        this.body.getMotionState().getWorldTransform(utrans);

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
    reset: function(pos, quat) {
        if (!this.body) return;
        
        var origin = this.body.getWorldTransform().getOrigin();

        vec3bt_copy(this.init_position,origin);
  
        var rotation = this.body.getWorldTransform().getRotation();

        this.resetMotion();

		var rotq = vec3quat(this.init_rotation);

        ubtquat.setX(rotq[0]);
        ubtquat.setY(rotq[1]);
        ubtquat.setZ(rotq[2]);
        ubtquat.setW(rotq[3]);

        this.body.getWorldTransform().setRotation(ubtquat);

        this.activate();
    },
    resetMotion: function() {
        vec3bt_copy(this.init_linearVelocity,uvec);
        this.body.setLinearVelocity(uvec);
        vec3bt_copy(this.init_angularVelocity,uvec);
        this.body.setAngularVelocity(uvec);
        if (!base.vec3.equal([0,0,0],this.init_impulse)) {
          vec3bt_copy(this.init_impulse,uvec);
          vec3bt_copy(this.init_impulsePosition,uvec2);
          this.body.applyImpulse(uvec,uvec2);
        }
    },
    getCollisionShape: function() {
      if (!this.shape) {
          this.shape = generateCollisionShape(this);
      }
      return this.shape;
    },
    setAngularVelocity: function(vel) {
      this.angularVelocity = vel;
      if (!this.body) return;
      vec3bt_copy(vel,uvec);
      this.body.setAngularVelocity(uvec);
    },
    setGravity: function(acc) {
      this.gravity = acc;
      if (!this.body) return;
      vec3bt_copy(acc,uvec);
      this.body.setGravity(uvec);
    },
    getGravity: function() {
      if (this.gravity && !this.body) return this.gravity;      
      return btvec3(this.body.getGravity());
    },
    setLinearVelocity: function(vel) {
      this.linearVelocity = vel;
      if (!this.body) return;
      vec3bt_copy(vel,uvec);
      this.body.setLinearVelocity(uvec);
    },
    applyImpulse: function(impulse, impulsePosition) {
       this.impulse = impulse||[0,0,0];
       this.impulsePosition = impulsePosition||[0,0,0];
       if (!this.body) return;
       if (!base.vec3.equal([0,0,0],impulse)) {
          vec3bt_copy(this.impulse,uvec);
          vec3bt_copy(this.impulsePosition,uvec2);
          this.body.applyImpulse(uvec,uvec2);
        }
    },
    applyForce: function(force, forcePosition) {
       if (!this.body) return;
       if (!base.vec3.equal([0,0,0],force)) {
          vec3bt_copy(force,uvec);
          vec3bt_copy(forcePosition,uvec2);
          this.body.applyImpulse(uvec,uvec2);
        }
    },
    getAngularVelocity: function() {
      return btvec3(this.body.getAngularVelocity());
    },
    getLinearVelocity: function() {
      return btvec3(this.body.getLinearVelocity());
    },
    activate: function(noDeactivate) {
      this.noDeactivate = noDeactivate||false;
      
      if (this.body) {
        if (this.noDeactivate) {
          this.body.setActivationState(enums.physics.collision_states.DISABLE_DEACTIVATION);
        }      
        
        this.body.activate();        
      }
    },
    setAngularFactor: function(angFactor) {
      if (this.body && (angFactor!==undef)) {
          if (!angFactor.length) {
            angFactor = [angFactor,angFactor,angFactor];            
          }
          vec3bt_copy(angFactor,uvec);
          this.body.setAngularFactor(uvec);
      }
    },
    isActive: function() {
      if (this.body) {
        return this.body.isActive();
      } else {
        return false;
      }
    },
    isStatic: function() {
      return (this.properties.type == enums.physics.body.STATIC);
    },
    setRigidFlags: function(flags) {
        this.rigid_flags = flags;
    
        if (this.body) {
          this.body.setFlags(flags);
        }
    },
    setCollisionFlags: function(flags) {
        flags = base.parseEnum(enums.physics.collision_flags,flags);
        this.collision_flags = flags;
        
        if (this.body) {
          this.body.setCollisionFlags(flags);
        }          
    },

    setPosition: function(in_pos) {
      this.position = in_pos;

      if (!this.body && !this.ghost) return;

      vec3bt_copy(in_pos,uvec);

      if (this.body) {
        this.body.getCenterOfMassTransform().setOrigin(uvec);
      }
      if (this.ghost) {
        this.ghost.getWorldTransform().setOrigin(uvec);
      }
    },
    
    getRotation: function() {
      if (!this.body && !this.ghost) return this.init_rotation;
      
      if (this.body) {   
        this.body.getCenterOfMassTransform().getRotation(ubtquat);
      }
      
      if (this.ghost) {
        this.ghost.getWorldTransform().getRotation(ubtquat);
      }
      
      var q = new base.Quaternion();
                  
      btquat_copy(ubtquat,q);
      
      return q;
    },
    setRotation: function(in_quat) {
      this.rotation = in_quat.toEuler();

      if (!this.body && !this.ghost) return;

      quatbt_copy(in_quat,ubtquat);
      
      if (this.body) {
        this.body.getCenterOfMassTransform().setRotation(ubtquat);
      }
      if (this.ghost) {
        this.ghost.getWorldTransform().setRotation(ubtquat);
      }
    },
    getRotationEuler: function() {
      if (!this.body && !this.ghost) return this.init_rotation;

      var q = new base.Quaternion();
      
      if (this.body) {      
        this.body.getCenterOfMassTransform().getRotation(ubtquat);
      }
      if (this.ghost) {
        this.ghost.getWorldTransform().getRotation(ubtquat);
      }
                  
      btquat_copy(ubtquat,q);
      
      return q.toEuler();
    },
    setRotationEuler: function(in_rot) {
      this.rotation = in_rot;

      ubtquat.setEuler(this.rotation[2]*(Math.PI/180.0),this.rotation[1]*(Math.PI/180.0),this.rotation[0]*(Math.PI/180.0));
      
      if (this.body) {
        this.body.getCenterOfMassTransform().setRotation(ubtquat);        
      } 
      if (this.ghost) {
        this.body.getWorldTransform().setRotation(ubtquat);        
      }
    }
  };


//  var staticBody;

  var Constraint = function(obj_init) {
                // btHingeConstraint
            obj_init = obj_init||{};
                
            this.ctype = base.parseEnum(enums.physics.constraint,obj_init.ctype)||enums.physics.constraint.P2P;
            this.strength = obj_init.strength||0.1;
            this.maxImpulse = obj_init.maxImpulse||0;
            this.rigidBodyA = (obj_init.rigidBodyA||obj_init.rigidBody)||null;
            this.rigidBodyB = obj_init.rigidBodyB||null;
            this.positionA = obj_init.positionA||[0,0,0];
            this.positionB = obj_init.positionB||obj_init.position||[0,0,0];
            this.damping = (obj_init.damping!=undef)?obj_init.damping:1;
            this.btConstraint = null;
            this.localPivotA = vec3bt(this.positionA);
            this.localPivotB = vec3bt(this.positionB);

//          Hack for when constructor overload was broken..
            
/*            if (!staticBody) {
              var bodyInit = new Ammo.btRigidBodyConstructionInfo(0, NULL, NULL, NULL);
              staticBody = new Ammo.btRigidBody(bodyInit);
              staticBody.setMassProps(0,new Ammo.btVector3(0,0,0));
            }*/
  };

  Constraint.prototype = {
    getConstraint: function() {
      if (!this.btConstraint) {      
          if (!this.rigidBodyA) {
            return false;
          }

          if (this.ctype === enums.physics.constraint.P2P) {            
//          Hack for when constructor overload was broken..
//            this.btConstraint = new Ammo.btPoint2PointConstraint(this.rigidBodyA.getBody(),staticBody,this.localPivotA,this.localPivotB);
            if (this.rigidBodyA && this.rigidBodyB) { // connect two rigid bodies via p2p if provided
              this.btConstraint = new Ammo.btPoint2PointConstraint(this.rigidBodyA.getBody(),this.rigidBodyB.getBody(),this.localPivotA,this.localPivotB);
            } else {  // otherwise assume we're just constraining with pivot B
              this.btConstraint = new Ammo.btPoint2PointConstraint(this.rigidBodyA.getBody(),this.localPivotA);
            }
             
//            this.btConstraint.setPivotA(this.localPivotA);
//            this.btConstraint.setPivotB(this.localPivotB);
            this.btConstraint.get_m_setting().set_m_tau(this.strength);
            this.btConstraint.get_m_setting().set_m_damping(this.damping);
            if (this.maxImpulse) {
              this.btConstraint.get_m_setting().set_m_impulseClamp(this.maxImpulse);
            }

            if (this.btConstraint === Ammo.NULL) {
              this.btConstraint = null;              
            }            
          } 
       }

       return this.btConstraint;
    },
    setStrength: function(strength) {
      this.strength = strength;
      if (this.btConstraint) {
       this.btConstraint.get_m_setting().set_m_tau(this.strength);
      }
    },
    setDamping: function(damping) {
      this.damping = damping;
      if (this.btConstraint) {
       this.btConstraint.get_m_setting().set_damping(this.damping);
      }
    },
    setMaxImpulse: function(maxImpulse) {
      this.maxImpulse = maxImpulse;
      if (this.btConstraint) {
       this.btConstraint.get_m_setting().set_impulseClamp(this.maxImpulse);
      }
    },
    getStrength: function() {
      return this.strength;      
    },
    setPosition: function(p) {
      this.positionB = p;
      if (this.btConstraint) {
        vec3bt_copy(this.positionB,this.localPivotB);
        this.btConstraint.setPivotB(this.localPivotB);
      }
    },
    getPosition: function() {      
      return this.positionB;
    }
    
  };

  function ContactManifold(contactManifold) {
      this.setManifold(contactManifold);
   }
   
   ContactManifold.prototype = {
      getContact: function(contactNum) {
        var pt = this.manifold.getContactPoint(j); // btManifoldPoint

        if (pt === Ammo.NULL) return null;

        var contact = {
          impulse: pt.getAppliedImpulse(),
          lifetime: pt.getLifeTime(),
          friction: pt.get_m_combinedFriction(),
          positionA: btvec3(pt.getPositionWorldOnA()),
          positionB: btvec3(pt.getPositionWorldOnB())
        };
        
        return contact;
      },
      setManifold: function(contactManifold) {        
        this.numContacts = contactManifold.getNumContacts();
        this.manifold = contactManifold;
      }
   };



  var ScenePhysics = function(world_aabb_min,world_aabb_max) {
    this.rigidObjects = [];
    this.ghostObjects = [];
    this.contactObjects = [];
    this.collisionObjects = [];
    this.active_count = 0;
    
    this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);

/*
  // SLOOOOOWWWW -- do not recommend..
    this.maxProxies = 4096;
    this.aabbmin = world_aabb_min||[-1000,-1000,-1000];
    this.aabbmax = world_aabb_max||[1000,1000,1000];

    this.overlappingPairCache = new btAxisSweep3(vec3bt(this.aabbmin),vec3bt(this.aabbmax),this.maxProxies);
*/

    this.overlappingPairCache = new Ammo.btDbvtBroadphase();

    this.solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);
    this.dynamicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));        
    this.overlappingPairCache.getOverlappingPairCache().setInternalGhostPairCallback(new Ammo.btGhostPairCallback());
    
    if (!utrans || !uquat) {
      uvec = new Ammo.btVector3();
      uvec2 = new Ammo.btVector3();
      utrans = new Ammo.btTransform();
      uquat = new base.Quaternion();
      ubtquat = new Ammo.btQuaternion();
    }
  };

    
  ScenePhysics.prototype = {
    addConstraint: function(constraint) {
        var btConstraint = constraint.getConstraint();
     
        if (btConstraint) {
           this.dynamicsWorld.addConstraint(btConstraint);
//          btConstraint.get_m_setting().set_m_tau(constraint.getStrength());
//          constraint.rigidBodyA.getBody().setActivationState(enums.physics.collision_states.ACTIVE_TAG);
          constraint.rigidBodyA.activate(true);
          return true;
        }   
        
        return false;
    },
    removeConstraint: function(constraint) {
        var btConstraint = constraint.getConstraint();
     
        if (btConstraint) {
           this.dynamicsWorld.removeConstraint(btConstraint);
          return true;
        }   
        
        return false;
    },
    setGravity: function(grav) {
      vec3bt_copy(grav,uvec);
      this.dynamicsWorld.setGravity(uvec);    
    },
    bindSceneObject: function(sceneObject_in,physProperties_in) {
      var rigidBody = new base.RigidBody(sceneObject_in,physProperties_in);
      this.rigidObjects.push(rigidBody);
      
      var body = rigidBody.getBody();

      rigidBody.activate();

      this.dynamicsWorld.addRigidBody(rigidBody.getBody());

      rigidBody.updateSceneObject(true);
        
      return rigidBody;
    },
    bind: function(obj) {
      if (obj instanceof base.Vehicle) {
        obj.initBody(this);
      } else if (obj instanceof base.RigidBody) {
        this.bindRigidBody(obj);
      }
    },
    remove: function(obj) {
      if (obj instanceof base.RigidBody) {
        this.removeRigidBody(obj);
      }
    },
    bindRigidBody: function(rigidBody_in) {
      if (rigidBody_in.getType()===enums.physics.body.GHOST) {
        if (this.ghostObjects.indexOf(rigidBody_in) !== -1) return;
        this.ghostObjects.push(rigidBody_in);

        var ghost = rigidBody_in.getBody();
        
        if (!rigidBody_in.properties.blocker) {
          ghost.setCollisionFlags(ghost.getCollisionFlags() + enums.physics.collision_flags.NO_CONTACT_RESPONSE);
        }
        this.dynamicsWorld.addCollisionObject(ghost);
      } else {
        if (this.rigidObjects.indexOf(rigidBody_in) !== -1) return;
        this.rigidObjects.push(rigidBody_in);
    
        var body = rigidBody_in.getBody();
    
        rigidBody_in.activate();
       
        this.dynamicsWorld.addRigidBody(body);

        rigidBody_in.updateSceneObject(true);
      }
      
      var sceneObj,evh;
      if (!!(sceneObj = rigidBody_in.getSceneObject()) && !!(evh = sceneObj.getEventHandler())) {

        if (evh.hasEvent(enums.event.CONTACT)) {        
            this.contactObjects.push(rigidBody_in);
        }
        if (evh.hasEvent(enums.event.COLLIDE)) {        
            this.collisionObjects.push(rigidBody_in);
        }
      }
    },
    removeRigidBody: function(rigidBody_in) {
      if (rigidBody_in.getType()===enums.physics.body.GHOST) {
        if (this.ghostObjects.indexOf(rigidBody_in) === -1) return;
        this.ghostObjects.splice(this.ghostObjects.indexOf(rigidBody_in),1);

        var ghost = rigidBody_in.getBody();
        
        this.dynamicsWorld.removeCollisionObject(ghost);
      } else {
        if (this.rigidObjects.indexOf(rigidBody_in) === -1) return;
        this.rigidObjects.splice(this.rigidObjects.indexOf(rigidBody_in),1);
    
        var body = rigidBody_in.getBody();
    
        this.dynamicsWorld.removeRigidBody(body);
      }
      
      var sceneObj,evh;
      if (!!(sceneObj = rigidBody_in.getSceneObject()) && !!(evh = sceneObj.getEventHandler())) {
        if (evh.hasEvent(enums.event.CONTACT)) {
            if (this.contactObjects.indexOf(rigidBody_in) !== -1) {
                this.contactObjects.splice(this.contactObjects.indexOf(rigidBody_in),1);                    
            }
        }
        if (evh.hasEvent(enums.event.COLLIDE)) {        
            if (this.collisionObjects.indexOf(rigidBody_in) !== -1) {
                this.collisionObjects.splice(this.collisionObjects.indexOf(rigidBody_in),1);                    
            }
        }
      }
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
    },
    triggerEvents: function() {
      var i,j,evh,prop,sceneObj;
      var world = this.dynamicsWorld;
      
      if (this.contactObjects.length) {        
          var numManifolds = world.getDispatcher().getNumManifolds();
		
		    for (i=0; i<numManifolds; i++) {
			    var contactManifold = world.getDispatcher().getManifoldByIndexInternal(i);  //btPersistentManifold			
			    var obj0 = Ammo.wrapPointer(contactManifold.getBody0(),Ammo.btRigidBody); //btRigidBody						
          var rb0 = obj0._cvr_rigidbody||null;

			    var obj1 = Ammo.wrapPointer(contactManifold.getBody1(),Ammo.btRigidBody); //btRigidBody
          var rb1 = obj1._cvr_rigidbody||null;

			    if (!!rb0 && !!(sceneObj = rb0.getSceneObject()) && !!(evh = sceneObj.getEventHandler()) && evh.hasEvent(enums.event.CONTACT)) {
            prop = evh.triggerEvent(enums.event.CONTACT);
            prop.self = rb0;
            prop.other = rb1;
            
            if (prop.contacts) prop.contacts.setManifold(contactManifold);
            else prop.contacts = new ContactManifold(contactManifold);
          } else if (!!rb1 && rb1.isStatic() && !!(sceneObj = rb1.getSceneObject()) && !!(evh = sceneObj.getEventHandler()) && evh.hasEvent(enums.event.CONTACT)) {
              prop = evh.triggerEvent(enums.event.CONTACT);
              prop.other = rb0;
              prop.self = rb1;
              
              if (prop.contacts) prop.contacts.setManifold(contactManifold);
              else prop.contacts = new ContactManifold(contactManifold);
          }
		    }
      }		  
   
      var numCollision = this.collisionObjects.length;
      for (i = 0; i < numCollision; i++) {
        var cobj = this.collisionObjects[i];
        if (!!(sceneObj = cobj.getSceneObject()) && !!(evh = sceneObj.getEventHandler()) && evh.hasEvent(enums.event.COLLIDE)) {
          var evp = evh.getProperties(enums.event.COLLIDE);
          var collidesWith = evp.collidesWith; 
          evp.mf = evp.mf||[];
          evp.alg = evp.alg||[];

          if (collidesWith && collidesWith.length) {
            var collisions = [];
            var body0 = cobj.getBody();
          
            for (i = 0, iMax = collidesWith.length; i<iMax; i++) {
              var cw = collidesWith[i];
              var body1 = cw.getBody();

              
              if (!evp.mf[i]) evp.mf[i] = new Ammo.btManifoldResult(body0,body1);
              if (!evp.alg[i]) evp.alg[i] = this.dynamicsWorld.getDispatcher().findAlgorithm(body0,body1);
             evp.alg[i].processCollision(body0, body1, this.dynamicsWorld.getDispatchInfo(), evp.mf[i]);
              
              if (evp.mf[i].getPersistentManifold().getNumContacts()>0) {
                  collisions.push(cw);
                  this.dynamicsWorld.getDispatcher().clearManifold(evp.mf[i].getPersistentManifold()); // drop the manifold or we get a feedback collision response..
              }
            }
           
            if (collisions.length) {
              prop = evh.triggerEvent(enums.event.COLLIDE);
              if (prop) {
                prop.collisions = collisions;
              }
            } 
          }
        }
      }
   
      
		  var numGhosts = this.ghostObjects.length;
		  
		  for (i = 0; i < numGhosts; i++) {
		    var ghost = this.ghostObjects[i];
		    sceneObj = ghost.getSceneObject();
		    
		    if (sceneObj) {
		      evh = sceneObj.getEventHandler();
		      if (evh && evh.hasEvent(enums.event.CONTACT_GHOST)) {
            var ghostBody = ghost.getBody();
            var numOverlaps = ghostBody.getNumOverlappingObjects();
            if (numOverlaps) {
                          prop = evh.triggerEvent(enums.event.CONTACT_GHOST);
		          prop.contacts = prop.contacts||[];

		          if (prop.contacts.length > numOverlaps) {
		            prop.contacts.length = numOverlaps;
		          }
		          
              for(j = 0; j < numOverlaps; j++)
              {
                 var contactBody = Ammo.btRigidBody.prototype.upcast(ghostBody.getOverlappingObject(j));                
                 prop.contacts[j] = contactBody._cvr_rigidbody||null;
              }            
            }		        
		      }
		    }
		  }
    },
    reset: function() {
      for (var i = 0, iMax = this.rigidObjects.length; i<iMax; i++) {
        this.rigidObjects[i].reset();
      }
    },
    getRayHit: function(rayFrom,rayTo,pickStatic,pickKinematic) {
      var btRayFrom, btRayTo;
      
      btRayFrom = vec3bt(rayFrom);
      btRayTo = vec3bt(rayTo);
      
      pickStatic = pickStatic||false;
      pickKinematic = pickKinematic||false;
      
      var rayCallback = new Ammo.ClosestRayResultCallback(btRayFrom,btRayTo);
      this.dynamicsWorld.rayTest(btRayFrom,btRayTo,rayCallback);

      if (rayCallback.hasHit())
      {
        body = Ammo.btRigidBody.prototype.upcast(rayCallback.get_m_collisionObject());

        if (body !== Ammo.NULL)
        {        
          //other exclusions?
          if (!((body.isStaticObject()&&!pickStatic) || (body.isKinematicObject()&&!pickKinematic)))
          {
            var pickedBody = body;
            var pickPos = rayCallback.get_m_hitPointWorld();  // btVector3
            
            var localPos = pickedBody.getCenterOfMassTransform().inverse().op_mul(pickPos);

            var rb = pickedBody._cvr_rigidbody;
                           
            if (rb) {
              Ammo.destroy(rayCallback);
              return {position:btvec3(pickPos),localPosition:btvec3(localPos),rigidBody:rb,ammoBody:pickedBody};
            } else {
              Ammo.destroy(rayCallback);
              return {position:btvec3(pickPos),localPosition:btvec3(localPos),rigidBody:null,ammoBody:pickedBody};
            }
          }
        }
      }
      
      Ammo.destroy(rayCallback);
    }
  };

  
  var extend = {
    ScenePhysics: ScenePhysics,
    Constraint: Constraint,
    RigidProperties: RigidProperties,
    RigidBody: RigidBody,
    vec3bt_copy: vec3bt_copy,
    btvec3_copy: btvec3_copy,
    quatbt_copy: quatbt_copy,
    btquat_copy: btquat_copy
  };
  
  return extend;
});


