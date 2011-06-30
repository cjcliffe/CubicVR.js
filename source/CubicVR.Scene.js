
CubicVR.RegisterModule("Scene",function(base) {
  
  var undef = base.undef;
  var enums = CubicVR.enums;
  var GLCore = base.GLCore;
  var aabbMath = CubicVR.aabb;

  var scene_object_uuid = 0;

  function SceneObject(obj, name) {
    var obj_init = null;
    
    if (obj!==undef && obj!==null)
    {
      if (obj.compile)
      {
        obj_init = null;
      } else {
        obj_init = obj;
      }    
    }

    if (obj_init) {
      this.morphWeight = obj_init.morphWeight || 0.0;
      this.morphSource = obj_init.morphSource || -1;
      this.morphTarget = obj_init.morphTarget || -1;
      this.position = (obj_init.position===undef)?[0, 0, 0]:obj_init.position;
      this.rotation = (obj_init.rotation===undef)?[0, 0, 0]:obj_init.rotation;
      this.scale = (obj_init.scale===undef)?[1, 1, 1]:obj_init.scale;
      this.shadowCast = (obj_init.shadowCast===undef)?true:obj_init.shadowCast;

      this.motion = (obj_init.motion===undef)?null:obj_init.motion;
      this.obj = (obj_init.mesh===undef)?((obj !== undef && obj_init.faces !== undef) ? obj : null):obj_init.mesh;
      this.name = (obj_init.name===undef)?((name !== undef) ? name : null):obj_init.name;
    } else {
      this.position = [0, 0, 0];
      this.rotation = [0, 0, 0];
      this.scale = [1, 1, 1];

      this.motion = null;
      this.obj = obj;
      this.name = name;    
      this.shadowCast = true;
    }
    
    this.children = null;
    this.parent = null;

    this.drawn_this_frame = false;

    this.lposition = [0, 0, 0];
    this.lrotation = [0, 0, 0];
    this.lscale = [0, 0, 0];

    this.trans = new CubicVR.Transform();

    this.tMatrix = this.trans.getResult();

    this.dirty = true;

    this.aabb = [];

    this.id = -1;

    this.octree_leaves = [];
    this.octree_common_root = null;
    this.octree_aabb = [[0,0,0],[0,0,0]];
    aabbMath.reset(this.octree_aabb, [0,0,0]);
    this.ignore_octree = false;
    this.visible = true;
    this.culled = true;
    this.was_culled = true;

    this.dynamic_lights = [];
    this.static_lights = [];
  }

  SceneObject.prototype.setMorphSource = function(idx) {
    this.morphSource = idx;
  }

  SceneObject.prototype.setMorphTarget = function(idx) {
    this.morphTarget = idx;
  }

  SceneObject.prototype.getMorphSource = function() {
    return this.morphSource;
  }

  SceneObject.prototype.getMorphTarget = function() {
    return this.morphTarget;
  }


  SceneObject.prototype.setMorphWeight = function(weight) {
    this.morphWeight = weight;
  }

  SceneObject.prototype.morphTargetCount = function() {
    return (this.obj.morphTargets !== null)?this.obj.morphTargets.length:0;
  }

  SceneObject.prototype.doTransform = function(mat) {
    var vec3 = CubicVR.vec3;
    if (!vec3.equal(this.lposition, this.position) || !vec3.equal(this.lrotation, this.rotation) || !vec3.equal(this.lscale, this.scale) || (mat !== undef)) {

      this.trans.clearStack();

      if ((mat !== undef)) {
        this.trans.pushMatrix(mat);
      }

      this.trans.translate(this.position);

      if (! (this.rotation[0] === 0 && this.rotation[1] === 0 && this.rotation[2] === 0)) {
        this.trans.pushMatrix();
        this.trans.rotate(this.rotation);
      }

      if (! (this.scale[0] === 1 && this.scale[1] === 1 && this.scale[2] === 1)) {
        this.trans.pushMatrix();
        this.trans.scale(this.scale);
      }




      this.tMatrix = this.trans.getResult();

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
    }
  };

  SceneObject.prototype.adjust_octree = function() {
    var aabb = this.getAABB();
    var taabb = this.octree_aabb;
    var px0 = aabb[0][0];
    var py0 = aabb[0][1];
    var pz0 = aabb[0][2];
    var px1 = aabb[1][0];
    var py1 = aabb[1][1];
    var pz1 = aabb[1][2];
    var tx0 = taabb[0][0];
    var ty0 = taabb[0][1];
    var tz0 = taabb[0][2];
    var tx1 = taabb[1][0];
    var ty1 = taabb[1][1];
    var tz1 = taabb[1][2];
    if (this.octree_leaves.length > 0 && (px0 < tx0 || py0 < ty0 || pz0 < tz0 || px1 > tx1 || py1 > ty1 || pz1 > tz1)) {
      for (var i = 0; i < this.octree_leaves.length; ++i) {
        this.octree_leaves[i].remove(this);
      } //for
      this.octree_leaves = [];
      this.static_lights = [];
      var common_root = this.octree_common_root;
      this.octree_common_root = null;
      if (common_root !== null) {

        while (true) {
          if (!common_root.contains_point(aabb[0]) || !common_root.contains_point(aabb[1])) {
            if (common_root._root !== undef && common_root._root !== null) {
              common_root = common_root._root;
            } else {
              break;
            } //if
          } else {
            break;
          } //if
        } //while
        aabbMath.reset(this.octree_aabb, this.position);
        common_root.insert(this);
      } //if
    } //if
  }; //SceneObject::adjust_octree
  SceneObject.prototype.bindChild = function(childSceneObj) {
    if (this.children === null) {
      this.children = [];
    }

    childSceneObj.parent = this;
    this.children.push(childSceneObj);
  };


  SceneObject.prototype.control = function(controllerId, motionId, value) {
    if (controllerId === enums.motion.POS) {
      this.position[motionId] = value;
    } else if (controllerId === enums.motion.SCL) {
      this.scale[motionId] = value;
    } else if (controllerId === enums.motion.ROT) {
      this.rotation[motionId] = value;
    }
  };

  SceneObject.prototype.getAABB = function() {
    var mat4 = CubicVR.mat4;
    var vec3 = CubicVR.vec3;
    if (this.dirty) {
      var p = new Array(8);

      this.doTransform();

      var aabbMin;
      var aabbMax;



      if (this.obj !== null)
      {
        if (this.obj.bb === null)
        {
          this.aabb = [vec3.add([-1,-1,-1],this.position),vec3.add([1,1,1],this.position)];
          return this.aabb;
        }

        aabbMin = this.obj.bb[0];
        aabbMax = this.obj.bb[1];
      }
      
      if (this.obj === null || aabbMin === undef || aabbMax === undef)
      {
        // aabbMin=[-1,-1,-1];
        // aabbMax=[1,1,1];      
        // 
        // if (this.obj.bb.length===0)
        // {
          this.aabb = [vec3.add([-1,-1,-1],this.position),vec3.add([1,1,1],this.position)];
          return this.aabb;
        // }
      }

      /*
      if (this.scale[0] !== 1 || this.scale[1] !== 1 || this.scale[2] !== 1) {
        aabbMin[0] *= this.scale[0];
        aabbMin[1] *= this.scale[1];
        aabbMin[2] *= this.scale[2];
        aabbMax[0] *= this.scale[0];
        aabbMax[1] *= this.scale[1];
        aabbMax[2] *= this.scale[2];
      }
      */

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
  };



  var sceneUUID = 0;

  function Scene(width, height, fov, nearclip, farclip, octree) {
    this.frames = 0;
    this.sceneObjects = [];
    this.sceneObjectsByName = [];
    this.sceneObjectsById = [];
    this.lights = [];
    this.global_lights = [];
    this.dynamic_lights = [];
    this.pickables = [];
    this.stats = [];
    this.collect_stats = false;

    if (typeof(width) === "object") {
      var options = width;
      this.octree = options.octree;
      this.skybox = options.skybox || null;
      this.camera = new CubicVR.Camera( options.width, 
                                options.height, 
                                options.fov, 
                                options.nearclip, 
                                options.farclip);
      this.name = options.name || "scene" + sceneUUID;

      // purposely redundant
      this.destroy = options.destroy || function () {};
      this.update = options.update || function () {}; 
      this.enable = options.enable || function () {};
      this.disable = options.disable || function () {};
      var returnOptions = options.setup && options.setup(this);
      this.update = returnOptions.update || this.update;
      this.enable = returnOptions.enable || this.enable;
      this.disable = returnOptions.disable || this.disable;
      this.destroy = returnOptions.destroy || this.destroy;
    }
    else {
      this.skybox = null;
      this.octree = octree;
      this.camera = new CubicVR.Camera(width, height, fov, nearclip, farclip);
      this.name = "scene" + sceneUUID + Date.now();
    } //if

    this.paused = false;

    ++sceneUUID;
  } //Scene

  Scene.prototype.attachOctree = function(octree) {
    this.octree = octree;
    if (octree.init) {
      octree.init(this);
    } //if

    // rebind any active lights
    var tmpLights = this.lights;
    this.lights = [];
    
    for (var l = 0, lMax = tmpLights.length; l < lMax; l++) {
      this.bindLight(tmpLights[l]);
    } //for

    var objs = this.sceneObjects;
    if (this.octree !== undef) {
      for (var i=0, l=objs.length; i<l; ++i) {
        var obj = objs[i];
        if (obj.obj === null) { continue; }
        if (obj.id < 0) {
          obj.id = scene_object_uuid;
          ++scene_object_uuid;
        } //if
        this.sceneObjectsById[obj.id] = obj;
        aabbMath.reset(obj.octree_aabb, obj.position);
        this.octree.insert(obj);
        if (obj.octree_common_root === undefined || obj.octree_common_root === null) {
          log("!!", obj.name, "octree_common_root is null");
        } //if
      } //for
    } //if
    
    
  } //Scene::attachOctree

  Scene.prototype.setSkyBox = function(skybox) {
    this.skybox = skybox;
    //this.bindSceneObject(skybox.scene_object, null, false);
  };

  Scene.prototype.getSceneObject = function(name) {
    return this.sceneObjectsByName[name];
  };

  Scene.prototype.bindSceneObject = function(sceneObj, pickable, use_octree) {
    if (this.sceneObjects.indexOf(sceneObj)!=-1) {
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

    if (this.octree !== undef && (use_octree === undef || use_octree === "true")) {
      if (sceneObj.id < 0) {
        sceneObj.id = scene_object_uuid;
        ++scene_object_uuid;
      } //if
      this.sceneObjectsById[sceneObj.id] = sceneObj;
      aabbMath.reset(sceneObj.octree_aabb, sceneObj.position);
      this.octree.insert(sceneObj);
    } //if
    
    if (sceneObj.children) {
      for (var i = 0, iMax = sceneObj.children.length; i < iMax; i++) {
        this.bindSceneObject(sceneObj.children[i], pickable, use_octree);
      }
    }
  };

  Scene.prototype.removeLight = function(light) {
    var idx;
      
    if ((idx = this.lights.indexOf(light)) >= 0) {
      this.lights.splice(idx,1);
    }

    // TODO: Remove from Octrees as well (global_lights, dynamic_lights).
   
  };

  Scene.prototype.removeSceneObject = function(sceneObj) {
    var idx;
      
    if ((idx = this.sceneObjects.indexOf(sceneObj)) >= 0) {
      this.sceneObjects.splice(idx,1);
    }
    
    if (idx = this.pickables.indexOf(sceneObj) >= 0) {
      if (pickable) {
        this.pickables.push(sceneObj);
      }
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
    
    //todo: remove from octree!

  /*  if (this.octree !== undef && (use_octree === undef || use_octree === "true")) {
      if (sceneObj.id < 0) {
        sceneObj.id = scene_object_uuid;
        ++scene_object_uuid;
      } //if
      this.sceneObjectsById[sceneObj.id] = sceneObj;
      AABB_reset(sceneObj.octree_aabb, sceneObj.position);
      this.octree.insert(sceneObj);
    } //if */
  };


  Scene.prototype.bindLight = function(lightObj, use_octree) {
    this.lights.push(lightObj);
    if (this.octree !== undef && (use_octree === undef || use_octree === "true")) {
      if (lightObj.method === enums.light.method.GLOBAL) {
        this.global_lights.push(lightObj);
      }
      else {
        if (lightObj.method === enums.light.method.DYNAMIC) {
          this.dynamic_lights.push(lightObj);
        } //if
        this.octree.insert_light(lightObj);
      } //if
    } //if
    
    this.lights=this.lights.sort(cubicvr_lightPackTypes);  
  };

  Scene.prototype.bindCamera = function(cameraObj) {
    this.camera = cameraObj;
  };


  Scene.prototype.evaluate = function(index) {
    var i,iMax;

    for (i = 0, iMax = this.sceneObjects.length; i < iMax; i++) {
      if (!(this.sceneObjects[i].motion)) {
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

    for (var i = 0, iMax = this.lights.length; i < iMax; i++) {
      var l = this.lights[i];
       
      if (l.motion !== null) {
        l.motion.apply(index, l);
      }
    }
  };

  Scene.prototype.renderSceneObjectChildren = function(sceneObj, camera, lights) {
    var gl = GLCore.gl;
    var sflip = false;

    for (var i = 0, iMax = sceneObj.children.length; i < iMax; i++) {
      if (sceneObj.children[i].visible === false) {
        continue;
      } //if
      
      try {
        sceneObj.children[i].doTransform(sceneObj.tMatrix);
      }catch(e){break;}

        var scene_object = sceneObj.children[i];
        var mesh = sceneObj.children[i].obj;

        if (mesh) {
          if (sceneObj.children[i].scale[0] < 0) {
            sflip = !sflip;
          }
          if (sceneObj.children[i].scale[1] < 0) {
            sflip = !sflip;
          }
          if (sceneObj.children[i].scale[2] < 0) {
            sflip = !sflip;
          }

          if (sflip) {
            gl.cullFace(gl.FRONT);
          }

          if (mesh.morphTargets !== null) {
            if (scene_object.morphSource !== -1) mesh.setMorphSource(scene_object.morphSource);
            if (scene_object.morphTarget !== -1) mesh.setMorphTarget(scene_object.morphTarget);;
            if (scene_object.morphWeight !== null) mesh.morphWeight = scene_object.morphWeight;
          }

          CubicVR.renderObject(obj, camera, sceneObj.children[i].tMatrix, lights);

          if (sflip) {
            gl.cullFace(gl.BACK);
          }
        }

        if (sceneObj.children[i].children !== null) {
          this.renderSceneObjectChildren(sceneObj.children[i], camera, lights);
        }
    }
  };

  function cubicvr_lightPackTypes(a,b) {
    return a.light_type - b.light_type;
  }

  Scene.prototype.updateShadows = function() {
    var gl = GLCore.gl;
    var sflip = false;

    this.updateCamera();
    
    // Begin experimental shadowing code..
    var has_shadow = false;
    var dims = gl.getParameter(gl.VIEWPORT);
    for (var l = 0, lMax = this.lights.length; l<lMax; l++) {
      var light = this.lights[l];

      if ((light.light_type == enums.light.type.SPOT_SHADOW)||(light.light_type == enums.light.type.AREA)) {
        has_shadow = true;
        var lDepthPack = new CubicVR.Light(enums.light.type.DEPTH_PACK);
        
        // shadow state depth
        if ((light.light_type === enums.light.type.AREA)) {
          light.areaCam = this.camera;
          light.updateAreaLight();
        }

        GLCore.shadow_near = light.dummyCam.nearclip;
        GLCore.shadow_far = light.dummyCam.farclip;

        light.shadowBegin();

        for (var i = 0, iMax = this.sceneObjects.length; i < iMax; i++) {
          var scene_object = this.sceneObjects[i];
          if (scene_object.parent !== null) {
            continue;
          } //if

          if (scene_object.visible === false || scene_object.shadowCast === false) {
            continue;
          } //if

          scene_object.doTransform();

          if (scene_object.obj !== null) {
            if (scene_object.scale[0] < 0) {
              sflip = !sflip;
            }
            if (scene_object.scale[1] < 0) {
              sflip = !sflip;
            }
            if (scene_object.scale[2] < 0) {
              sflip = !sflip;
            }

            if (sflip) {
              gl.cullFace(gl.FRONT);
            }

            var mesh = scene_object.obj;
            
            if (mesh.morphTargets !== null) {
              if (scene_object.morphSource !== -1) mesh.setMorphSource(scene_object.morphSource);
              if (scene_object.morphTarget !== -1) mesh.setMorphTarget(scene_object.morphTarget);;
              if (scene_object.morphWeight !== null) mesh.morphWeight = scene_object.morphWeight;
            }

            CubicVR.renderObject(mesh, light.dummyCam, scene_object.tMatrix, [lDepthPack]);

            if (sflip) {
              gl.cullFace(gl.BACK);
            }

            sflip = false;
          } //if

          if (scene_object.children !== null) {
            this.renderSceneObjectChildren(scene_object, light.dummyCam, [lDepthPack]);
          } //if
        } //for i
        light.shadowEnd();
      } //if shadowed
    } // for l

    if (has_shadow) {
      gl.viewport(dims[0], dims[1], dims[2], dims[3]);  
    }

    // End experimental shadow code..  
  }

  Scene.prototype.updateCamera = function() {
    var gl = GLCore.gl;
    if (this.camera.manual===false)
    {    
      if (this.camera.targeted) {
        this.camera.lookat(this.camera.position[0], this.camera.position[1], this.camera.position[2], this.camera.target[0], this.camera.target[1], this.camera.target[2], 0, 1, 0);
      } else {
        this.camera.calcProjection();
      }
    }
    
    GLCore.depth_alpha_near = this.camera.nearclip;
    GLCore.depth_alpha_far = this.camera.farclip;
  }

  Scene.prototype.resize = function(w_in, h_in) {
    if (this.camera) {
      this.camera.setDimensions(w_in,h_in);
    }
  }

  Scene.prototype.render = function() {
    ++this.frames;

    this.updateCamera();
    
    for (var i = 0, iMax = this.lights.length; i < iMax; i++) {
      this.lights[i].prepare(this.camera);
    }
    
    var gl = GLCore.gl;
    var frustum_hits;

    var use_octree = this.octree !== undef;
    var lights_rendered = 0;
    if (use_octree) {
      for (var i = 0, l = this.dynamic_lights.length; i < l; ++i) {
        var light = this.dynamic_lights[i];
        light.doTransform();
      } //for
      this.octree.reset_node_visibility();
      this.octree.cleanup();
      frustum_hits = this.octree.get_frustum_hits(this.camera);
      lights_rendered = frustum_hits.lights.length;
    } //if
    var sflip = false;
    var objects_rendered = 0;
    var lights_list = [];

    for (var i = 0, iMax = this.sceneObjects.length; i < iMax; i++) {

      var lights = this.lights;
      var scene_object = this.sceneObjects[i];
      if (scene_object.parent !== null) {
        continue;
      } //if

      scene_object.doTransform();

      if (use_octree) 
      {
        lights = [];
        if (scene_object.dirty && scene_object.obj !== null) {
          scene_object.adjust_octree();
        } //if

        if (scene_object.visible === false || (use_octree && (scene_object.ignore_octree || scene_object.drawn_this_frame === true || scene_object.culled === true))) {
          continue;
        } //if

        //lights = frustum_hits.lights;
        lights = scene_object.dynamic_lights;
        //lights = this.lights;
        
        lights = lights.concat(scene_object.static_lights);
        lights = lights.concat(this.global_lights);
        if (this.collect_stats) {
          lights_rendered = Math.max(lights.length, lights_rendered);
          if (lights_rendered === lights.length) {
            lights_list = lights;
          } //if
          ++objects_rendered;
        } //if

        if (lights.length === 0) {
          lights = [GLCore.emptyLight];
        } else {
          lights = lights.sort(cubicvr_lightPackTypes)
        } //if

        scene_object.drawn_this_frame = true;
      }
      else if (scene_object.visible === false) {
        continue;
      } //if

      if (scene_object.obj !== null) {
        if (scene_object.scale[0] < 0) {
          sflip = !sflip;
        }
        if (scene_object.scale[1] < 0) {
          sflip = !sflip;
        }
        if (scene_object.scale[2] < 0) {
          sflip = !sflip;
        }

        if (sflip) {
          gl.cullFace(gl.FRONT);
        }

        var mesh = scene_object.obj;

        if (mesh.morphTargets !== null) {
          if (scene_object.morphSource !== -1) mesh.setMorphSource(scene_object.morphSource);
          if (scene_object.morphTarget !== -1) mesh.setMorphTarget(scene_object.morphTarget);;
          if (scene_object.morphWeight !== null) mesh.morphWeight = scene_object.morphWeight;
        }
        
        CubicVR.renderObject(mesh, this.camera, scene_object.tMatrix, lights);

        if (sflip) {
          gl.cullFace(gl.BACK);
        }

        sflip = false;
      } //if
    
      if (scene_object.children !== null) {
        this.renderSceneObjectChildren(scene_object, this.camera, lights);
      } //if
    } //for
    
    if (this.collect_stats) {
      this.stats['objects.num_rendered'] = objects_rendered;
      this.stats['lights.num_rendered'] = lights_rendered;
      this.stats['lights.rendered'] = lights_list;
      this.stats['lights.num_global'] = this.global_lights.length;
      this.stats['lights.num_dynamic'] = this.dynamic_lights.length;
    } //if

    if (this.skybox !== null && this.skybox.ready === true) {
      gl.cullFace(gl.FRONT);
      var size = (this.camera.farclip * 2) / Math.sqrt(3.0);
      this.skybox.scene_object.position = [this.camera.position[0], this.camera.position[1], this.camera.position[2]];
      this.skybox.scene_object.scale = [size, size, size];
      this.skybox.scene_object.doTransform();
      CubicVR.renderObject(this.skybox.scene_object.obj, this.camera, this.skybox.scene_object.tMatrix, []);
      gl.cullFace(gl.BACK);
    } //if
  };

  Scene.prototype.bbRayTest = function(pos, ray, axisMatch) {
    var vec3 = CubicVR.vec3;
    var pt1, pt2;
    var selList = [];

    if (ray.length === 2) {
      ray = this.camera.unProject(ray[0], ray[1]);
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
        
        if (bb2[0]-bb1[0] < mindepth) {bb1[0] -= mindepth/2; bb2[0] += mindepth/2;}
        if (bb2[1]-bb1[1] < mindepth) {bb1[1] -= mindepth/2; bb2[1] += mindepth/2;}
        if (bb2[2]-bb1[2] < mindepth) {bb1[2] -= mindepth/2; bb2[2] += mindepth/2;}

        var center = vec3.multiply(vec3.add(bb1, bb2), 0.5);
        var testPt = vec3.getClosestTo(pt1, pt2, center);
        var testDist = vec3.length(vec3.subtract(testPt, center));

        var matches = 
        ((testPt[0] >= bb1[0] && testPt[0] <= bb2[0]) ? 1 : 0) + 
        ((testPt[1] >= bb1[1] && testPt[1] <= bb2[1]) ? 1 : 0) + 
        ((testPt[2] >= bb1[2] && testPt[2] <= bb2[2]) ? 1 : 0);

        if (matches >= axisMatch) {
          selList.push({dist:testDist, obj:obj});
        }
      }
    }

    if (selList.length) {
      selList.sort(function(a,b) { if (a.dist==b.dist) return 0; return (a.dist<b.dist) ?-1:1; });
    }

    return selList;
  };
  
   function DeferredBin()
 {
   this.meshBin = {};
   this.imageBin = {};
   
   this.meshMap = {};
   this.imageMap = {};
   
   this.imageBinPtr = {};
   this.meshBinPtr = {};
 }
 
 DeferredBin.prototype.addMesh = function(binId,meshId,meshObj) {
   if (this.meshBin[binId] === undef)
   {
     this.meshBin[binId] = [];
     if (this.meshBinPtr[binId]===undef) {
       this.meshBinPtr[binId] = 0;       
     }
   }

   if (this.meshMap[meshId] === undef)
   {
     this.meshMap[meshId] = meshObj;
     this.meshBin[binId].push(meshObj);
   }
 }
 
 DeferredBin.prototype.addImage = function(binId,imageId,imageObj) {
   if (this.imageBin[binId] === undef)
   {
     this.imageBin[binId] = [];
     if (this.imageBinPtr[binId]===undef) {
       this.imageBinPtr[binId] = 0;       
     }
   }
   
   if (this.imageMap[imageId] === undef)
   {
     this.imageMap[imageId] = imageObj;
     this.imageBin[binId].push(imageObj);
   }
 };
 
 DeferredBin.prototype.getMeshes = function(binId) {
   return this.meshBin[binId];
 };

 DeferredBin.prototype.getImages = function(binId) {
   return this.imageBin[binId];
 };
 
 DeferredBin.prototype.rewindMeshes = function(binId) {
   this.meshBinPtr[binId] = 0;
 };
 
 DeferredBin.prototype.rewindImages = function(binId) {
   this.imageBinPtr[binId] = 0;
 };
 
 DeferredBin.prototype.getNextMesh = function(binId) {
   var cBin = this.meshBinPtr[binId];

   if (cBin<this.meshBin[binId].length)
   {
     this.meshBinPtr[binId]++;
     return this.meshBin[binId][cBin];
   }
   
   return null;
 };
 
 DeferredBin.prototype.loadNextMesh = function(binId)
 {
   var mesh = this.getNextMesh(binId);
   
   if (mesh !== null)
   {
     if (mesh.compiled===null)
     {
       mesh.triangulateQuads();
       mesh.compile();
       mesh.clean();
     }
     
     return true;
   }

   return false;
 };

 DeferredBin.prototype.isMeshBinEmpty = function(binId) {
   //console.log('isMeshBinEmpty[' + binId + '] = ' + (this.meshBinPtr[binId] === this.meshBin[binId].length) + ' meshBinPtr = ' + this.meshBinPtr[binId] + ' meshBin.length = ' + this.meshBin[binId].length);
   return this.meshBinPtr[binId] === this.meshBin[binId].length;
 };

 DeferredBin.prototype.loadNextImage = function(binId)
 {
   var img = this.getNextImage(binId);
   
   if (img !== null) {
     img.src = img.deferredSrc;
//     return true;
   }

//   return false;
 };
 
 
 DeferredBin.prototype.getNextImage = function(binId) {
   var cBin = this.imageBinPtr[binId];
   
   if (cBin<this.imageBin[binId].length)
   {
     this.imageBinPtr[binId]++;
     return this.imageBin[binId][cBin];
   }
   
   return null;
 };

 DeferredBin.prototype.isImageBinEmpty = function(binId) {
   //console.log('isImageBinEmpty[' + binId + '] = ' + (this.imageBinPtr[binId] === this.imageBin[binId].length));
   return this.imageBinPtr[binId] === this.imageBin[binId].length ;
 };
  



 /* SkyBox */

 function SkyBox(in_obj) {
   var texture = in_obj.texture;
   var mapping = in_obj.mapping;

   var that = this;

   this.mapping = null;
   this.ready = false;
   this.texture = null;

   this.onready = function() {
     texture.onready = null;
     var tw = 1/base.Images[that.texture.tex_id].width;
     var th = 1/base.Images[that.texture.tex_id].height;
     if (that.mapping === null) {
       that.mapping = [[1/3, 0.5, 2/3-tw, 1],//top
                       [0, 0.5, 1/3, 1],        //bottom
                       [0, 0, 1/3-tw, 0.5],  //left
                       [2/3, 0, 1, 0.5],        //right
                       [2/3+tw, 0.5, 1, 1],  //front
                       [1/3, 0, 2/3, 0.5]];     //back
     } //if

     var mat = new CubicVR.Material("skybox");
     var obj = new CubicVR.Mesh();
     obj.sky_mapping = that.mapping;
     cubicvr_boxObject(obj, 1, mat);
     obj.calcNormals();
     var mat_map = new CubicVR.UVMapper();
     mat_map.projection_mode = enums.uv.projection.SKY;
     mat_map.scale = [1, 1, 1];
     mat_map.apply(obj, mat);
     obj.triangulateQuads();
     obj.compile();
     mat.setTexture(texture);
     that.scene_object = new CubicVR.SceneObject(obj);

     that.ready = true;
   } //onready

   if (texture) {
     if (typeof(texture) === "string") {
       texture = new CubicVR.Texture(texture, null, null, null, this.onready);
     }
     else if (!texture.loaded){
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
