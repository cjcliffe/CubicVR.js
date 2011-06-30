/*
  Javascript port of CubicVR 3D engine for WebGL
  by Charles J. Cliffe
  http://www.cubicvr.org/

  May be used under the terms of the MIT license.
  http://www.opensource.org/licenses/mit-license.php
*/

/*globals alert: false */

(function(window, document, Math, nop, undef) {

  /** Global Constants **/
  var M_TWO_PI = 2.0 * Math.PI;
  var M_HALF_PI = Math.PI / 2.0;

  var SCRIPT_LOCATION = "";

  try {
    var scriptNodes = document.querySelectorAll("script");
    for (var i = 0, iMax = scriptNodes.length; i<iMax; i++) {
      var pos = scriptNodes[i].src.lastIndexOf('/CubicVR.js');
      if (pos > -1) {
        SCRIPT_LOCATION = scriptNodes[i].src.substr(0, pos) + "/";
      } //if
    }
  }
  catch(e) {
    // likely that 'document' is not defined (doesn't really matter)
  } //try

  var CubicVR = window['CubicVR'] = {};
  
  var GLCore = {
    CoreShader_vs: null,
    CoreShader_fs: null,
    canvas: null,
    width: null,
    height: null,
    fixed_aspect: 0.0,
    fixed_size: null,
    depth_alpha: false,
    default_filter: 1, // LINEAR_MIP
    mainloop: null,
    shadow_near: 0.1,
    shadow_far: 100,
    soft_shadow: false,
    resize_active: false,
    emptyLight: null,
    resizeList: []
  };


  var log;
  try {
    log = (console !== undefined && console.log) ?
      function(msg) { console.log("CubicVR Log: " + msg); } :
      function() {};
  }
  catch(e) {
    log = function() {};
  } //try

  var base = {
    undef: undef,
    scriptLocation: SCRIPT_LOCATION,
    GLCore: GLCore,
    Textures: [],
    Textures_obj: [],
    Textures_ref: [],
    Images: [],
    ShaderPool: [],
    log: log,
    registry: { Core:true }, // new modules register here
    MAX_LIGHTS: 6
  };
  
  function registerModule(module_id, module_in) {
    base.registry[module_id] = true;
    //log("Registering Module: "+module_id);
    var extend = module_in(base);
    for (var ext in extend) {
       if (extend.hasOwnProperty(ext)) {
         //log("Added extension: "+ext);
         CubicVR[ext] = extend[ext];
      }
    }
  }
  
   var cubicvr_identity = [1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0];

  var enums = {

  };
  
  /* Core Init, single context only at the moment */
  GLCore.init = function(gl_in, vs_in, fs_in) {
    var gl;
    var util = CubicVR.util;

    if (vs_in && fs_in) {
      vs_in = util.getScriptContents(vs_in);
      fs_in = util.getScriptContents(fs_in);
    } else {  // default shader handler if no custom override specified
      // See if they have been embeded in js
      if (CubicVR.CubicVRCoreVS && CubicVR.CubicVRCoreFS) {
        vs_in = CubicVR.CubicVRCoreVS;
        fs_in = CubicVR.CubicVRCoreFS;
      } else {
        vs_in = util.getScriptContents(SCRIPT_LOCATION + "CubicVR_Core.vs");
        fs_in = util.getScriptContents(SCRIPT_LOCATION + "CubicVR_Core.fs");
      }
    }

    if (gl_in === undef) {  // no canvas? no problem!
      gl_in = document.createElement("canvas");
      if (!gl) gl = gl_in.getContext("experimental-webgl");
      GLCore.gl = gl;
      
      if (GLCore.fixed_size !== null) {
        GLCore.width = GLCore.fixed_size[0];
        GLCore.height = GLCore.fixed_size[1];
        GLCore.resizeElement(gl_in,GLCore.width,GLCore.height);
      } else {
        gl_in.style.position = "absolute";        
        // document.body.style.margin = "0px";        
        // document.body.style.padding = "0px";        
        GLCore.addResizeable(gl_in);
        GLCore.resizeElement(gl_in,window.innerWidth,window.innerHeight);
      }
      
      document.body.appendChild(gl_in);
    }
    
    if (gl_in.getContext !== undef && gl_in.width !== undef && gl_in.height !== undef)
    {
      try {
            if (!gl) gl = gl_in.getContext("experimental-webgl");
            gl.viewport(0, 0, gl_in.width, gl_in.height);
            GLCore.canvas = gl_in;
            GLCore.width = gl_in.width;
            GLCore.height = gl_in.height;
            
            // set these default, can always be easily over-ridden
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
            gl.clearDepth(1.0);
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);            
      } catch (e) {}
      
      if (!gl) {
//         alert("Could not initialise WebGL, sorry :-(");
         return null;
      }
    }
    else
    {
      gl = gl_in;      
    }

    GLCore.gl = gl;
    GLCore.CoreShader_vs = vs_in;
    GLCore.CoreShader_fs = fs_in;

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    for (var i = enums.light.type.NULL; i < enums.light.type.MAX; i++) {
      base.ShaderPool[i] = [];
    }

    var dummyTex = new CubicVR.Texture();
    var lightTest = new CubicVR.Material();

    for (var i = 0; i < enums.texture.map.MAX; i++) {
      if (i===enums.texture.map.BUMP) continue; // fix for crashy fglrx driver, todo: check it against newer revisions.
      lightTest.setTexture(dummyTex,i);
    }
    lightTest.opacity = 0.5;

    var lc = 1;
    
    try {
      while (1) {
        lightTest.use(enums.light.type.POINT,lc);
        if (lc === 8) {
          base.MAX_LIGHTS=lc;      
          break;
        }
        lc++;
      }
    } catch (e) {
      base.MAX_LIGHTS=lc;      
      // console.log(e);
    }

    var emptyLight = GLCore.emptyLight = new CubicVR.Light(enums.light.type.POINT);
    emptyLight.diffuse = [0, 0, 0];
    emptyLight.specular = [0, 0, 0];
    emptyLight.distance = 0;
    emptyLight.intensity = 0;
    emptyLight.cutoff = 0;


    log("Calibrated maximum lights per pass to: "+lc);
    

    for (var i = enums.light.type.NULL; i < enums.light.type.MAX; i++) {
      base.ShaderPool[i] = [];
    }
    
    if (GLCore.resizeList.length) {
      window.addEventListener('resize',  function()  { CubicVR.GLCore.onResize(); }, false);
      GLCore.resize_active = true;
    }
    
    return gl;
  };
  
  GLCore.addResizeable = function(e) {
    CubicVR.GLCore.resizeList.push(e);
  }
  
  GLCore.onResize = function() {
    var w = window.innerWidth;
    var h = window.innerHeight; 
    
    if (GLCore.fixed_size !== null) {
      w = CubicVR.GLCore.fixed_size[0];
      h = CubicVR.GLCore.fixed_size[1];
    }
    
    for (var i = 0, iMax = CubicVR.GLCore.resizeList.length; i < iMax; i++) {
      GLCore.resizeElement(CubicVR.GLCore.resizeList[i],w,h);
    }    
  }
  
  GLCore.setFixedAspect = function(fa_in) {
    CubicVR.GLCore.fixed_aspect = fa_in;
  }
  
  GLCore.setFixedSize = function(fs_width, fs_height) {
    CubicVR.GLCore.fixed_size = [fs_width,fs_height];
  }
  
  GLCore.getCanvas = function() {
    return CubicVR.GLCore.canvas;
  }

  GLCore.resizeElement = function(e,width,height) {
    var gl = GLCore.gl;

    if (GLCore.fixed_aspect !== 0.0) {
  		var aspect_height = width*(1.0/CubicVR.GLCore.fixed_aspect);
  		if (aspect_height > height) { 
  		  aspect_height = height;
  		  width = height*CubicVR.GLCore.fixed_aspect;
		  }
		  height = aspect_height;
    }
    
    if (e.getContext !== undef) {
      e.width = width;
      e.height = height;
      
      if (!CubicVR.GLCore.fixed_size) {
        e.style.left = parseInt(window.innerWidth/2.0-width/2.0)+"px";
        e.style.top = parseInt(window.innerHeight/2.0-height/2.0)+"px";
      } 
            
      gl.viewport(0, 0, width, height);          
    } else {
      e.resize(width,height);
    }
  }

  GLCore.setDepthAlpha = function(da, near, far) {
    GLCore.depth_alpha = da;
    GLCore.depth_alpha_near = near;
    GLCore.depth_alpha_far = far;
  };

  GLCore.setDefaultFilter = function(filterType) {
    GLCore.default_filter = filterType;
  };

  GLCore.setSoftShadows = function(bSoft) {
    GLCore.soft_shadow = bSoft;
  }
  


  /*****************************************************************************
   * Workers
   *****************************************************************************/

  function CubicVR_Worker(settings) {
    this.worker = new Worker(SCRIPT_LOCATION + "CubicVR.js");
    this.message = settings.message;
    this.error = settings.error;
    this.type = settings.type;
    var that = this;
    this.worker.onmessage = function(e) {
      if (that.message) {
        that.message(e.data);
      } //if
    };
    this.worker.onerror = function(e) {
      if (that.error) {
        that.error(e);
      } else {
        log("Error: " + e.message + ": " + e.lineno);
      } //if
    }; //onerror
    this.fn = function(fn, options) {
      that.worker.postMessage({
        message: "function",
        data: fn,
        options: options
      });
    };
    this.start = function(options) {
      that.worker.postMessage({
        message: "start",
        data: that.type,
        options: options
      });
    };
    this.init = function(data) {
      that.send({message:'init', data:data});
    };
    this.stop = function() {
      that.worker.postMessage({
        message: "stop",
        data: null
      });
    };
    this.send = function(message) {
      that.worker.postMessage({
        message: "data",
        data: message
      });
    };
  }; //CubicVR_Worker::Constructor 

  function CubicVR_TestWorker() {
    var that = this;
    this.onmessage = function(message) {
      if (message.test) {
        setTimeout(function(){postMessage(message.test);}, 1000);
      }
      else {
        setTimeout(function(){throw new Error(message);}, 1000);
      } //if
    }; //onmessage
  }; //CubicVR_TestWorker

  function CubicVR_ColladaLoadWorker() {
    var that = this;
    this.onmessage = function(message) {
    }; //onmessage
  }; //CubicVR_ColladaLoadWorker

  function CubicVR_WorkerConnection() {
    this.listener = null;
  } //CubicVR_WorkerConnection
  var WorkerConnection = new CubicVR_WorkerConnection();

  if (1) {
    self.addEventListener('message', function(e) {
      var message = e.data.message;
      var type = e.data.data;
      if (message === "start") {
        if (type === "test") {
          WorkerConnection.listener = new CubicVR_TestWorker();
        }
        else if (type === "load_collada") {
          WorkerConnection.listener = new CubicVR_ColladaLoadWorker();
        } //if
      }
      else if (message === "function") {
        var data = e.data.data;
        var options = e.data.options;
        var parts = data.split('(');
        if (parts.length > 1 && parts[1].indexOf(')') > -1) {
          var prefix = parts[0];
          var suffix = parts[1].substr(0,parts[1].length-1);
          var args = options || suffix.split(',');
          var chain = prefix.split('.');
          var fn = CubicVR;
          for (var i=0; i<chain.length; ++i) {
            fn = fn[chain[i]];
          } //for
          if (fn && typeof fn === 'function') {
            var ret = fn.apply(fn, args);
            postMessage(ret);
          } //if
        }
        else {
          throw new Error('Worker command not formatted properly.');
        } //if
      }
      else if (message === "data") {
        if (WorkerConnection.listener !== null) {
          var data = e.data ? e.data.data : null;
          WorkerConnection.listener.onmessage(e.data.data);
        } //if
      }
      else if (message === "stop") {
        if (WorkerConnection.listener !== null && WorkerConnection.listener.stop) {
          WorkerConnection.listener.stop();
        } //if
      } //if
    }, false);
  } //if

 

 
function cubicvr_loadColladaWorker(meshUrl, prefix, callback, deferred_bin) {
  var worker;
  try {
    worker = new Worker(SCRIPT_LOCATION + 'collada.js');
  }
  catch(e) {
    throw new Error("Can't find collada.js");
  } //try

  var materials_map = [];
  var meshes_map = [];

  worker.onmessage = function(e) {

    function copyObjectFromJSON(json, obj) {
      for (var i in json) {
        obj[i] = json[i];
      } //for
    } //new_obj

    var message = e.data.message;
    if (message == 'materials') {
      var mats = JSON.parse(e.data.data);
      for (var i=0, maxI=mats.length; i<maxI; ++i) {
        var new_mat = new CubicVR.Material(mats[i].name);
        var mat_id = new_mat.material_id;
        copyObjectFromJSON(mats[i], new_mat);
        new_mat.material_id = mat_id;
        materials_map[mats[i].material_id] = mat_id;
        for (var j=0, maxJ=mats[i].textures.length; j<maxJ; ++j) {
          var dt = mats[i].textures[j];
          if (dt) {
            var stored_tex = base.Textures_ref[dt.img_path];

            if (stored_tex === undefined) {
              var t = new CubicVR.Texture(dt.img_path, dt.filter_type, deferred_bin, meshUrl);
              new_mat.textures[j] = t;
            }
            else {
              new_mat.textures[j] = base.Textures_obj[stored_tex];
            } //if
          }
          else {
            new_mat.textures[j] = 0;
          } //if
        } //for
      } //for
    }
    else if (message == 'scene') {
      var scene = JSON.parse(e.data.data);

      function reassembleMotion(obj) {
        //reassemble linked-list for sceneObject motion envelope keys
        if (obj.motion) {
          var co = obj.motion.controllers;
          var new_controllers = [];
          for (var j=0, maxJ=co.length; j<maxJ; ++j) {
            var con = co[j];
            if (!con) {
              co[j] = undefined;
              continue;
            }
            var new_con = [];
            for (var k=0, maxK=con.length; k<maxK; ++k) {
              var env = con[k];
              if (!env) {
                con[k] = undefined;
                continue;
              }
              var keys = env.keys[0];
              if (env.keys.length > 1) {
                keys.prev = null;
                keys.next = env.keys[1];
                keys = env.keys[1];
              } //if
              for (var keyI=1,maxKeyI=env.keys.length-1; keyI<maxKeyI; ++keyI) {
                keys.prev = env.keys[keyI-1];
                keys.next = env.keys[keyI+1];
                keys = env.keys[keyI+1];
              } //for keyI
              if (env.keys.length > 1) {
                keys = env.keys[env.keys.length-1];
                keys.prev = env.keys[env.keys.length-2];
                keys.next = null;
              } //if
              env.firstKey = env.keys[0];
              env.lastKey = env.keys[env.keys.length-1];
              env.keys = env.firstKey;

              var envelope = new CubicVR.Envelope();
              copyObjectFromJSON(env, envelope);
              new_con[k]=envelope;
            } //for k
            new_controllers[j] = new_con;
          } //for j
          obj.motion.controllers = new_controllers;
          var motion = new CubicVR.Motion();
          copyObjectFromJSON(obj.motion, motion);
          obj.motion = motion;
        } //if
      } //reassembleMotion

      for (var i=0, maxI=scene.sceneObjects.length; i<maxI; ++i) {
        var so = scene.sceneObjects[i];

        if (so.obj !== null) {
         nop();
        } //if

        if (so.reassembled === undefined) {
          reassembleMotion(so);
          so.reassembled = true;
        } //if

        function createSceneObject(scene_obj) {
          var sceneObject = new CubicVR.SceneObject();
          copyObjectFromJSON(scene_obj, sceneObject);
          if (scene_obj.obj !== null) {
            var stored_mesh = meshes_map[scene_obj.obj.id];
            if (stored_mesh === undefined) {
              var mesh = new CubicVR.Mesh();
              copyObjectFromJSON(scene_obj.obj, mesh);
              sceneObject.obj = mesh;
              meshes_map[scene_obj.obj.id] = mesh;
              if (deferred_bin) {
                if (mesh.points.length > 0) {
                  deferred_bin.addMesh(meshUrl,meshUrl+":"+mesh.id,mesh) 
                  for (var f=0,maxF=mesh.faces.length; f<maxF; ++f) {
                    var face = mesh.faces[f];
                    var m_index = face.material;
                    var mapped = materials_map[m_index];
                    if (mapped !== undefined) {
                      face.material = materials_map[m_index];
                    }
                    else {
                      face.material = 0;
                    } //if
                  } //for
                } //if
              }
              else {
                sceneObject.obj.triangulateQuads();
                sceneObject.obj.calcNormals();
                sceneObject.obj.compile();
                sceneObject.obj.clean();
              } //if
            }
            else {
              sceneObject.obj = stored_mesh;
            } //if
          } //if
          
          sceneObject.trans = new CubicVR.Transform();

          if (scene_obj.children && scene_obj.children.length > 0) {
            sceneObject.children = [];
            createChildren(scene_obj, sceneObject);
          } //if

          return sceneObject;
        } //createSceneObject

        function createChildren(scene_obj, sceneObject) {
          if (scene_obj.children) {
            for (var j=0, maxJ=scene_obj.children.length; j<maxJ; ++j) {
              var child = createSceneObject(scene_obj.children[j]);
              sceneObject.bindChild(child);
            } //for
          } //if
        } //createChildren

        scene.sceneObjects[i] = createSceneObject(so);

      } //for i

      var new_scene = new CubicVR.Scene();
      // place parsed scene elements into new scene (since parse scene has no prototype)
      var camera = new_scene.camera;
      var camera_transform = camera.transform;
      copyObjectFromJSON(scene.camera, camera);
      copyObjectFromJSON(scene.camera.transform, camera_transform);
      reassembleMotion(camera);
      new_scene.camera = camera;
      new_scene.camera.transform = camera_transform;
      new_scene.camera.frustum = new CubicVR.Frustum();

      for (var i=0, maxI=scene.sceneObjects.length; i<maxI; ++i) {
        var o = scene.sceneObjects[i];
        new_scene.bindSceneObject(o);
        try {
          o.getAABB();
        }
        catch(e) {
          //console.log(o);
        } //try
        
      } //for

      for (var i=0, maxI=scene.lights.length; i<maxI; ++i) {
        var l = new CubicVR.Light();
        copyObjectFromJSON(scene.lights[i], l);
        l.trans = new CubicVR.Transform();
        reassembleMotion(l);
        new_scene.bindLight(l);
      } //for

      callback(new_scene);
    }
    else {
      console.log("message from collada worker:", e.data.message);
    } //if
  } //onmessage

  worker.onerror = function(e) {
    console.log("error from collada worker:", e.message);
  } //onerror

  worker.postMessage({message:'start', params: {meshUrl: meshUrl, prefix: prefix, rootDir: SCRIPT_LOCATION}});
} //cubicvr_loadColladaWorker


// Extend CubicVR module by adding public methods and classes
var extend = {
  GLCore: GLCore,
  init: GLCore.init,
  addResizeable: GLCore.addResizeable,
  setFixedAspect: GLCore.setFixedAspect,
  setFixedSize: GLCore.setFixedSize,
  getCanvas: GLCore.getCanvas,
  enums: enums,
  IdentityMatrix: cubicvr_identity,
  Textures: base.Textures,
  Textures_obj: base.Textures_obj,
  Images: base.Images,
  globalAmbient: [0.1, 0.1, 0.1],
  setGlobalAmbient: function(c) {
    CubicVR.globalAmbient = c;
  },
  loadColladaWorker: cubicvr_loadColladaWorker,
  setGlobalDepthAlpha: GLCore.setDepthAlpha,
  setDefaultFilter: GLCore.setDefaultFilter,
  setSoftShadows: GLCore.setSoftShadows,
  Worker: CubicVR_Worker,
  RegisterModule:registerModule,
  getScriptLocation: function() { return SCRIPT_LOCATION; }
};

registerModule("Core",function(base) { return extend; });

}(window, window.document, Math, function(){console.log('nop!');}));

/* @cuthere */
/* --- SNIP FOR MINIFICATION --- */

// yes document.write is dirty, but it prevents race conditions since they're forced to load and parse now before this script completes
(function() {

  var CubicVR_Modules = [
    "Math","Utility","Shader","MainLoop",
    "Texture","Material","Mesh","UVMapper","Renderer",
    "Light","Camera","Motion","Scene","PostProcess","Layout",
    "Primitives","COLLADA","GML","Particles","Landscape", 
    "Octree","CVRXML", "Worker",
  ];

  for (var i = 0; i < CubicVR_Modules.length; i++) {
    document.write('<script type="text/javascript" src="'+CubicVR.getScriptLocation()+'/source/CubicVR.'+CubicVR_Modules[i]+'.js"></script>');
  }
})();
