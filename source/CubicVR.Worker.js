/*
  Javascript port of CubicVR 3D engine for WebGL
  https://github.com/cjcliffe/CubicVR.js/
  http://www.cubicvr.org/

  May be used under the terms of the MIT license.
  http://www.opensource.org/licenses/mit-license.php
*/

CubicVR.RegisterModule("Worker", function(base) {
  
  try {
    if (!window) {
      self.window = self;
      self.document = {};
      self.fakeWindow = true;
      self.console = {
        log: function () {}
      };
    }
  }
  catch (e) {
    self.window = self;
    self.document = {};
    self.fakeWindow = true;
    self.console = {
      log: function () {}
    };
  }

  var GLCore = base.GLCore,
      enums = CubicVR.enums,
      undef = base.undef,
      Mesh = CubicVR.Mesh,
      Texture = CubicVR.Texture,
      Material = CubicVR.Material,
      SceneObject = CubicVR.SceneObject,
      Motion = CubicVR.Motion,
      Envelope = CubicVR.Envelope,
      DeferredBin = CubicVR.DeferredBin,
      util = CubicVR.util;

  function ResourcePool(poolSettings) {
    var that = this,
        files = {},
        managers = {};

    function SceneFileManager (settings) {
      var parsedFunc = settings.parsed || function () {};
      var readyFuncs = {};
      var fileWorker;
      if (settings.url.match(/\.dae/)) {
        fileWorker = new CubicVR.Worker({
          type: "sceneFile",
          data: settings.url,
          message: function (message) {
            if (message.message === "loaded") {
              var domParser = new DOMParser(),
                  xml = domParser.parseFromString(message.data, "text/xml"),
                  clSource = util.xml2badgerfish(xml);
              console.log(xml);
              fileWorker.send("parse", clSource);
            }
            else if (message.message === "getMesh") {
              var mesh = new Mesh();
              for (var prop in message.data.mesh) {
                if (message.data.mesh.hasOwnProperty(prop)) {
                  mesh[prop] = message.data.mesh[prop];
                } //if
              } //for
              mesh.bindBuffer(mesh.bufferVBO(message.data.vbo));
              if (readyFuncs["getMesh"]) {
                readyFuncs["getMesh"](mesh);
              } //if
            }
            else if (message.message === "parsed") {
              parsedFunc();
            } //if
          }
        });
      } //if
     
      this.getSceneObject = function (name, readyFunc) {
        fileWorker.send("getMesh", name);
        readyFuncs["getMesh"] = readyFunc;
      };

    }

    this.createSceneFileManager = function (settings) {
      var manager = new SceneFileManager({
        url: settings.url,
        parsed: settings.parsed
      });
      managers[settings.url] = manager;
      return manager;
    };

    this.removeSceneFileManager = function (manager) {
      if (typeof(settings) === "string") {
        delete managers[settings];
      }
      else {
        for ( var name in managers ) {
          if (managers[name] === manager) { 
            delete managers[name];
          } //if
        } //for
      } //if
    };

    function prepareObject (object, templateObject) {
      for (var prop in object) {
        if (object.hasOwnProperty(prop)) {
          templateObject[prop] = object[prop];
        } //if
      } //for
      return templateObject;
    } //prepareMesh

    this.createSceneObjectFromMesh = function (settings) {
      var scene = settings.scene,
          mesh = settings.mesh,
          meshObject = settings.object,
          assetBase = settings.assetBase || "",
          options = settings.options;

      var manager = that.createSceneFileManager({
        url: mesh,
        parsed: function () {
          if (meshObject) {
            manager.getSceneObject(meshObject, function (mesh) {
              var newMesh = prepareObject(mesh, new Mesh());
              for (var i=0, li=newMesh.materials.length; i<li; ++i) {
                var mat = prepareObject(newMesh.materials[i], new Material());
                for (var j=0, lj=mat.textures.length; j<lj; ++j) {
                  var tex = mat.textures[i];
                  mat.textures[i] = new Texture(assetBase + tex.img_path, tex.filter_type);
                } //for
                newMesh.materials[i] = mat;
              } //for
              var sceneObject = new SceneObject(newMesh);
              scene.bindSceneObject(sceneObject);
            });
          } //if
        }
      });
    };

    this.loadFile = function (filename, callback) {
      callback = callback || function (data) { files[filename] = data; };
      var fileWorker = new CubicVR.Worker({
        type: "file",
        data: mesh,
        message: function (message) {
          callback(message.data);
        }
      });
    };

  }

  function CubicVR_Worker(settings) {
    this.worker = new Worker(CubicVR.getScriptLocation() + "CubicVR.js");
    this.message = settings.message || function () {};
    this.error = settings.error || function (e) { console.log("Error: " + e.message + ": " + e.lineno); };
    this.type = settings.type;
    var that = this;

    this.worker.onmessage = function(e) {
      that.message(e.data);
    };

    this.worker.onerror = function(e) {
      that.error(e);
    }; //onerror

    this.init = function(data) {
      that.send('init', {type: that.type, data: data});
    };

    this.send = function(message, data) {
      that.worker.postMessage({
        message: message,
        data: data 
      });
    };

    this.send('CubicVR_InitWorker', CubicVR.getScriptLocation());

    if (settings.data || settings.autoStart) {
      that.init(settings.data);
    } //if

  } //CubicVR_Worker 

  function WorkerConnection(options) {
    var that = this;
    this.message = options.message || function () {};

    this.send = function (message, data) {
      postMessage({message: message, data:data});
    };

    self.addEventListener('message', function (e) {
      if (e.data.message !== 'init') {
        that.message(e.data);
      } //if
    }, false);
  } //WorkerConnection

  function TestWorker(data) {
    var that = this;

    function message (data) {
      setTimeout(function() {
        connection.send("test", data);
      }, 1000);
    }

    if (data) {
      message(data);
    } //if

    var connection = new WorkerConnection({
      message: message
    });
  } //TestWorker

  function FileDataWorker(data) {
    var that = this,
        connection;

    function load(filename) {
      var file = util.getURL(filename);
      connection.send("done", file.length);
    }

    connection = new WorkerConnection({
      message: function (data) {
        load(data);
      }
    });

    if (data) {
      load(data);
    } //if

  } //FileDataWorker

  function SceneFileWorker(data) {
    var that = this,
        connection,
        deferred,
        filename,
        scene;

    function load(file) {
      filename = file;
      var fileData = util.getURL(file);
      connection.send("loaded", fileData);
    }

    connection = new WorkerConnection({
      message: function (message) {
        if (message.message === "parse") {
          deferred = new DeferredBin();
          scene = CubicVR.loadCollada("", "", deferred, message.data);
          connection.send("parsed");
        }
        else if (message.message === "getMesh") {
          var mesh = deferred.meshMap[":" + message.data];
          if (mesh) {
            var compiled = mesh.triangulateQuads().compileVBO(mesh.compileMap());
            connection.send("getMesh", {mesh: mesh, vbo: compiled});
          } //if
        }
        else {
          throw new Error("Not a SceneFileWorker command: " + message.message);
        } //if
      }
    });

    if (data) {
      load(data);
    } //if

  } //SceneFileWorker

  function PrepareMeshWorker(data) {
    var that = this,
        connection;

    function compile(meshData) {
      var mesh = new Mesh();
      for (var prop in meshData) {
        if (meshData.hasOwnProperty(prop)) {
          mesh[prop] = meshData[prop];
        } //if
      } //for
      var compiled = mesh.triangulateQuads().compileVBO(mesh.compileMap());
      connection.send("done", compiled);
    } //compile

    connection = new WorkerConnection({
      message: function (data) {
        compile(data);
      }
    });

    if (data) {
      compile(data);
    } //if
  } //CompileWorker

//  function OctreeWorkerProxy(size, depth) {
//    var that = this;
//    this.size = size;
//    this.depth = depth;
//    this.worker = new CubicVR_Worker({
//        message: function(e) {
//          console.log('Octree Worker Message:', e);
//        },
//        error: function(e) {
//          console.log('Octree Worker Error:', e);
//        },
//        type: 'octree'});
//    this.worker.start();
//
//    this.init = function(scene) {
//      that.scene = scene;
//      that.worker.init({
//        size: that.size,
//        max_depth: that.depth,
//        camera: scene.camera
//      });
//    }; //init
//    this.insert = function(node) {
//      that.worker.send({message:'insert', node:node});
//    }; //insert
//    this.draw_on_map = function() {
//      return;
//    }; //draw_on_map
//    this.reset_node_visibility = function() {
//      return;
//    }; //reset_node_visibility
//    this.get_frustum_hits = function() {
//    }; //get_frustum_hits
//  } //OctreeWorkerProxy
//
//  function CubicVR_OctreeWorker() {
//    this.octree = null;
//    this.nodes = [];
//    this.camera = null;
//  } //CubicVR_OctreeWorker::Constructor
//
//  CubicVR_OctreeWorker.prototype.onmessage = function(input) {
//    var message = input.message;
//    if (message === "init") {
//      var params = input.data;
//      this.octree = new Octree(params.size, params.max_depth);
//      this.camera = new Camera();
//    }
//    else if (type === "set_camera") {
//      var data = message.data;
//      this.camera.mvMatrix = data.mvMatrix;
//      this.camera.pMatrix = data.pMatrix;
//      this.camera.position = data.position;
//      this.camera.target = data.target;
//      this.camera.frustum.extract(this.camera, this.camera.mvMatrix, this.camera.pMatrix);
//    }
//    else if (type === "insert") {
//      var json_node = JSON.parse(message.data);
//      var node = new SceneObject();
//      var trans = new Transform();
//      var i;
//
//      for (i in json_node) {
//        if (json_node.hasOwnProperty(i)) {
//          node[i] = json_node[i];
//        } //if
//      } //for
//
//      for (i in json_node.trans) {
//        if (json_node.trans.hasOwnProperty(i)) {
//          trans[i] = json_node.trans[i];
//        } //if
//      } //for
//
//      node.trans = trans;
//      node.id = json_node.id;
//
//      this.octree.insert(node);
//      this.nodes[node.id] = node;
//    }
//    else if (type === "cleaup") {
//      this.octree.cleanup();
//    } //if
//  }; //onmessage

  function FrustumWorkerProxy(worker, camera) {
    this.camera = camera;
    this.worker = worker;
    this.draw_on_map = function(map_context) {
      return;
    };
  } //FrustumWorkerProxy

  FrustumWorkerProxy.prototype.extract = function(camera, mvMatrix, pMatrix) {
    this.worker.send({
      type: "set_camera",
      data: {
        mvMatrix: this.camera.mvMatrix,
        pMatrix: this.camera.pMatrix,
        position: this.camera.position,
        target: this.camera.target
      }
    });
  }; //FrustumWorkerProxy::extract

  function cubicvr_loadColladaWorker(meshUrl, prefix, callback, deferred_bin) {
    var worker;
    try {
      worker = new Worker(CubicVR.getScriptLocation() + 'collada.js');
    }
    catch(e) {
      throw new Error("Can't find collada.js");
    } //try

    var materials_map = [];
    var meshes_map = [];

    worker.onmessage = function(e) {

      var i,
        maxI;

      function copyObjectFromJSON(json, obj) {
        for (var i in json) {
          obj[i] = json[i];
        } //for
      } //new_obj

      function reassembleMotion(obj) {
        //reassemble linked-list for sceneObject motion envelope keys
        if (obj.motion) {
          var co = obj.motion.controllers;
          var new_controllers = [];
          for (var j=0, maxJ=co.length; j<maxJ; ++j) {
            var con = co[j];
            if (!con) {
              co[j] = null; // XXXhumph was undefined;
              continue;
            }
            var new_con = [];
            for (var k=0, maxK=con.length; k<maxK; ++k) {
              var env = con[k];
              if (!env) {
                con[k] = null; // XXXhumph was undefined;
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

              var envelope = new Envelope();
              copyObjectFromJSON(env, envelope);
              new_con[k]=envelope;
            } //for k
            new_controllers[j] = new_con;
          } //for j
          obj.motion.controllers = new_controllers;
          var motion = new Motion();
          copyObjectFromJSON(obj.motion, motion);
          obj.motion = motion;
        } //if
      } //reassembleMotion

      function createSceneObject(scene_obj) {
        var sceneObject = new SceneObject();
        copyObjectFromJSON(scene_obj, sceneObject);
        if (scene_obj.obj !== null) {
          var stored_mesh = meshes_map[scene_obj.obj.id];
          if (stored_mesh === undef) {
            var mesh = new Mesh();
            copyObjectFromJSON(scene_obj.obj, mesh);
            sceneObject.obj = mesh;
            meshes_map[scene_obj.obj.id] = mesh;
            if (deferred_bin) {
              if (mesh.points.length > 0) {
                deferred_bin.addMesh(meshUrl,meshUrl+":"+mesh.id,mesh);
                for (var f=0,maxF=mesh.faces.length; f<maxF; ++f) {
                  var face = mesh.faces[f];
                  var m_index = face.material;
                  var mapped = materials_map[m_index];
                  if (mapped !== undef) {
                    face.material = materials_map[m_index];
                  } else {
                    face.material = 0;
                  } //if
                } //for
              } //if
            } else {
              sceneObject.obj.triangulateQuads();
              sceneObject.obj.calcNormals();
              sceneObject.obj.compile();
              sceneObject.obj.clean();
            } //if
          } else {
            sceneObject.obj = stored_mesh;
          } //if
        } //if

        sceneObject.trans = new Transform();

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

      var message = e.data.message;
      if (message == 'materials') {
        var mats = JSON.parse(e.data.data);
        for (i=0, maxI=mats.length; i<maxI; ++i) {
          var new_mat = new Material(mats[i].name);
          var mat_id = new_mat.material_id;
          copyObjectFromJSON(mats[i], new_mat);
          new_mat.material_id = mat_id;
          materials_map[mats[i].material_id] = mat_id;
          for (var j=0, maxJ=mats[i].textures.length; j<maxJ; ++j) {
            var dt = mats[i].textures[j];
            if (dt) {
              var stored_tex = Texture_ref[dt.img_path];

              if (stored_tex === undef) {
                var t = new Texture(dt.img_path, dt.filter_type, deferred_bin, meshUrl);
                new_mat.textures[j] = t;
              }
              else {
                new_mat.textures[j] = Textures_obj[stored_tex];
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

        for (i=0, maxI=scene.sceneObjects.length; i<maxI; ++i) {
          var so = scene.sceneObjects[i];

          if (so.obj !== null) {
           nop();
          } //if

          if (so.reassembled === undef) {
            reassembleMotion(so);
            so.reassembled = true;
          } //if

          scene.sceneObjects[i] = createSceneObject(so);

        } //for i

        var new_scene = new Scene();
        // place parsed scene elements into new scene (since parse scene has no prototype)
        var camera = new_scene.camera;
        var camera_transform = camera.transform;
        copyObjectFromJSON(scene.camera, camera);
        copyObjectFromJSON(scene.camera.transform, camera_transform);
        reassembleMotion(camera);
        new_scene.camera = camera;
        new_scene.camera.transform = camera_transform;
        new_scene.camera.frustum = new Frustum();

        for (i=0, maxI=scene.sceneObjects.length; i<maxI; ++i) {
          var o = scene.sceneObjects[i];
          new_scene.bindSceneObject(o);
          try {
            o.getAABB();
          }
          catch(ex) {
            //console.log(o);
          } //try
          
        } //for

        for (i=0, maxI=scene.lights.length; i<maxI; ++i) {
          var l = new Light();
          copyObjectFromJSON(scene.lights[i], l);
          l.trans = new Transform();
          reassembleMotion(l);
          new_scene.bindLight(l);
        } //for

        callback(new_scene);
      }
      else {
        console.log("message from collada worker:", e.data.message);
      } //if
    }; //onmessage

    worker.onerror = function(e) {
      console.log("error from collada worker:", e.message);
    }; //onerror

    worker.postMessage({message:'start', params: {meshUrl: meshUrl, prefix: prefix, rootDir: CubicVR.getScriptLocation()}});
  } //cubicvr_loadColladaWorker

  function InitWorker () {
    var workerMap = {
      test: TestWorker,
      prepareMesh: PrepareMeshWorker,
      file: FileDataWorker,
      sceneFile: SceneFileWorker
    };

    self.addEventListener('message', function(e) {
      var message = e.data.message;
      if (message === "init") {
        var type = e.data.data.type;
        if (type in workerMap) {
          new workerMap[type](e.data.data.data);
        }
        else {
          throw new Error("Invalid worker type.");
        } //if
      } //if
    }, false);
  } //InitWorker

  return {
    Worker: CubicVR_Worker,
    ResourcePool: ResourcePool,
    loadColladaWorker: cubicvr_loadColladaWorker,
    InitWorker: InitWorker
  };
 
});

