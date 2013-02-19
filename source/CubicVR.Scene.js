CubicVR.RegisterModule("Scene", function (base) {
    /*jshint es5:true */
    
    var undef = base.undef,
        enums = base.enums,
        GLCore = base.GLCore,
        aabbMath = base.aabb,
        primitives = base.primitives,
        mat4 = base.mat4;

     var scene_object_uuid = 0;

    function cubicvr_lightPackTypes(a, b) {
        return a.light_type - b.light_type;
    }

    function SceneObject(obj, name) {
        var obj_init = null;
        var i,iMax;

        if (obj !== undef && obj !== null) {
            if (obj.compile) {
                obj_init = {};
            } else {
                obj_init = base.get(obj) || {};
                obj = null;
            }
        } else {
            obj_init = {};
        }

        this.morphWeight = obj_init.morphWeight || 0.0;
        this.morphSource = obj_init.morphSource || -1;
        this.morphTarget = obj_init.morphTarget || -1;
        this.position = (obj_init.position === undef) ? [0, 0, 0] : obj_init.position;
        this.rotation = (obj_init.rotation === undef) ? [0, 0, 0] : obj_init.rotation;
        this.scale = (obj_init.scale === undef) ? [1, 1, 1] : obj_init.scale;
        this.shadowCast = (obj_init.shadowCast === undef) ? true : obj_init.shadowCast;
        this.wireframe = obj_init.wireframe||false;
        this.pointMode = obj_init.pointMode||false; 

        this.motion = (obj_init.motion === undef) ? null : (base.get(obj_init.motion,base.Motion) || null);
        this.obj = (!obj_init.mesh) ? (obj?base.get(obj,base.Mesh):null) : base.get(obj_init.mesh,base.Mesh);
        this.name = (obj_init.name === undef) ? ((name !== undef) ? name : null) : obj_init.name;
        this.properties = base.get(obj_init.properties)||{};

        this.children = null;
        this.parent = null;

       var sceneObjChildren = obj_init.children || obj_init.child || obj_init.sceneObject || obj_init.sceneObjects;

        if (sceneObjChildren) {
            if (sceneObjChildren && !sceneObjChildren.length || typeof(sceneObjChildren) === 'string') {
                sceneObjChildren = [sceneObjChildren];
            }
            
            if (sceneObjChildren.length) {
                for (i = 0, iMax = sceneObjChildren.length; i<iMax; i++) {
                    this.bindChild(base.get(sceneObjChildren[i],base.SceneObject));                   
                }
            }
        }

        this.lposition = [0, 0, 0];
        this.lrotation = [0, 0, 0];
        this.lscale = [0, 0, 0];

        this.lMatrix = mat4.identity();
        this.tMatrix = mat4.identity();

        this.dirty = true;

        this.aabb = [];
        this.static = obj_init.static||false;
        this.static_lights = null;
        this.octreeNode = null;
        this.visible = true;

        this.matrixLock = false;
        this.instanceMaterials = null;
        this.eventHandler = null;
        this.duplicateCount = 0;
        this.independentMotion = false;
        this.classType = base.enums.classType.SCENEOBJECT;
        
    }

    SceneObject.prototype = {   // getters and setters for x, y, z, rotX, rotY, rotZ, sclX, sclY, sclZ, dirX, dirY, dirZ, targetX, targetY, targetZ, rot, pos, scl, dir
        get x(){
            return this.position[0];
        },
        set x(value){
            this.position[0] = value;
        },
        get y(){
            return this.position[1];
        },
        set y(value){
            this.position[1] = value;
        },
        get z(){
            return this.position[2];
        },
        set z(value){
            this.position[2] = value;
        },
        get rotX(){
            return this.rotation[0];
        },
        set rotX(value){
            this.rotation[0] = value;
        },
        get rotY(){
            return this.rotation[1];
        },
        set rotY(value){
            this.rotation[1] = value;
        },
        get rotZ(){
            return this.rotation[2];
        },
        set rotZ(value){
            this.rotation[2] = value;
        },
        get pos(){
            return this.position.slice(0);
        },        
        set pos(value){
            this.position = value.slice(0);
        },
        get rot(){
            return this.rotation.slice(0);
        },        
        set rot(value){
            this.rotation = value.slice(0);
        },
        get sclX(){
            return this.scale[0];
        },
        set sclX(value){
            this.scale[0] = value;
        },
        get sclY(){
            return this.scale[1];
        },
        set sclY(value){
            this.scale[1] = value;
        },
        get sclZ(){
            return this.scale[2];
        },
        set sclZ(value){
            this.scale[2] = value;
        },
        get scl(){
            return this.scale.slice(0);
        },        
        set scl(value){
            this.scale = value.slice(0);
        },        
        clone: function() {
            var i,iMax;
            var newName = this.name?(this.name+"_"+this.duplicateCount):null;

            this.duplicateCount++;

            var dupe = new base.SceneObject({ 
                name: newName,
                mesh: this.obj,
                position: this.position.slice(0),
                rotation: this.rotation.slice(0),
                scale: this.scale.slice(0),
                morphWeight: this.morphWeight,
                morphSource: this.morphSource,
                morphTarget: this.morphTarget,
                shadowCast: this.shadowCast,
                wireframe: this.wireframe,
                pointMode: this.pointMode,
                motion: this.motion?this.motion.clone():null
            });
            
            if (this.instanceMaterials !== null) {
              dupe.instanceMaterials = [];
              
              for (i = 0, iMax = this.instanceMaterials.length; i < iMax; i++) {
                dupe.instanceMaterials[i] = this.instanceMaterials[i].clone();            
              }
            }
            
            if (this.children !== null) {
                for (i = 0, iMax = this.children.length; i < iMax; i++) {
                    dupe.bindChild(this.children[i].clone());
                }               
            }
            
            return dupe;                  
        },
        evaluate: function(index) {
            var i, iMax;
            
            this.independentMotion = true;

            if (this.motion) {
                this.motion.apply(index, this);
            }

            if (this.children !== null) {
                for (i = 0, iMax = this.children.length; i < iMax; i++) {
                    this.children[i].evaluate(index);
                }                
            }
        },
        isWireframe: function() {
            return this.wireframe;
        },
        setWireframe: function(wireframe_in) {
            this.wireframe = wireframe_in;
        },
        setPointMode: function(pointMode_in) {
            this.pointMode = pointMode_in;            
        },
        isPointMode: function() {
            return this.pointMode;           
        },        
        addEvent: function(event) {
          if (!this.eventHandler) {
            this.eventHandler = new base.EventHandler();
          }

          var newEvent = this.eventHandler.addEvent(event);
          newEvent.setSubject(this);
          return newEvent;
        },
        removeEvent: function(event) {
          if (!this.eventHandler) {
            return;
          }

          this.eventHandler.removeEvent(event);
        },
        hasEvents: function() {
          return !!this.eventHandler;
        },
        getEventHandler: function() {
          return this.eventHandler;
        },
        setMesh: function(mesh) {
          this.obj = mesh;
        },
        getMesh: function() {
          return this.obj;          
        },
        getProperties: function() {
          return this.properties;
        },
        setProperties: function(properties) {
          this.properties = properties;
        },
        getProperty: function(propertyName) {
          return this.properties[propertyName];
        },
        setProperty: function(propertyName,propertyValue) {
          this.properties[propertyName] = propertyValue;
        },
        getInstanceMaterials: function() {
          if (!this.obj) {
            return null;            
          }
          
          if (this.instanceMaterials) {
            return this.instanceMaterials;
          } 
          
          this.instanceMaterials = [];
          
          for (var i = 0, iMax = this.obj.materials.length; i < iMax; i++) {
            this.instanceMaterials[i] = this.obj.materials[i].clone();            
          }

          return this.instanceMaterials;
        },
        
        getInstanceMaterial: function(materialName) {
          var mInst = this.getInstanceMaterials();
          
          for (var i = 0, iMax = mInst.length; i<iMax; i++) {
            if (mInst[i].name == materialName) {
              return mInst[i];
            }
          }
          
          return null;
        },
            
        setMorphSource: function (idx) {
            this.morphSource = idx;
        },

        setMorphTarget: function (idx) {
            this.morphTarget = idx;
        },

        getMorphSource: function () {
            return this.morphSource;
        },

        getMorphTarget: function () {
            return this.morphTarget;
        },

        setMorphWeight: function (weight) {
            this.morphWeight = weight;
        },

        morphTargetCount: function () {
            return (this.obj.morphTargets !== null) ? this.obj.morphTargets.length : 0;
        },

        setMatrixLock: function(mLock) {
            this.matrixLock = mLock;
        },
        
        getMatrixLock: function() {
            return this.matrixLock;
        },

        setMatrix: function(mat) {
          if (mat) {
            this.tMatrix = mat.slice(0);
            this.matrixLock = true;
            
            if (this.hasEvents()) {
              var evh = this.getEventHandler();
              if (evh.hasEvent(enums.event.MATRIX_UPDATE)) {
                var props = evh.triggerEvent(enums.event.MATRIX_UPDATE);
                props.matrix = this.tMatrix;
              }
            }
          } else {
            this.matrixLock = false;
          }
        },
        
        doTransform: function (mat) {
            var vec3 = base.vec3;
            if (!this.matrixLock && (!vec3.equal(this.lposition, this.position) || !vec3.equal(this.lrotation, this.rotation) || !vec3.equal(this.lscale, this.scale) || (mat !== undef))) {
                if (mat !== undef) {
                  this.tMatrix = mat.slice(0);
                } else {
                  mat4.identity(this.tMatrix);
                }

                mat4.identity(this.lMatrix);
                mat4.translate(this.position[0],this.position[1],this.position[2],this.lMatrix);
                mat4.rotate(this.rotation[0],this.rotation[1],this.rotation[2],this.lMatrix);

                if (!(this.scale[0] === 1 && this.scale[1] === 1 && this.scale[2] === 1)) {
                  mat4.scale(this.scale[0],this.scale[1],this.scale[2],this.lMatrix);
                }

                mat4.multiply(this.tMatrix.slice(0),this.lMatrix,this.tMatrix);

                this.lposition[0] = this.position[0];
                this.lposition[1] = this.position[1];
                this.lposition[2] = this.position[2];
                this.lrotation[0] = this.rotation[0];
                this.lrotation[1] = this.rotation[1];
                this.lrotation[2] = this.rotation[2];
                this.lscale[0] = this.scale[0];
                this.lscale[1] = this.scale[1];
                this.lscale[2] = this.scale[2];
                this.dirty = true;
                
                if (this.hasEvents()) {
                  var evh = this.getEventHandler();
                  if (evh.hasEvent(enums.event.MOVE)) {
                    var props = evh.triggerEvent(enums.event.MOVE);
                    props.oldPosition = this.lposition;
                    props.position = this.position;
                    props.oldRotation = this.lrotation;
                    props.rotation = this.rotation;
                    props.oldScale = this.lscale;
                    props.scale = this.scale;
                  }
                }
            }
        },

        bindChild: function (childSceneObj) {
            if (this.children === null) {
                this.children = [];
            }

            childSceneObj.parent = this;
            this.children.push(childSceneObj);
        },

        control: function (controllerId, motionId, value) {
            if (controllerId === enums.motion.POS) {
                this.position[motionId] = value;
            } else if (controllerId === enums.motion.SCL) {
                this.scale[motionId] = value;
            } else if (controllerId === enums.motion.ROT) {
                this.rotation[motionId] = value;
            }
        },

        getAABB: function () {
            var mat4 = base.mat4;
            var vec3 = base.vec3;
            if (this.dirty) {
                var p = new Array(8);

                this.doTransform();

                var aabbMin;
                var aabbMax;

                if (this.obj) {
                    if (!this.obj.bb) {
                        this.aabb = [vec3.add([-1, -1, -1], this.position), vec3.add([1, 1, 1], this.position)];
                        return this.aabb;
                    }

                    aabbMin = this.obj.bb[0];
                    aabbMax = this.obj.bb[1];
                }

                if (!this.obj || aabbMin === undef || aabbMax === undef) {
                    this.aabb = [vec3.add([-1, -1, -1], this.position), vec3.add([1, 1, 1], this.position)];
                    return this.aabb;
                }

                var obj_aabb = aabbMin;
                var obj_bounds = vec3.subtract(aabbMax, aabbMin);

                p[0] = [obj_aabb[0], obj_aabb[1], obj_aabb[2]];
                p[1] = [obj_aabb[0], obj_aabb[1], obj_aabb[2] + obj_bounds[2]];
                p[2] = [obj_aabb[0] + obj_bounds[0], obj_aabb[1], obj_aabb[2]];
                p[3] = [obj_aabb[0] + obj_bounds[0], obj_aabb[1], obj_aabb[2] + obj_bounds[2]];
                p[4] = [obj_aabb[0], obj_aabb[1] + obj_bounds[1], obj_aabb[2]];
                p[5] = [obj_aabb[0], obj_aabb[1] + obj_bounds[1], obj_aabb[2] + obj_bounds[2]];
                p[6] = [obj_aabb[0] + obj_bounds[0], obj_aabb[1] + obj_bounds[1], obj_aabb[2]];
                p[7] = [obj_aabb[0] + obj_bounds[0], obj_aabb[1] + obj_bounds[1], obj_aabb[2] + obj_bounds[2]];

                var aabbTest;

                aabbTest = mat4.vec3_multiply(p[0], this.tMatrix);

                aabbMin = [aabbTest[0], aabbTest[1], aabbTest[2]];
                aabbMax = [aabbTest[0], aabbTest[1], aabbTest[2]];

                for (var i = 1; i < 8; ++i) {
                    aabbTest = mat4.vec3_multiply(p[i], this.tMatrix);

                    if (aabbMin[0] > aabbTest[0]) {
                        aabbMin[0] = aabbTest[0];
                    }
                    if (aabbMin[1] > aabbTest[1]) {
                        aabbMin[1] = aabbTest[1];
                    }
                    if (aabbMin[2] > aabbTest[2]) {
                        aabbMin[2] = aabbTest[2];
                    }

                    if (aabbMax[0] < aabbTest[0]) {
                        aabbMax[0] = aabbTest[0];
                    }
                    if (aabbMax[1] < aabbTest[1]) {
                        aabbMax[1] = aabbTest[1];
                    }
                    if (aabbMax[2] < aabbTest[2]) {
                        aabbMax[2] = aabbTest[2];
                    }
                }

                this.aabb[0] = aabbMin;
                this.aabb[1] = aabbMax;

                this.dirty = false;
            }

            return this.aabb;
        }
    };


    var sceneUUID = 0;

    function Scene(width, height, fov, nearclip, farclip, octree) {
        var i, iMax;
        
        this.frames = 0;

        this.classType = base.enums.classType.SCENE;
        this.sceneObjects = [];
        this.sceneObjectsStatic = [];
        this.sceneObjectsDynamic = [];
        this.sceneObjectsByName = [];
        this.sceneObjectsById = [];

        this.lights = [];
        this.lightsStatic = [];
        this.lightsDynamic = [];
        this.lightsGlobal = [];

        this.pickables = [];
        this.stats = [];
        this.cameras = [];
        this.camerasByName = [];
        this.shadows_updated = false;

        if (typeof (width) === "object" || typeof (width) === 'string') {
            var options = base.get(width);
            this.octree = options.octree;
            this.skybox = options.skybox || null;
            this.name = options.name || "scene" + sceneUUID;
            this.wireframe = options.wireframe||false;
            this.pointMode = options.pointMode||false;    
            // purposely redundant
            this.destroy = options.destroy ||
            function () {};
            this.update = options.update ||
            function () {};
            this.enable = options.enable ||
            function () {};
            this.disable = options.disable ||
            function () {};
            
            var returnOptions = options.setup && options.setup(this) || {};
            this.update = returnOptions.update || this.update;
            this.enable = returnOptions.enable || this.enable;
            this.disable = returnOptions.disable || this.disable;
            this.destroy = returnOptions.destroy || this.destroy;
            
            
            var sceneObjs = options.sceneObjects || options.sceneObject || options.objects;
            if (sceneObjs && !sceneObjs.length || typeof(sceneObjs) === 'string') {
                sceneObjs = CubicVR.get(sceneObjs);
                if (typeof(sceneObjs) == "object" && !sceneObjs.length) {
                    sceneObjs = [sceneObjs];
                }
            }
            
            if (sceneObjs && sceneObjs.length) {
                for (i = 0, iMax = sceneObjs.length; i<iMax; i++) {
                    this.bindSceneObject(base.get(sceneObjs[i],base.SceneObject));
                }
            }
            
            var sceneLights = options.lights || options.light;
            if (sceneLights && !sceneLights.length || typeof(sceneLights) === 'string') {
                sceneLights = CubicVR.get(sceneLights);
                if (typeof(sceneLights) == "object" && !sceneLights.length) {
                    sceneLights = [sceneLights];
                }
            }
            
            if (sceneLights && sceneLights.length) {
                for (i = 0, iMax = sceneLights.length; i<iMax; i++) {
                    this.bindLight(base.get(sceneLights[i],base.Light));
                }
            }
            
            var sceneCameras = options.cameras || options.camera;
            if (sceneCameras && !sceneCameras.length || typeof(sceneCameras) === 'string') {
                sceneCameras = [sceneCameras];
                sceneCameras = CubicVR.get(sceneCameras);
                if (typeof(sceneCameras) == "object" && !sceneCameras.length) {
                    sceneCameras = [sceneCameras];
                }
            }
            
            if (sceneCameras && sceneCameras.length) {
                for (i = 0, iMax = sceneCameras.length; i<iMax; i++) {
                    this.bindCamera(base.get(sceneCameras[i],base.Camera));
                }
                this.camera = this.cameras[0];
            }            
            
            if (!sceneCameras) {
                this.camera = new base.Camera(options.width, options.height, options.fov, options.nearclip, options.farclip);
            }
            
            if (this.octree) {
              this.octreeStatic = new CubicVR.Octree({
                size: this.octree.size,
                depth: this.octree.depth
              });
              this.lightingOctree = new CubicVR.Octree({
                size: this.octree.size,
                depth: this.octree.depth
              });
              this.lightingOctreeStatic = new CubicVR.Octree({
                size: this.octree.size,
                depth: this.octree.depth
              });
            }
        } else {
            this.skybox = null;
            this.octree = octree;
            this.name = "scene" + sceneUUID;
            this.camera = new base.Camera(width, height, fov, nearclip, farclip);
            this.wireframe = false;
        } //if
        
        this.paused = false;

        ++sceneUUID;
    } //Scene
    Scene.prototype = {
        isWireframe: function() {
            return this.wireframe;
        },
        setWireframe: function(wireframe_in) {
            this.wireframe = wireframe_in;
        },
        setPointMode: function(pointMode_in) {
            this.pointMode = pointMode_in;            
        },
        isPointMode: function() {
            return this.pointMode;           
        },
        setSkyBox: function (skybox) {
            this.skybox = skybox;
            //this.bindSceneObject(skybox.scene_object, null, false);
        },

        getSceneObject: function (name) {
            return this.sceneObjectsByName[name];
        },

        bindSceneObject: function (sceneObj, pickable, use_octree) {
            if (this.sceneObjects.indexOf(sceneObj) != -1) {
                return;
            }

            this.sceneObjects.push(sceneObj);
            if (pickable !== undef) {
                if (pickable) {
                    this.pickables.push(sceneObj);
                }
            }

            if (sceneObj.name !== null) {
                this.sceneObjectsByName[sceneObj.name] = sceneObj;
            }

            if (this.octree) {
              var sceneObjectsSet = sceneObj.static?this.sceneObjectsStatic:this.sceneObjectsDynamic;
              var sceneObjectsOctree = sceneObj.static?this.octreeStatic:this.octree;

              sceneObjectsSet.push(sceneObj);
              
              var sceneObjNode = new CubicVR.Octree.Node({
                object: sceneObj,
                aabb: sceneObj.getAABB()
                // inserted: function( subtree ) {
                // }
              });
              
              sceneObj.octreeNode = sceneObjNode;
              
              sceneObjectsOctree.insert( sceneObjNode );
              
            }

            if (sceneObj.children) {
                for (var i = 0, iMax = sceneObj.children.length; i < iMax; i++) {
                    this.bindSceneObject(sceneObj.children[i], pickable, use_octree);
                }
            }
            
            return sceneObj;
        },

        removeLight: function (light) {
            var idx = this.lights.indexOf(light);
            if (idx  >= 0) {
                this.lights.splice(idx, 1);
            }
            
            if (this.octree) {
              var lightOctree = light.static?this.lightingOctreeStatic:this.lightingOctree;
              var lightSet = light.static?this.lightsStatic:this.lightDynamic;
              var lightNode = light.octreeNode;
              
              idx = lightSet.indexOf(light);
              if (idx  >= 0) {
                  lightSet.splice(idx, 1);
              }
                          
              if (lightNode) {
                lightNode.removeSelf();
              }
              
              light.octreeNode = null;
            }

            // TODO: Remove from Octrees as well (global_lights, dynamic_lights).
        },

        removeSceneObject: function (sceneObj) {
            var idx;

            if (this.lockState) {
              if (!this.lockRemovals) {
                this.lockRemovals = [];
              }
              
              if (this.lockRemovals.indexOf(sceneObj)==-1) {             
                this.lockRemovals.push(sceneObj);
              }
              return;
            }

            idx = this.sceneObjects.indexOf(sceneObj);
            if (idx >= 0) {
                this.sceneObjects.splice(idx, 1);
            }

            idx = this.pickables.indexOf(sceneObj);
            if (idx >= 0) {
                this.pickables.splice(idx, 1);
            }

            if (sceneObj.name !== null) {
                if (this.sceneObjectsByName[sceneObj.name] !== undef) {
                    delete(this.sceneObjectsByName[sceneObj.name]);
                }
            }

            if (sceneObj.children) {
                for (var i = 0, iMax = sceneObj.children.length; i < iMax; i++) {
                    this.removeSceneObject(sceneObj.children[i]);
                }
            }

            if (this.octree) {
              if (sceneObj.octreeNode) {
                sceneObj.octreeNode.removeSelf();
                sceneObj.octreeNode = null;
              }
              var sceneObjectsSet = sceneObj.static?this.sceneObjectsStatic:this.sceneObjectsDynamic;
              idx = sceneObjectsSet.indexOf(sceneObj);
              if (idx >= 0) {
                  sceneObjectsSet.splice(idx, 1);
              }
            }
        },

        bindLight: function (lightObj, use_octree) {
            this.lights.push(lightObj);
            
            if (this.octree) {
              var lightOctree = lightObj.static?this.lightingOctreeStatic:this.lightingOctree;
              var lightSet = lightObj.static?this.lightsStatic:this.lightDynamic;
              var lightNode = new CubicVR.Octree.Node({
                object: lightObj,
                aabb: lightObj.getAABB()
              });
              lightObj.octreeNode = lightNode;
              lightOctree.insert(
                lightNode
              );
              lightSet.push(lightObj);
            }
            this.lights = this.lights.sort(cubicvr_lightPackTypes);
        },

        bindCamera: function (cameraObj) {
            if (this.cameras.indexOf(cameraObj) === -1) {
              this.cameras.push(cameraObj);
              this.camerasByName[cameraObj.name] = cameraObj;
            }
            this.camera = cameraObj;
        },
        
        removeCamera: function (cameraObj) {  //todo: this
            if (typeof(cameraObj) !== 'object') {
              cameraObj = this.getCamera(camName);              
            }
            
            if (this.cameras.indexOf(cameraObj) === -1) {
              this.cameras.push(cameraObj);
              this.camerasByName[cameraObj.name] = cameraObj;
            }

            return cameraObj;
        },

        bind: function(obj, pickable) {
            if (obj instanceof base.Light) {
                this.bindLight(obj);
            } else if (obj instanceof base.SceneObject) {
                this.bindSceneObject(obj, pickable);
            } else if (obj instanceof base.Camera) {
                this.bindCamera(obj);   
            } else if (obj instanceof base.Vehicle) {
                obj.bindToScene(this);  
            } else if (obj instanceof base.RigidBody) {
                this.bindSceneObject(obj.getSceneObject());   
            }
        },

        remove: function(obj) {
            if (obj instanceof base.Light) {
                this.removeLight(obj);
            } else if (obj instanceof base.SceneObject) {
                this.removeSceneObject(obj);
            } else if (obj instanceof base.Camera) {
                this.removeCamera(obj);   
            }else if (obj instanceof bsae.RigidBody) {
                this.removeSceneObject(obj.getSceneObject());   
            }
        },

        setCamera: function(cameraObj) {
          if (!cameraObj) return;
          
          if (typeof(cameraObj)!=='object') {
            cameraObj = this.getCamera(cameraObj);
          }
          
          this.camera = cameraObj;
        },
        
        getCamera: function(camName) {
          if (camName === undef) {
            return this.camera;            
          }
          
          return this.camerasByName[camName];
        },

        evaluate: function (index) {
            var i, iMax;

            for (i = 0, iMax = this.sceneObjects.length; i < iMax; i++) {
                if (!(this.sceneObjects[i].motion) || this.sceneObjects[i].independentMotion) {
                    continue;
                }
                this.sceneObjects[i].motion.apply(index, this.sceneObjects[i]);
            }

            if (this.camera.motion !== null) {
                if (this.camera.targetSceneObject !== null) {
                    this.camera.target = this.camera.targetSceneObject.position;
                }

                this.camera.motion.apply(index, this.camera);
            }

            for (i = 0, iMax = this.lights.length; i < iMax; i++) {
                var l = this.lights[i];

                if (l.motion !== null) {
                    l.motion.apply(index, l);
                }
            }
        },

        prepareTransforms: function (sceneObj) {
          var i, iMax;
          if (!sceneObj) {
            if (this.sceneObjects.length === 0) return;
            for (i=0, iMax=this.sceneObjects.length; i<iMax; ++i) {
              this.prepareTransforms(this.sceneObjects[i]);
            }
          }
          else {
            sceneObj.doTransform();            
            if ( sceneObj.children ) {
              for (i = 0, iMax = sceneObj.children.length; i < iMax; i++) {
                sceneObj.children[i].doTransform(sceneObj.tMatrix);
                this.prepareTransforms(sceneObj.children[i]);
              }
            }
          }
        },


        updateShadows: function (skip_transform,cam) {
            var gl = GLCore.gl;
            var sflip = false;
            skip_transform = skip_transform||false;
            cam = cam||this.camera;
            
            if (this.shadows_updated) {
              return false;
            } else {
              if (!skip_transform) {
                this.doTransform();
              }
              this.shadows_updated = true;
            }
            
            if (!base.features.lightShadows) return;

            var currentBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

            // Begin experimental shadowing code..
            var has_shadow = false;
            var dims = gl.getParameter(gl.VIEWPORT);
            for (var l = 0, lMax = this.lights.length; l < lMax; l++) {
                var light = this.lights[l];

                if ((light.light_type == enums.light.type.SPOT_SHADOW) || (light.light_type == enums.light.type.SPOT_SHADOW_PROJECTOR) || (light.light_type == enums.light.type.AREA)) {
                    has_shadow = true;
                    var lDepthPack = [new base.Light(enums.light.type.DEPTH_PACK)];

                    // shadow state depth
                    if ((light.light_type === enums.light.type.AREA)) {
                        light.areaCam = cam;
                        light.updateAreaLight();
                    }

                    GLCore.shadow_near = light.dummyCam.nearclip;
                    GLCore.shadow_far = light.dummyCam.farclip;

                    light.shadowBegin();

                    for (var i = 0, iMax = this.sceneObjects.length; i < iMax; i++) {
                        var scene_object = this.sceneObjects[i];
                        if (scene_object.parent) {
                            continue;
                        } //if
                        if (scene_object.visible === false || scene_object.shadowCast === false) {
                            continue;
                        } //if

                        this.renderSceneObject(scene_object,light.dummyCam,lDepthPack,false,true);
                    } //for i
                    light.shadowEnd();
                    
                    if (currentBuffer) {
                           gl.bindFramebuffer(gl.FRAMEBUFFER, currentBuffer);
                    }

                } //if shadowed
            } // for l
            if (has_shadow) {
                gl.viewport(dims[0], dims[1], dims[2], dims[3]);
            }


            // End experimental shadow code..  
        },

        updateCamera: function (cam) {
            var gl = GLCore.gl;
            cam = cam||this.camera;
            if (cam.manual === false) {
                if (cam.targeted) {
                    cam.lookat(cam.position[0], cam.position[1], cam.position[2], cam.target[0], cam.target[1], cam.target[2], 0, 1, 0);
                } else {
                    cam.calcProjection();
                }
            }

            GLCore.depth_alpha_near = cam.nearclip;
            GLCore.depth_alpha_far = cam.farclip;
        },

        resize: function (w_in, h_in) {
            if (this.camera) {
                this.camera.setDimensions(w_in, h_in);
            }
        },
        
        doTransform: function(sceneObjects) {
             var use_octree = this.octree !== undef;
             var sceneObjects = sceneObjects || this.sceneObjects;
             for (var i = 0, iMax = sceneObjects.length; i < iMax; i++) {
                var scene_object = sceneObjects[i];
                if (scene_object.parent !== null) {
                    continue;
                } //if
                this.prepareTransforms(scene_object);
                if (scene_object.visible === false) {
                    continue;
                } //if
           }
        },

        renderSceneObject: function(sceneObj, camera, lights, renderChildren, skip_trans, skip_solid, transparencies) {
          var sflip = false;
          var gl = GLCore.gl;

          renderChildren = (renderChildren!==undef)&&renderChildren;
          skip_trans = skip_trans||false;
          skip_solid = skip_solid||false;

          if (sceneObj.visible && sceneObj.obj) {
              if (sceneObj.scale[0] < 0) {
                  sflip = !sflip;
              }
              if (sceneObj.scale[1] < 0) {
                  sflip = !sflip;
              }
              if (sceneObj.scale[2] < 0) {
                  sflip = !sflip;
              }

              if (sflip) {
                  gl.cullFace(gl.FRONT);
              }

              var mesh = sceneObj.obj;

              if (mesh.morphTargets !== null) {
                  if (sceneObj.morphSource !== -1) mesh.setMorphSource(sceneObj.morphSource);
                  if (sceneObj.morphTarget !== -1) mesh.setMorphTarget(sceneObj.morphTarget);
                  if (sceneObj.morphWeight !== null) mesh.morphWeight = sceneObj.morphWeight;
              }

              if (sceneObj.instanceMaterials) {
                  mesh.bindInstanceMaterials(sceneObj.instanceMaterials);
              }

              if (base.renderObject(mesh, camera, sceneObj.tMatrix, lights, skip_trans, skip_solid, this.isWireframe() || sceneObj.isWireframe(), this.isPointMode() || sceneObj.isPointMode()) && transparencies) {
                  transparencies.push(sceneObj);
              }

              if (sceneObj.instanceMaterials) {
                  mesh.bindInstanceMaterials(null);
              }

              if (sflip) {
                  gl.cullFace(gl.BACK);
              }

              sflip = false;
          } //if
          
          var children = sceneObj.children;
          
          if (renderChildren && children) {
              for (var i = 0, iMax = children.length; i < iMax; i++) {
                var childObj = children[i];
                this.renderSceneObject(childObj, camera, lights, true, skip_trans, skip_solid, transparencies);
              }
          } //if
        },        
        runEvents: function(currentTime) {
          var i,iMax;
          
          this.lockState = true;
          
          if (!!currentTime.getSeconds) {
            currentTime = currentTime.getSeconds();
          }

          for (i = 0, iMax = this.sceneObjects.length; i < iMax; i++) {
              var scene_object = this.sceneObjects[i];
              if (scene_object.hasEvents()) {
                scene_object.getEventHandler().update(currentTime);
              }
          }
          
          this.lockState = false;
          
          if (this.lockRemovals) {
            for (i = 0, iMax = this.lockRemovals.length; i<iMax; i++) {
              this.removeSceneObject(this.lockRemovals[i]);
            }
          }
          
          this.lockRemovals = null;
          
        },
        doAdjustments: function(sceneObjects) {
          var i,iMax;
          for (i = 0, iMax = sceneObjects.length; i<iMax; i++) {
            var sceneObj = sceneObjects[i];       
            if (sceneObj.dirty) {
              var node = sceneObj.octreeNode;
              node.aabb = sceneObj.getAABB();
              node.adjust();
              // node.removeSelf();
              // this.octree.insert(node);
            }
          }
        },
        octreeAdd: function(obj) {
          
        },
        render: function (options) {
            ++this.frames;

            options = options || {};
            if (options.postProcess) {
                options.postProcess.begin(!options.postBuffer);  // true to clear accumulation buffer
            }
            
            var i, iMax;
            var gl = GLCore.gl;
            var renderCam = options.camera||this.camera;
            

            var use_octree = this.octree !== undef;
            this.lights_rendered = 0;

            if (this.octree) {
              this.doTransform(this.sceneObjectsDynamic);
              this.doAdjustments(this.sceneObjectsDynamic);
            } else {
              this.doTransform(this.sceneObjects);
            }

            var sceneObjects = options.sceneObjects||this.sceneObjects;
            
            if (this.octree && !options.sceneObjects) {
              sceneObjects = this.octree.get_frustum_hits(renderCam).concat(this.octreeStatic.get_frustum_hits(renderCam));              
            }

            this.updateCamera(renderCam);
            this.updateShadows(true);
            
            // TODO: temporary until dependent code is updated.
            this.shadows_updated = false;

            var lights = options.lights||this.lights;
            
            for (i = 0, iMax = lights.length; i < iMax; i++) {
                var light = lights[i];
                light.prepare(renderCam);
                
                if (this.octree && light.dirty) {
                  var node = light.octreeNode;
                  node.aabb = light.getAABB();
                  node.adjust();
                }                
            }

            var lights_list = [];
            var transparencies = [];

            for (i = 0, iMax = sceneObjects.length; i < iMax; i++) {
                var scene_object = sceneObjects[i];
                if (scene_object.visible === false || scene_object.parent !== null) {
                    continue;
                } //if

                if (this.octree && !options.sceneObjects) {
                  lights = [];
                  
                  if (scene_object.static_lights == null || !scene_object.static) {
                    scene_object.static_lights = this.lightingOctreeStatic.get_aabb_hits(scene_object.getAABB());
                  }
                  
                  scene_object.dynamic_lights = this.lightingOctree.get_aabb_hits(scene_object.getAABB());
                  
                  lights = scene_object.static_lights.concat(scene_object.dynamic_lights);
                  
                  if (lights.length == 0) {
                    lights = [GLCore.emptyLight];
                  }

                  // console.log(lights.length);
                }
                this.renderSceneObject(scene_object,renderCam,lights,true,true,false,transparencies);
            } //for

            // TODO: sort transparencies..?
            
            if (this.octree) {
              for (i = 0, iMax = transparencies.length; i < iMax; i++) {                
                var transparentObj = transparencies[i];
                lights = transparentObj.static_lights.concat(transparentObj.dynamic_lights);
                if (lights.length == 0) {
                  lights = [GLCore.emptyLight];
                }
                this.renderSceneObject(transparentObj,renderCam,lights,false,false,true);
              }
            } else {
              for (i = 0, iMax = transparencies.length; i < iMax; i++) {
                  this.renderSceneObject(transparencies[i],renderCam,lights,false,false,true);                
              }
            }
            
            if (this.skybox !== null && this.skybox.ready === true) {
                gl.cullFace(gl.FRONT);
                var size = (renderCam.farclip * 2) / Math.sqrt(3.0);
                if (renderCam.parent) {
                  this.skybox.scene_object.position = mat4.vec3_multiply(renderCam.position,renderCam.parent.tMatrix);
                } else {
                  this.skybox.scene_object.position = [renderCam.position[0], renderCam.position[1], renderCam.position[2]];
                }
                this.skybox.scene_object.scale = [size, size, size];
                this.skybox.scene_object.doTransform();
                base.renderObject(this.skybox.scene_object.obj, renderCam, this.skybox.scene_object.tMatrix, []);
                gl.cullFace(gl.BACK);
            } //if
            
            if (options.postProcess) {
                options.postProcess.end();   
                if (!options.postBuffer) {               
                    options.postProcess.render();
                }
            }
        },

        bbRayTest: function (pos, ray, axisMatch, cam) {
            var vec3 = base.vec3;
            var pt1, pt2;
            var selList = [];
            cam = cam||this.camera;

            if (ray.length === 2) {
                ray = cam.unProject(ray[0], ray[1]);
            } else {
                ray = vec3.add(pos, ray);
            }

            pt1 = pos;
            pt2 = ray;

            for (var obj_i in this.pickables) {
                if (this.pickables.hasOwnProperty(obj_i)) {
                    var obj = this.pickables[obj_i];
                    if (obj.visible !== true) continue;

                    var bb1, bb2;
                    var aabb = obj.getAABB();
                    bb1 = aabb[0];
                    bb2 = aabb[1];

                    var mindepth = 0.2;

                    if (bb2[0] - bb1[0] < mindepth) {
                        bb1[0] -= mindepth / 2;
                        bb2[0] += mindepth / 2;
                    }
                    if (bb2[1] - bb1[1] < mindepth) {
                        bb1[1] -= mindepth / 2;
                        bb2[1] += mindepth / 2;
                    }
                    if (bb2[2] - bb1[2] < mindepth) {
                        bb1[2] -= mindepth / 2;
                        bb2[2] += mindepth / 2;
                    }

                    var center = vec3.multiply(vec3.add(bb1, bb2), 0.5);
                    var testPt = vec3.getClosestTo(pt1, pt2, center);
                    var testDist = vec3.length(vec3.subtract(testPt, center));

                    var matches = ((testPt[0] >= bb1[0] && testPt[0] <= bb2[0]) ? 1 : 0) + ((testPt[1] >= bb1[1] && testPt[1] <= bb2[1]) ? 1 : 0) + ((testPt[2] >= bb1[2] && testPt[2] <= bb2[2]) ? 1 : 0);

                    if (matches >= axisMatch) {
                        selList.push({
                            dist: testDist,
                            obj: obj
                        });
                    }
                }
            }

            if (selList.length) {
                selList.sort(function (a, b) {
                    if (a.dist == b.dist) return 0;
                    return (a.dist < b.dist) ? -1 : 1;
                });
            }

            return selList;
        }
    };

    function DeferredBin() {
        this.meshBin = {};
        this.imageBin = {};

        this.meshMap = {};
        this.imageMap = {};

        this.imageBinPtr = {};
        this.meshBinPtr = {};
    }

    DeferredBin.prototype = {
        addMesh: function (binId, meshId, meshObj) {
            if (this.meshBin[binId] === undef) {
                this.meshBin[binId] = [];
                if (this.meshBinPtr[binId] === undef) {
                    this.meshBinPtr[binId] = 0;
                }
            }

            if (this.meshMap[meshId] === undef) {
                this.meshMap[meshId] = meshObj;
                this.meshBin[binId].push(meshObj);
            }
        },

        addImage: function (binId, imageId, imageObj) {
            if (this.imageBin[binId] === undef) {
                this.imageBin[binId] = [];
                if (this.imageBinPtr[binId] === undef) {
                    this.imageBinPtr[binId] = 0;
                }
            }

            if (this.imageMap[imageId] === undef) {
                this.imageMap[imageId] = imageObj;
                this.imageBin[binId].push(imageObj);
            }
        },

        getMeshes: function (binId) {
            return this.meshBin[binId];
        },

        getImages: function (binId) {
            return this.imageBin[binId];
        },

        rewindMeshes: function (binId) {
            this.meshBinPtr[binId] = 0;
        },

        rewindImages: function (binId) {
            this.imageBinPtr[binId] = 0;
        },

        getNextMesh: function (binId) {
            var cBin = this.meshBinPtr[binId];

            if (cBin < this.meshBin[binId].length) {
                this.meshBinPtr[binId]++;
                return this.meshBin[binId][cBin];
            }

            return null;
        },

        loadNextMesh: function (binId) {
            var mesh = this.getNextMesh(binId);

            if (mesh !== null) {
                if (mesh.compiled === null) {
                    mesh.triangulateQuads();
                    mesh.compile();
                    mesh.clean();
                }

                return true;
            }

            return false;
        },

        isMeshBinEmpty: function (binId) {
            //console.log('isMeshBinEmpty[' + binId + '] = ' + (this.meshBinPtr[binId] === this.meshBin[binId].length) + ' meshBinPtr = ' + this.meshBinPtr[binId] + ' meshBin.length = ' + this.meshBin[binId].length);
            return this.meshBinPtr[binId] === this.meshBin[binId].length;
        },

        loadNextImage: function (binId) {
            var img = this.getNextImage(binId);

            if (img !== null) {
                img.src = img.deferredSrc;
                //     return true;
            }

            //   return false;
        },

        getNextImage: function (binId) {
            var cBin = this.imageBinPtr[binId];

            if (cBin < this.imageBin[binId].length) {
                this.imageBinPtr[binId]++;
                return this.imageBin[binId][cBin];
            }

            return null;
        },

        isImageBinEmpty: function (binId) {
            //console.log('isImageBinEmpty[' + binId + '] = ' + (this.imageBinPtr[binId] === this.imageBin[binId].length));
            return this.imageBinPtr[binId] === this.imageBin[binId].length;
        }
    };




    /* SkyBox */

    function SkyBox(in_obj) {
        var texture = in_obj.texture;
        var mapping = in_obj.mapping;

        var that = this;

        this.mapping = null;
        this.ready = false;
        this.texture = null;

        this.onready = function () {
            texture.onready = null;
            var tw = 1 / base.Images[that.texture.tex_id].width;
            var th = 1 / base.Images[that.texture.tex_id].height;
            if (that.mapping === null) {
                that.mapping = [
                    [1 / 3, 0.5, 2 / 3 - tw, 1], //top
                    [0, 0.5, 1 / 3, 1], //bottom
                    [0, 0, 1 / 3 - tw, 0.5], //left
                    [2 / 3, 0, 1, 0.5], //right
                    [2 / 3 + tw, 0.5, 1, 1], //front
                    [1 / 3, 0, 2 / 3, 0.5]
                ]; //back
            } //if
            var mat = new base.Material({
                name: "skybox",
                textures: {
                    color: texture
                },
                noFog: true
            });
            var obj = new base.Mesh();
            obj.sky_mapping = that.mapping;
            base.primitives.box({
                mesh: obj,
                size: 1.0,
                material: mat,
                uvmapper: {
                    projectionMode: base.enums.uv.projection.SKY,
                    scale: [1, 1, 1]
                }
            });
            obj.prepare();
            that.scene_object = new base.SceneObject(obj);

            that.ready = true;
        }; //onready
        if (texture) {
            if (typeof (texture) === "string") {
                texture = new base.Texture(texture, null, null, null, this.onready);
            } else if (!texture.loaded) {
                texture.onready = this.onready;
            } //if
            this.texture = texture;

            if (mapping) {
                this.mapping = mapping;
                this.onready();
            } //if
        } //if
    } //cubicvr_SkyBox::Constructor


    var extend = {
        Scene: Scene,
        SceneObject: SceneObject,
        SkyBox: SkyBox,
        DeferredBin: DeferredBin
     };

    return extend;
});
