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
    registry: { Core:true } // new modules register here
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
    // Math
    math: {},

    frustum: {
      plane: {
        LEFT: 0,
        RIGHT: 1,
        TOP: 2,
        BOTTOM: 3,
        NEAR: 4,
        FAR: 5
      }
    },

    octree: {
      TOP_NW: 0,
      TOP_NE: 1,
      TOP_SE: 2,
      TOP_SW: 3,
      BOTTOM_NW: 4,
      BOTTOM_NE: 5,
      BOTTOM_SE: 6,
      BOTTOM_SW: 7
    },


    // Light Types
    light: {
      type: {
        NULL: 0,
        POINT: 1,
        DIRECTIONAL: 2,
        SPOT: 3,
        AREA: 4,
        DEPTH_PACK: 5,  // this lets us pass the shadow stage in as a light definition
        SPOT_SHADOW: 6,
        MAX: 7
      },
      method: {
        GLOBAL: 0,
        STATIC: 1,
        DYNAMIC: 2
      }
    },

    // Texture Types
    texture: {
      map: {
        COLOR: 0,
        ENVSPHERE: 1,
        NORMAL: 2,
        BUMP: 3,
        REFLECT: 4,
        SPECULAR: 5,
        AMBIENT: 6,
        ALPHA: 7,
        MAX: 8
      },
      filter: {
        LINEAR: 0,
        LINEAR_MIP: 1,
        NEAREST: 2,
        NEAREST_MIP: 3
      }
    },

    // Shader Map Inputs (binary hash index)
    shader: {
      map: {
        COLOR: 1,
        SPECULAR: 2,
        NORMAL: 4,
        BUMP: 8,
        REFLECT: 16,
        ENVSPHERE: 32,
        AMBIENT: 64,
        ALPHA: 128
      },

      /* Uniform types */
      uniform: {
        MATRIX: 0,
        VECTOR: 1,
        FLOAT: 2,
        ARRAY_VERTEX: 3,
        ARRAY_UV: 4,
        ARRAY_FLOAT: 5,
        INT: 6
      }

    },

    /* Post Processing */
    post: {
      output: {
        REPLACE: 0,
        BLEND: 1,
        ADD: 2,
        ALPHACUT: 3
      }
    }
  };

  
  var MAX_LIGHTS=6;


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
          MAX_LIGHTS=lc;      
          break;
        }
        lc++;
      }
    } catch (e) {
      MAX_LIGHTS=lc;      
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

  /* Timer */

  function Timer() {
      this.time_elapsed = 0;
      this.system_milliseconds = 0;
      this.start_time = 0;
      this.end_time = 0;
      this.last_update = 0;
      this.paused_time = 0;
      this.offset = 0;
      this.paused_state = 0;
  }


  Timer.prototype.start = function () {
      this.update();
      this.num_updates = 0;
      this.start_time = this.system_milliseconds;
      this.last_update = this.start_time;
      this.paused_state = false;
      this.lock_state = false;
      this.lock_rate = 0;
      this.paused_time = 0;
      this.offset = 0;
  }


  Timer.prototype.stop = function () {
      this.end_time = this.system_milliseconds;
  }


  Timer.prototype.reset = function () {
      this.start();
  }


  Timer.prototype.lockFramerate = function (f_rate) {
      this.lock_rate = 1.0 / this.f_rate;
      this.lock_state = true;
  }


  Timer.prototype.unlock = function () {
      var msec_tmp = this.system_milliseconds;
      this.lock_state = false;
      this.update();
      this.last_update = this.system_milliseconds - this.lock_rate;
      this.offset += msec_tmp - this.system_milliseconds;
      this.lock_rate = 0;
  }

  Timer.prototype.locked = function () {
      return this.lock_state;
  }

  Timer.prototype.update = function () {
      this.num_updates++;
      this.last_update = this.system_milliseconds;

      if (this.lock_state) {
          this.system_milliseconds += parseInt(lock_rate * 1000);
      } else {
          this.system_milliseconds = (new Date()).getTime();
      }


      if (this.paused_state) this.paused_time += this.system_milliseconds - this.last_update;

      this.time_elapsed = this.system_milliseconds - this.start_time - this.paused_time + this.offset;
  }


  Timer.prototype.getMilliseconds = function () {
      return this.time_elapsed;
  }



  Timer.prototype.getSeconds = function () {
      return this.getMilliseconds() / 1000.0;
  }


  Timer.prototype.setMilliseconds = function (milliseconds_in) {
      this.offset -= (this.system_milliseconds - this.start_time - this.paused_time + this.offset) - milliseconds_in;
  }



  Timer.prototype.setSeconds = function (seconds_in) {
      this.setMilliseconds(parseInt(seconds_in * 1000.0));
  }


  Timer.prototype.getLastUpdateSeconds = function () {
      return this.getLastUpdateMilliseconds() / 1000.0;
  }


  Timer.prototype.getLastUpdateMilliseconds = function () {
      return this.system_milliseconds - this.last_update;
  }

  Timer.prototype.getTotalMilliseconds = function () {
      return this.system_milliseconds - this.start_time;
  }


  Timer.prototype.getTotalSeconds = function () {
      return this.getTotalMilliseconds() / 1000.0;
  }


  Timer.prototype.getNumUpdates = function () {
      return this.num_updates;
  }


  Timer.prototype.setPaused = function (pause_in) {
      this.paused_state = pause_in;
  }

  Timer.prototype.getPaused = function () {
      return this.paused_state;
  }
  
  
  /* Run-Loop Controller */
   
  function MainLoopRequest()
  {
 
    var gl = GLCore.gl;

    if (CubicVR.GLCore.mainloop === null) return;
    
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(MainLoopRequest);
    }

    CubicVR.GLCore.mainloop.interval();
  }

  function setMainLoop(ml)
  {
    CubicVR.GLCore.mainloop=ml;
  }
  
  function MainLoop(mlfunc,doclear)
  {
    if (window.requestAnimationFrame === undef) {      
      window.requestAnimationFrame = window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || null;
    }
    
    if (CubicVR.GLCore.mainloop !== null)
    {
      // kill old mainloop
      
      if (!(window.requestAnimationFrame) && CubicVR.GLCore.mainloop)
      {
        clearInterval(CubicVR.GLCore.mainloop.interval);
      }
      
      CubicVR.GLCore.mainloop = null;
    }
    
    if (mlfunc === null)
    {
      CubicVR.GLCore.mainloop = null;
      return;
    }
    
    var renderList = this.renderList = [];
    var renderStack = this.renderStack = [{
      scenes: [],
      update: function () {},
      start: function () {},
      stop: function () {},
    }];
    
    var timer = new Timer();
    timer.start();

    this.timer = timer;
    this.func = mlfunc;
    this.doclear = (doclear!==undef)?doclear:true;
    CubicVR.GLCore.mainloop = this;
    
    if (GLCore.resizeList.length && !CubicVR.GLCore.resize_active) {
      window.addEventListener('resize',  function()  { CubicVR.GLCore.onResize(); }, false);
      CubicVR.GLCore.resize_active = true;
    }
    
    var loopFunc = function() {
      return function() { 
        var gl = CubicVR.GLCore.gl;
        timer.update(); 
        if (CubicVR.GLCore.mainloop.doclear) {
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        } //if
        mlfunc(timer,CubicVR.GLCore.gl); 

        var sceneGroup = renderStack[renderStack.length-1],
            renderList = sceneGroup.scenes;
        sceneGroup.update && sceneGroup.update(timer, gl);
        if (renderList) {
          for (var i=0,l=renderList.length; i<l; ++i) {
            var scene = renderList[i];
            if (scene.paused) continue;
            if (scene.update) {
              scene.update(timer, CubicVR.GLCore.gl);
            } //if
            scene.render();
          } //for
        } //if
      };
    }(); //loopFunc

    if (window.requestAnimationFrame) {
      //loopFunc();
      this.interval = loopFunc;
      window.requestAnimationFrame(MainLoopRequest);
    } else { 
      this.interval = setInterval(loopFunc, 20);
    } //if


  } //MainLoop

  MainLoop.prototype.setPaused = function(state) {
    this.timer.setPaused(state);
  };

  MainLoop.prototype.getPaused = function() {
    return this.timer.getPaused();
  };

  MainLoop.prototype.setTimerSeconds = function(time_in) {
    this.timer.setSeconds(time_in);
  };


  MainLoop.prototype.getTimerSeconds = function() {
    return this.timer.getSeconds();
  };
  

  MainLoop.prototype.resetTimer = function() {
    this.timer.reset();
  };

  MainLoop.prototype.addScene = function (scene, update, paused) {
    var sceneGroup = this.renderStack[this.renderStack.length-1];
    sceneGroup.scenes.push(scene);
    return scene;
  };

  MainLoop.prototype.pushSceneGroup = function (options) {
    options.scenes = options.scenes || [];
    this.renderStack.push(options);
    for (var i=0; i<options.scenes.length; ++i) {
      options.scenes[i].enable();
    } //for
    options.start && options.start();
  };

  MainLoop.prototype.popSceneGroup = function () {
    var sceneGroup = this.renderStack[this.renderStack.length-1];
    for (var i=0; i<sceneGroup.scenes.length; ++i) {
      sceneGroup.scenes[i].disable();
    } //for
    if (this.renderStack.length > 1) {
      this.renderStack.pop();
    } //if
    sceneGroup.stop && sceneGroup.stop();
  };

  MainLoop.prototype.getScene = function (name) {
    var sceneGroup = renderStack[renderStack.length-1];
    var scene;
    for (var i=0, l=sceneGroup.scenes.length; i<l; ++i) {
      if (sceneGroup.scenes[i].scene.name === name) {
        scene = sceneGroup.scenes[i];
        break;
      } //if
    } //for
    return scene;
  };

  MainLoop.prototype.resumeScene = function (scene) {
    if (typeof(scene) === "string") {
      scene = this.getScene(scene);
    } //if
    scene.enable();
    scene.paused = false;
  };

  MainLoop.prototype.pauseScene = function (scene) {
    if (typeof(scene) === "string") {
      scene = this.getScene(scene);
    } //if
    scene.paused = true;
    scene.disable();
  };

  MainLoop.prototype.removeScene = function (scene) {
    var sceneGroup = renderStack[renderStack.length-1];
    if (typeof(scene) === "string") {
      scene = this.getScene(scene);
    } //if
    var idx = sceneGroup.scenes.indexOf(scene);
    if (idx > -1) {
      sceneGroup.scenes.splice(idx, 1);
    } //if
    return scene;
  };
  
  /*
  
    callback_obj =
    {    
        mouseMove: function(mvc,mPos,mDelta,keyState) {},
        mouseDown: function(mvc,mPos,keyState) {},
        mouseUp: function(mvc,mPos,keyState) {},
        keyDown: function(mvc,mPos,key,keyState) {},
        keyUp: function(mvc,mPos,key,keyState) {},
        wheelMove: function(mvc,mPos,wDelta,keyState) {}
    }
  
  */
  
  /* Simple View Controller */
  function MouseViewController(canvas,cam_in,callback_obj)
  {    
    this.canvas = canvas;
    this.camera = cam_in;    
    this.mpos = [0,0]
    this.mdown = false;
        
    var ctx = this;    

/*                
    this.onMouseDown = function () { return function (ev)
    {
      ctx.mdown = true;
      ctx.mpos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];
    } }();

    this.onMouseUp = function () { return function (ev)
    {
      ctx.mdown = false;
      ctx.mpos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];
    }  }();

    this.onMouseMove = function () { return function (ev)
    {
      var mdelta = [];

      var npos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];

      mdelta[0] = ctx.mpos[0]-npos[0];
      mdelta[1] = ctx.mpos[1]-npos[1];

      ctx.mpos = npos;
//      ctx.mpos = [ev.clientX,ev.clientY];
      if (!ctx.mdown) return;

      var dv = vec3.subtract(ctx.camera.target,ctx.camera.position);
      var dist = vec3.length(dv);

      ctx.camera.position = vec3.moveViewRelative(ctx.camera.position,ctx.camera.target,dist*mdelta[0]/300.0,0);
      ctx.camera.position[1] -= dist*mdelta[1]/300.0;
      
      ctx.camera.position = vec3.add(ctx.camera.target,vec3.multiply(vec3.normalize(vec3.subtract(ctx.camera.position,ctx.camera.target)),dist));
    } }();

    this.onMouseWheel = function() { return function (ev)
    {
      var delta = ev.wheelDelta?ev.wheelDelta:(-ev.detail*10.0);

      var dv = vec3.subtract(ctx.camera.target,ctx.camera.position);
      var dist = vec3.length(dv);

      dist -= delta/1000.0;
      
      if (dist < 0.1) dist = 0.1;
      if (dist > 1000) dist = 1000;
      // if (camDist > 20.0) camDist = 20.0;

      ctx.camera.position = vec3.add(ctx.camera.target,vec3.multiply(vec3.normalize(vec3.subtract(ctx.camera.position,ctx.camera.target)),dist));
    } }();
    
*/    

    this.mEvents = {};
    this.keyState = [];    

    this.onMouseDown = function () { return function (ev)
    {
      ctx.mdown = true;
      ctx.mpos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];
      if (ctx.mEvents.mouseDown) ctx.mEvents.mouseDown(ctx,ctx.mpos,ctx.keyState);
    } }();

    this.onMouseUp = function () { return function (ev)
    {
      ctx.mdown = false;
      ctx.mpos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];
      if (ctx.mEvents.mouseUp) ctx.mEvents.mouseUp(ctx,ctx.mpos,ctx.keyState);
    }  }();

    this.onMouseMove = function () { return function (ev)
    {
      var mdelta = [];

      var npos = [ev.pageX-ev.target.offsetLeft,ev.pageY-ev.target.offsetTop];

      mdelta[0] = npos[0]-ctx.mpos[0];
      mdelta[1] = npos[1]-ctx.mpos[1];

      ctx.mpos = npos;
      
      if (ctx.mEvents.mouseMove) ctx.mEvents.mouseMove(ctx,ctx.mpos,mdelta,ctx.keyState);
    } }();

    this.onMouseWheel = function() { return function (ev)
    {
      var delta = ev.wheelDelta?ev.wheelDelta:(-ev.detail*100.0);
      
      if (ctx.mEvents.mouseWheel) ctx.mEvents.mouseWheel(ctx,ctx.mpos,delta,ctx.keyState);

    } }();

    this.onKeyDown = function() { return function (ev)
    {
        
    } }();

    this.onKeyUp = function() { return function (ev)
    {
        
    } }();
    
    this.eventDefaults = {
        mouseMove: function(ctx,mpos,mdelta,keyState) {
          if (!ctx.mdown) return;
          
          ctx.orbitView(mdelta);
//          ctx.panView(mdelta);
        },
        mouseWheel: function(ctx,mpos,wdelta,keyState) {
          ctx.zoomView(wdelta);
        },
        mouseDown: null,
        mouseUp: null,
        keyDown: null,
        keyUp: null
    }
    
    if (callback_obj !== false) this.setEvents((callback_obj === undef)?this.eventDefaults:callback_obj);

    this.bind();
  }  
  
  MouseViewController.prototype.setEvents = function(callback_obj) {
     this.mEvents = {};
     for (var i in callback_obj) {
        this.bindEvent(i,callback_obj[i]);
    }
  }
  
  MouseViewController.prototype.orbitView = function(mdelta) {
      var vec3 = CubicVR.vec3;
      var dv = vec3.subtract(this.camera.target,this.camera.position);
      var dist = vec3.length(dv);

      this.camera.position = vec3.moveViewRelative(this.camera.position,this.camera.target,-dist*mdelta[0]/300.0,0);
      this.camera.position[1] += dist*mdelta[1]/300.0;
      
      this.camera.position = vec3.add(this.camera.target,vec3.multiply(vec3.normalize(vec3.subtract(this.camera.position,this.camera.target)),dist));
  }
  
    MouseViewController.prototype.panView = function(mdelta,horiz) {
      var vec3 = CubicVR.vec3;
      if (!horiz) horiz = false;
    
      var dv = vec3.subtract(this.camera.target,this.camera.position);
      var dist = vec3.length(dv);
      var oldpos = this.camera.position;

      if (horiz) {
          this.camera.position = vec3.moveViewRelative(this.camera.position,this.camera.target,-dist*mdelta[0]/300.0,-dist*mdelta[1]/300.0);
      } 
      else { // vertical
          this.camera.position = vec3.moveViewRelative(this.camera.position,this.camera.target,-dist*mdelta[0]/300.0,0);
          this.camera.position[1] += dist*mdelta[1]/300.0;
      }

      var cam_delta = vec3.subtract(this.camera.position,oldpos);
      this.camera.target = vec3.add(this.camera.target,cam_delta);
  }
  
  
  MouseViewController.prototype.zoomView = function(delta,zmin,zmax) {
      var vec3 = CubicVR.vec3;
      var dv = vec3.subtract(this.camera.target,this.camera.position);
      var dist = vec3.length(dv);

      dist -= delta/1000.0;
      
      if (!zmin) zmin = 0.1;
      if (!zmax) zmax = 1000.0;
      
      if (dist < zmin) dist = zmin;
      if (dist > zmax) dist = zmax;

      this.camera.position = vec3.add(this.camera.target,vec3.multiply(vec3.normalize(vec3.subtract(this.camera.position,this.camera.target)),dist));      
  }
  
  
  MouseViewController.prototype.bindEvent = function(event_id,event_func) {
    if (event_func === undef) {
        this.mEvents[event_id] = this.eventDefaults[event_id];
    } 
    else {
        this.mEvents[event_id] = event_func;
    }
  } 
  
  MouseViewController.prototype.unbindEvent = function(event_id) {
    this.bindEvent(event_id,null);
  }  
  
  MouseViewController.prototype.bind = function() {
    this.canvas.addEventListener('mousemove', this.onMouseMove, false);
    this.canvas.addEventListener('mousedown', this.onMouseDown, false);
    this.canvas.addEventListener('mouseup', this.onMouseUp, false);
    this.canvas.addEventListener('mousewheel', this.onMouseWheel, false);
    this.canvas.addEventListener('DOMMouseScroll', this.onMouseWheel, false);    
    this.canvas.addEventListener('keydown', this.onKeyDown, false);    
    this.canvas.addEventListener('keyup', this.onKeyUp, false);    
  };

  MouseViewController.prototype.unbind = function() {
    this.canvas.removeEventListener('mousemove', this.onMouseMove, false);
    this.canvas.removeEventListener('mousedown', this.onMouseDown, false);
    this.canvas.removeEventListener('mouseup', this.onMouseUp, false);
    this.canvas.removeEventListener('mousewheel', this.onMouseWheel, false);
    this.canvas.removeEventListener('DOMMouseScroll', this.onMouseWheel, false);    
    this.canvas.removeEventListener('keydown', this.onKeyDown, false);    
    this.canvas.removeEventListener('keyup', this.onKeyUp, false);    
  };

  MouseViewController.prototype.setCamera = function(cam_in) {
    this.camera = cam_in;
  }

  MouseViewController.prototype.getMousePosition = function() {
    return this.mpos;
  }


/* Render functions */


function cubicvr_renderObject(obj_in,camera,o_matrix,lighting) {

  if (obj_in.compiled===null) {
    return;
  }
  
  var ofs = 0;
  var gl = CubicVR.GLCore.gl;
  var numLights = (lighting === undef) ? 0: lighting.length;
  var mshader, last_ltype, l;
  var lcount = 0;
  var j;
  var mat = null;
//  var nullAmbient = [0,0,0];
//  var tmpAmbient = CubicVR.globalAmbient;
  
  var bound = false;
  
  gl.depthFunc(gl.LEQUAL);
  
  if (o_matrix === undef) { o_matrix = cubicvr_identity; }
  
  for (var ic = 0, icLen = obj_in.compiled.elements_ref.length; ic < icLen; ic++) {
    mat = obj_in.materials[ic];
        
    var len = 0;
    var drawn = false;
    
    if (mat.opacity !== 1.0) {
      gl.enable(gl.BLEND);
      gl.depthMask(0);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.depthMask(1);
      gl.disable(gl.BLEND);
      gl.blendFunc(gl.ONE,gl.ONE);
    }
    
    for (var jc = 0, jcLen = obj_in.compiled.elements_ref[ic].length; jc < jcLen; jc++) {
      j = obj_in.compiled.elements_ref[ic][jc][0];
      
      drawn = false;
      
      var this_len = obj_in.compiled.elements_ref[ic][jc][1];
      
      len += this_len;
      
      if (obj_in.segment_state[j]) {
        // ...
      } else if (len > this_len) {
        ofs += this_len*2;
        len -= this_len;
  
        // start lighting loop
         // start inner
        if (!numLights) {
         mat.use(0,0);

         gl.uniformMatrix4fv(mat.shader[0][0].uMVMatrix,false,camera.mvMatrix);
         gl.uniformMatrix4fv(mat.shader[0][0].uPMatrix,false,camera.pMatrix);
         gl.uniformMatrix4fv(mat.shader[0][0].uOMatrix,false,o_matrix);
         gl.uniformMatrix3fv(mat.shader[0][0].uNMatrix,false,camera.nMatrix);

         if (!bound) { mat.bindObject(obj_in,mat.shader[0][0]); bound = true; }

          gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);

        } else { 
          var subcount = 0;
          var blended = false;

          for (subcount = 0; subcount < numLights; )
          {
            nLights = numLights-subcount;
            if (nLights>MAX_LIGHTS) { 
              nLights=MAX_LIGHTS;
            }

            if (subcount>0 && !blended) {
              gl.enable(gl.BLEND);
              gl.blendFunc(gl.ONE,gl.ONE);
              gl.depthFunc(gl.EQUAL);
              blended = true;
            }

            mshader = undef;
            l = lighting[subcount];
            var lt = l.light_type

            for (lcount = 0; lcount < nLights; lcount++) {
              if (lighting[lcount+subcount].light_type!=lt) {
                nLights = lcount;
               break;
              }
            }

            mat.use(l.light_type,nLights);

            mshader = mat.shader[l.light_type][nLights];

            gl.uniformMatrix4fv(mshader.uMVMatrix,false,camera.mvMatrix);
            gl.uniformMatrix4fv(mshader.uPMatrix,false,camera.pMatrix);
            gl.uniformMatrix4fv(mshader.uOMatrix,false,o_matrix);
            gl.uniformMatrix3fv(mshader.uNMatrix,false,camera.nMatrix);

            if (!bound) { mat.bindObject(obj_in,mshader); bound = true; }

            for (lcount = 0; lcount < nLights; lcount++) {
              lighting[lcount+subcount].setupShader(mshader,lcount);
            }

            gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);
            // var err = gl.getError();
            // if (err) {
            //   var uv = mshader.uniforms["aTextureCoord"]; 
            //   var un = mshader.uniforms["aNormal"];
            //   console.log(obj_in.compiled.gl_uvs!==null,obj_in.compiled.gl_normals!==null, un, uv, len, ofs, subcount);
            //   
            //   throw new Error('webgl error on mesh: ' + obj_in.name);
            // }

            subcount += nLights;
          }

          if (blended)
          {
            gl.disable(gl.BLEND);
            gl.depthFunc(gl.LEQUAL);
          }
        }

        /// end inner
        
        
        ofs += len*2;  // Note: unsigned short = 2 bytes
        len = 0;      
        drawn = true;
      } else {
        ofs += len*2;
        len = 0;
      }
    }

    if (!drawn && obj_in.segment_state[j]) {
      // this is an exact copy/paste of above
      // start lighting loop
       // start inner
      if (!numLights) {
       mat.use(0,0);

       gl.uniformMatrix4fv(mat.shader[0][0].uMVMatrix,false,camera.mvMatrix);
       gl.uniformMatrix4fv(mat.shader[0][0].uPMatrix,false,camera.pMatrix);
       gl.uniformMatrix4fv(mat.shader[0][0].uOMatrix,false,o_matrix);
       gl.uniformMatrix3fv(mat.shader[0][0].uNMatrix,false,camera.nMatrix);

       if (!bound) { mat.bindObject(obj_in,mat.shader[0][0]); bound = true; }

        gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);

      } else { 
        var subcount = 0;
        var blended = false;

        for (subcount = 0; subcount < numLights; )
        {
          nLights = numLights-subcount;
          if (nLights>MAX_LIGHTS) { 
            nLights=MAX_LIGHTS;
          }

          if (subcount>0 && !blended) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE,gl.ONE);
            gl.depthFunc(gl.EQUAL);
            blended = true;
          }

          mshader = undef;
          l = lighting[subcount];
          var lt = l.light_type

          for (lcount = 0; lcount < nLights; lcount++) {
            if (lighting[lcount+subcount].light_type!=lt) {
              nLights = lcount;
             break;
            }
          }

          mat.use(l.light_type,nLights);

          mshader = mat.shader[l.light_type][nLights];

          gl.uniformMatrix4fv(mshader.uMVMatrix,false,camera.mvMatrix);
          gl.uniformMatrix4fv(mshader.uPMatrix,false,camera.pMatrix);
          gl.uniformMatrix4fv(mshader.uOMatrix,false,o_matrix);
          gl.uniformMatrix3fv(mshader.uNMatrix,false,camera.nMatrix);

          if (!bound) { mat.bindObject(obj_in,mshader); bound = true; }

          for (lcount = 0; lcount < nLights; lcount++) {
            lighting[lcount+subcount].setupShader(mshader,lcount);
          }

          gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);
          // var err = gl.getError();
          // if (err) {
          //   var uv = mshader.uniforms["aTextureCoord"]; 
          //   var un = mshader.uniforms["aNormal"];
          //   console.log(obj_in.compiled.gl_uvs!==null,obj_in.compiled.gl_normals!==null, un, uv, len, ofs, subcount);
          //   
          //   throw new Error('webgl error on mesh: ' + obj_in.name);
          // }

          subcount += nLights;
        }

        if (blended)
        {
          gl.disable(gl.BLEND);
          gl.depthFunc(gl.LEQUAL);
        }
      }

      /// end inner
      
      ofs += len*2;
    }
  }
  
  if (mat && mshader) {
    mat.clearObject(obj_in,mshader);
  }
  
  // gl.disableVertexAttribArray(0);
  // gl.disableVertexAttribArray(2);
  // gl.disableVertexAttribArray(3);
  
  gl.depthMask(1);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}





function Landscape(size_in, divisions_in_w, divisions_in_h, matRef_in) {
  this.doTransform = function() {};
  this.tMatrix = cubicvr_identity;

  this.parent = null;
  this.position = [0, 0, 0];
  this.scale = [1, 1, 1];
  this.size = size_in;
  this.divisions_w = divisions_in_w;
  this.divisions_h = divisions_in_h;
  this.matRef = matRef_in;
  this.children = null;

  this.obj = new CubicVR.Mesh();

  var i, j;

  if (this.divisions_w > this.divisions_h) {
    this.size_w = size_in;
    this.size_h = (size_in / this.divisions_w) * this.divisions_h;
  } else if (this.divisions_h > this.divisions_w) {
    this.size_w = (size_in / this.divisions_h) * this.divisions_w;
    this.size_h = size_in;
  } else {
    this.size_w = size_in;
    this.size_h = size_in;
  }

  for (j = -(this.size_h / 2.0); j < (this.size_h / 2.0); j += (this.size_h / this.divisions_h)) {
    for (i = -(this.size_w / 2.0); i < (this.size_w / 2.0); i += (this.size_w / this.divisions_w)) {
      this.obj.addPoint([i + ((this.size_w / (this.divisions_w)) / 2.0), 0, j + ((this.size_h / (this.divisions_h)) / 2.0)]);
    }
  }

  var k, l;

  this.obj.setFaceMaterial(this.matRef);

  for (l = 0; l < this.divisions_h - 1; l++) {
    for (k = 0; k < this.divisions_w - 1; k++) {
      this.obj.addFace([(k) + ((l + 1) * this.divisions_w),
                              (k + 1) + ((l) * this.divisions_w),
                                (k) + ((l) * this.divisions_w)]);

      this.obj.addFace([(k) + ((l + 1) * this.divisions_w),
                              (k + 1) + ((l + 1) * this.divisions_w),
                              (k + 1) + ((l) * this.divisions_w)]);
    }
  }
}

Landscape.prototype.getMesh = function() {
  return this.obj;
}

Landscape.prototype.setIndexedHeight = function(ipos, jpos, val) {
  obj.points[(ipos) + (jpos * this.divisions_w)][1] = val;
}

Landscape.prototype.mapGen = function(w_func, ipos, jpos, ilen, jlen) {
  var pt;
  
  if (ipos!==undef && jpos !==undef && ilen !==undef && jlen!==undef) {
    if (ipos>=this.divisions_w) return;
    if (jpos>=this.divisions_h) return;
    if (ipos+ilen>=this.divisions_w) ilen = this.divisions_w-1-ipos; 
    if (jpos+jlen>=this.divisions_h) jlen = this.divisions_h-1-jpos; 
    if (ilen<=0 || jlen<=0) return;

    for (var i = ipos, imax = ipos+ilen; i < imax; i++) {
      for (var j = jpos, jmax = jpos+jlen; j < jmax; j++) {
        pt = this.obj.points[(i) + (j * this.divisions_w)];
        
        pt[1] = w_func(pt[0],pt[2]);
      }
    }
  } else {
    for (var x = 0, xmax = this.obj.points.length; x < xmax; x++) {
      pt = this.obj.points[x];
      
      pt[1] = w_func(pt[0],pt[2]);
    }
  }
}


Landscape.prototype.getFaceAt = function(x, z) {
  if (typeof(x) === 'object') {
     return this.getFaceAt(x[0], x[2]);
  }
 
  var ofs_w = (this.size_w / 2.0) - ((this.size_w / (this.divisions_w)) / 2.0);
  var ofs_h = (this.size_h / 2.0) - ((this.size_h / (this.divisions_h)) / 2.0);

  var i = parseInt(Math.floor(((x + ofs_w) / this.size_w) * (this.divisions_w)), 10);
  var j = parseInt(Math.floor(((z + ofs_h) / this.size_h) * (this.divisions_h)), 10);

  if (i < 0) {
    return -1;
  }
  if (i >= this.divisions_w - 1) {
    return -1;
  }
  if (j < 0) {
    return -1;
  }
  if (j >= this.divisions_h - 1) {
    return -1;
  }

  var faceNum1 = parseInt(i + (j * (this.divisions_w - 1)), 10) * 2;
  var faceNum2 = parseInt(faceNum1 + 1, 10);

  var testPt = this.obj.points[this.obj.faces[faceNum1].points[0]];

  var slope = Math.abs(z - testPt[2]) / Math.abs(x - testPt[0]);

  if (slope >= 1.0) {
    return (faceNum1);
  } else {
    return (faceNum2);
  }
};


Landscape.prototype.getHeightValue = function(x, z) {
  var triangle = CubicVR.triangle;

  if (typeof(x) === 'object') {
    return this.getHeightValue(x[0], x[2]);
  }

  var tmpFace;
  var tmpPoint;

  var faceNum = this.getFaceAt(x, z);

  if (faceNum === -1) {
    return 0;
  }

  tmpFace = this.obj.faces[faceNum];
  tmpPoint = this.obj.points[this.obj.faces[faceNum].points[0]];

  var tmpNorm = triangle.normal(this.obj.points[this.obj.faces[faceNum].points[0]], this.obj.points[this.obj.faces[faceNum].points[1]], this.obj.points[this.obj.faces[faceNum].points[2]]);

  var na = tmpNorm[0];
  var nb = tmpNorm[1];
  var nc = tmpNorm[2];

  var d = -(na * tmpPoint[0]) - (nb * tmpPoint[1]) - (nc * tmpPoint[2]);

  return (((na * x) + (nc * z) + d) / (-nb)); // add height ofs here
};


Landscape.prototype.orient = function(x, z, width, length, heading, center) {
  if (center === undef) {
    center = 0;
  }

  var xpos, zpos;
  var xrot, zrot;
  var heightsample = [];
  var xyzTmp;

  var halfw = width / 2.0;
  var halfl = length / 2.0;

  var mag = Math.sqrt(halfl * halfl + halfw * halfw);
  var ang = Math.atan2(halfl, halfw);

  heading *= (Math.PI / 180.0);

  xpos = x + (Math.sin(heading) * center);
  zpos = z + (Math.cos(heading) * center);

  heightsample[0] = this.getHeightValue([xpos + mag * Math.cos(-ang - M_HALF_PI + heading), 0, zpos + mag * -Math.sin(-ang - M_HALF_PI + heading)]);
  heightsample[1] = this.getHeightValue([xpos + mag * Math.cos(ang - M_HALF_PI + heading), 0, zpos + mag * (-Math.sin(ang - M_HALF_PI + heading))]);
  heightsample[2] = this.getHeightValue([xpos + mag * Math.cos(-ang + M_HALF_PI + heading), 0, zpos + mag * (-Math.sin(-ang + M_HALF_PI + heading))]);
  heightsample[3] = this.getHeightValue([xpos + mag * Math.cos(ang + M_HALF_PI + heading), 0, zpos + mag * (-Math.sin(ang + M_HALF_PI + heading))]);

  xrot = -Math.atan2((heightsample[1] - heightsample[2]), width);
  zrot = -Math.atan2((heightsample[0] - heightsample[1]), length);

  xrot += -Math.atan2((heightsample[0] - heightsample[3]), width);
  zrot += -Math.atan2((heightsample[3] - heightsample[2]), length);

  xrot /= 2.0; // average angles
  zrot /= 2.0;


  return [[x, ((heightsample[2] + heightsample[3] + heightsample[1] + heightsample[0])) / 4.0, z], //
  [xrot * (180.0 / Math.PI), heading, zrot * (180.0 / Math.PI)]];
};




function cubicvr_isMotion(node) {
  if (node === null) {
    return false;
  }

  return (node.getElementsByTagName("x").length || node.getElementsByTagName("y").length || node.getElementsByTagName("z").length || node.getElementsByTagName("fov").length);
}

function Camera(width, height, fov, nearclip, farclip) {
  this.frustum = new CubicVR.Frustum();

  if (typeof(width)=='object') {
    this.position = width.position?width.position:[0, 0, 0];
    this.rotation = width.rotation?width.rotation:[0, 0, 0];
    this.target = width.target?width.target:[0, 0, 0];
    this.fov = width.fov?width.fov:60.0;
    this.nearclip = width.nearclip?width.nearclip:0.1;
    this.farclip = width.farclip?width.farclip:400.0;
    this.targeted = width.targeted?width.targeted:true;
    this.calc_nmatrix =  width.calcNormalMatrix?width.calcNormalMatrix:true;

    height = width.height?width.height:undef;
    width = width.width?width.width:undef;
  } else {
    this.position = [0, 0, 0];
    this.rotation = [0, 0, 0];
    this.target = [0, 0, 0];
    this.fov = (fov !== undef) ? fov : 60.0;
    this.nearclip = (nearclip !== undef) ? nearclip : 0.1;
    this.farclip = (farclip !== undef) ? farclip : 400.0;
    this.targeted = true;
    this.calc_nmatrix = true;
  }

  this.targetSceneObject = null;
  this.motion = null;
  this.transform = new CubicVR.Transform();

  this.manual = false;

  this.setDimensions((width !== undef) ? width : 512, (height !== undef) ? height : 512);

  this.mvMatrix = cubicvr_identity;
  this.pMatrix = null;
  this.calcProjection();
  
  this.ortho = false;
  this.ortho_view = {
    left:-1,
    right:1,
    bottom:-1,
    top:1
  };
}

Camera.prototype.setOrtho = function(left,right,bottom,top) {
  this.ortho = true;
  this.ortho_view.left = left;
  this.ortho_view.right = right;
  this.ortho_view.bottom = bottom;
  this.ortho_view.top = top;
}

Camera.prototype.control = function(controllerId, motionId, value) {
  if (controllerId === enums.motion.ROT) {
    this.rotation[motionId] = value;
  } else if (controllerId === enums.motion.POS) {
    this.position[motionId] = value;
  } else if (controllerId === enums.motion.FOV) {
    this.setFOV(value);
  } else if (controllerId === enums.motion.LENS) {
   this.setLENS(value);
  } else if (controllerId === enums.motion.NEARCLIP) {
   this.setClip(value,this.farclip);
  } else if (controllerId === enums.motion.FARCLIP) {
   this.setClip(this.nearclip,value);
  } 
};


Camera.prototype.makeFrustum = function(left, right, bottom, top, zNear, zFar) {
  var A = (right + left) / (right - left);
  var B = (top + bottom) / (top - bottom);
  var C = -(zFar + zNear) / (zFar - zNear);
  var D = -2.0 * zFar * zNear / (zFar - zNear);

  return [2.0 * zNear / (right - left), 0.0, 0.0, 0.0, 0.0, 2.0 * zNear / (top - bottom), 0.0, 0.0, A, B, C, -1.0, 0.0, 0.0, D, 0.0];
};


Camera.prototype.setTargeted = function(targeted) {
  this.targeted = targeted;
};

Camera.prototype.calcProjection = function() {
  var mat4 = CubicVR.mat4;
  var mat3 = CubicVR.mat3;
  var vec3 = CubicVR.vec3;
  var gl = GLCore.gl;
  
  
  if (this.ortho) {
    this.pMatrix = mat4.ortho(this.ortho_view.left,this.ortho_view.right,this.ortho_view.bottom,this.ortho_view.top,this.nearclip,this.farclip);
  } else {
    this.pMatrix = mat4.perspective(this.fov, this.aspect, this.nearclip, this.farclip);
  }
  
  if (!this.targeted) {
    this.transform.clearStack();
    //this.transform.translate(vec3.subtract([0,0,0],this.position)).pushMatrix().rotate(vec3.subtract([0,0,0],this.rotation)).getResult();
    this.transform.translate(-this.position[0], -this.position[1], -this.position[2]);
    this.transform.pushMatrix();
    this.transform.rotate(-this.rotation[2], 0, 0, 1);
    this.transform.rotate(-this.rotation[1], 0, 1, 0);
    this.transform.rotate(-this.rotation[0], 1, 0, 0);
    this.transform.pushMatrix();
    this.mvMatrix = this.transform.getResult();
    
    if (this.calc_nmatrix) {
      this.nMatrix = mat4.inverse_mat3(this.mvMatrix);
      mat3.transpose_inline(this.nMatrix);
    } else {
      this.nMatrix = cubicvr_identity;
    }
  }
  
  this.frustum.extract(this, this.mvMatrix, this.pMatrix);
};


Camera.prototype.setClip = function(nearclip, farclip) {
  this.nearclip = nearclip;
  this.farclip = farclip;
  this.calcProjection();
};


Camera.prototype.setDimensions = function(width, height) {
  this.width = width;
  this.height = height;

  this.aspect = width / height;
  this.calcProjection();
};

Camera.prototype.resize = function(width,height) {
  this.setDimensions(width,height);
}


Camera.prototype.setFOV = function(fov) {
  this.fov = fov;
  this.ortho = false;
  this.calcProjection();
};

Camera.prototype.setLENS = function(lens) {
  this.setFOV(2.0*Math.atan(16.0/lens)*(180.0/Math.PI));
};

Camera.prototype.lookat = function(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ) {
  var mat4 = CubicVR.mat4;
  var mat3 = CubicVR.mat3;
  
  if (typeof(eyeX)=='object') {
    this.lookat(this.position[0],this.position[1],this.position[2],eyeX[0],eyeX[1],eyeX[2],0,1,0);
    return;
  }
  
  this.mvMatrix = mat4.lookat(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ);

  if (this.rotation[2]) {
    this.transform.clearStack();
    this.transform.rotate(-this.rotation[2], 0, 0, 1);
    this.transform.pushMatrix(this.mvMatrix);
    this.mvMatrix = this.transform.getResult();
  }

  if (this.calc_nmatrix) {
    this.nMatrix = mat4.inverse_mat3(this.mvMatrix);
    mat3.transpose_inline(this.nMatrix);
    } else {
      this.nMatrix = cubicvr_identity;
    }
  
  this.frustum.extract(this, this.mvMatrix, this.pMatrix);
  
};


Camera.prototype.unProject = function (winx, winy, winz) {
  var mat4 = CubicVR.mat4;

//    var tmpClip = this.nearclip;
    
//    if (tmpClip < 1.0) { this.nearclip = 1.0; this.calcProjection(); }

    var viewport = [0, 0, this.width, this.height];

    if (winz === undef) winz = this.farclip;

    var p = [(((winx - viewport[0]) / (viewport[2])) * 2) - 1, -((((winy - viewport[1]) / (viewport[3])) * 2) - 1), (winz - this.nearclip) / (this.farclip - this.nearclip), 1.0];

    var invp = mat4.vec4_multiply(mat4.vec4_multiply(p, mat4.inverse(this.pMatrix)), mat4.inverse(this.mvMatrix));

//    if (tmpClip < 1.0) { this.nearclip = tmpClip; this.calcProjection(); }

    return [invp[0] / invp[3], invp[1] / invp[3], invp[2] / invp[3]];
}


Camera.prototype.project = function (objx, objy, objz) {
  var mat4 = CubicVR.mat4;

  var p = [objx,objy,objz,1.0];
  
  var mp = mat4.vec4_multiply(mat4.vec4_multiply(p,this.mvMatrix),this.pMatrix);
  
  return [((mp[0]/mp[3]+1.0)/2.0)*this.width,((-mp[1]/mp[3]+1.0)/2.0)*this.height,((mp[2]/mp[3]))*(this.farclip-this.nearclip)+this.nearclip];
  
}


/*** Auto-Cam Prototype ***/

function AutoCameraNode(pos) {
  this.position = (pos !== undef) ? pos : [0, 0, 0];
}

AutoCameraNode.prototype.control = function(controllerId, motionId, value) {
  if (controllerId === enums.motion.POS) {
    this.position[motionId] = value;
  }
};

function AutoCamera(start_position, target, bounds) {
  this.camPath = new CubicVR.Motion();
  this.targetPath = new CubicVR.Motion();

  this.start_position = (start_position !== undef) ? start_position : [8, 8, 8];
  this.target = (target !== undef) ? target : [0, 0, 0];

  this.bounds = (bounds !== undef) ? bounds : [[-15, 3, -15], [15, 20, 15]];

this.safe_bb = [];
this.avoid_sphere = [];

this.segment_time = 3.0;
this.buffer_time = 20.0;
this.start_time = 0.0;
this.current_time = 0.0;

this.path_time = 0.0;
this.path_length = 0;

this.min_distance = 2.0;
this.max_distance = 40.0;

this.angle_min = 40;
this.angle_max = 180;
}


AutoCamera.prototype.inBounds = function(pt) {
  var vec3 = CubicVR.vec3;
  if (! (pt[0] > this.bounds[0][0] && pt[1] > this.bounds[0][1] && pt[2] > this.bounds[0][2] && pt[0] < this.bounds[1][0] && pt[1] < this.bounds[1][1] && pt[2] < this.bounds[1][2])) {
    return false;
  }

  for (var i = 0, iMax = this.avoid_sphere.length; i < iMax; i++) {
    var l = vec3.length(pt, this.avoid_sphere[i][0]);
    if (l < this.avoid_sphere[i][1]) {
      return false;
    }
  }

  return true;
};

AutoCamera.prototype.findNextNode = function(aNode, bNode) {
  var vec3 = CubicVR.vec3;
  var d = [this.bounds[1][0] - this.bounds[0][0], this.bounds[1][1] - this.bounds[0][1], this.bounds[1][2] - this.bounds[0][2]];

  var nextNodePos = [0, 0, 0];
  var randVector = [0, 0, 0];
  var l = 0.0;
  var loopkill = 0;
  var valid = false;

  do {
    randVector[0] = Math.random() - 0.5;
    randVector[1] = Math.random() - 0.5;
    randVector[2] = Math.random() - 0.5;

    randVector = vec3.normalize(randVector);

    var r = Math.random();

    l = (r * (this.max_distance - this.min_distance)) + this.min_distance;

    nextNodePos = vec3.add(bNode.position, vec3.multiply(randVector, l));

    valid = this.inBounds(nextNodePos);

    loopkill++;

    if (loopkill > 30) {
      nextNodePos = bNode.position;
      break;
    }
  } while (!valid);

  return nextNodePos;
};

AutoCamera.prototype.run = function(timer) {
  this.current_time = timer;

  if (this.path_time === 0.0) {
    this.path_time = this.current_time;

    this.camPath.setKey(enums.motion.POS, enums.motion.X, this.path_time, this.start_position[0]);
    this.camPath.setKey(enums.motion.POS, enums.motion.Y, this.path_time, this.start_position[1]);
    this.camPath.setKey(enums.motion.POS, enums.motion.Z, this.path_time, this.start_position[2]);
  }

  while (this.path_time < this.current_time + this.buffer_time) {
    this.path_time += this.segment_time;

    var tmpNodeA = new AutoCameraNode();
    var tmpNodeB = new AutoCameraNode();

    if (this.path_length) {
      this.camPath.apply(this.path_time - (this.segment_time * 2.0), tmpNodeA);
    }

    this.camPath.apply(this.path_time - this.segment_time, tmpNodeB);

    var nextPos = this.findNextNode(tmpNodeA, tmpNodeB);

    this.camPath.setKey(enums.motion.POS, enums.motion.X, this.path_time, nextPos[0]);
    this.camPath.setKey(enums.motion.POS, enums.motion.Y, this.path_time, nextPos[1]);
    this.camPath.setKey(enums.motion.POS, enums.motion.Z, this.path_time, nextPos[2]);

    this.path_length++;
  }

  var tmpNodeC = new AutoCameraNode();

  this.camPath.apply(timer, tmpNodeC);

  return tmpNodeC.position;
};


AutoCamera.prototype.addSafeBound = function(min, max) {
  this.safe_bb.push([min, max]);
};

AutoCamera.prototype.addAvoidSphere = function(center, radius) {
  this.avoid_sphere.push([center, radius]);
};



function cubicvr_loadMesh(meshUrl, prefix) {
//  if (MeshPool[meshUrl] !== undef) {
//    return MeshPool[meshUrl];
//  }
  var util = CubicVR.util;

  var i, j, p, iMax, jMax, pMax;

  var obj = new CubicVR.Mesh();
  var mesh = util.getXML(meshUrl);
  var pts_elem = mesh.getElementsByTagName("points");

  var pts_str = util.collectTextNode(pts_elem[0]);
  var pts = pts_str.split(" ");

  var texName, tex;

  for (i = 0, iMax = pts.length; i < iMax; i++) {
    pts[i] = pts[i].split(",");
    for (j = 0, jMax = pts[i].length; j < jMax; j++) {
      pts[i][j] = parseFloat(pts[i][j]);
    }
  }

  obj.addPoint(pts);

  var material_elem = mesh.getElementsByTagName("material");
  var mappers = [];


  for (i = 0, iMax = material_elem.length; i < iMax; i++) {
    var melem = material_elem[i];

    var matName = (melem.getElementsByTagName("name").length) ? (melem.getElementsByTagName("name")[0].firstChild.nodeValue) : null;
    var mat = new CubicVR.Material(matName);

    if (melem.getElementsByTagName("alpha").length) {
      mat.opacity = parseFloat(melem.getElementsByTagName("alpha")[0].firstChild.nodeValue);
    }
    if (melem.getElementsByTagName("shininess").length) {
      mat.shininess = (parseFloat(melem.getElementsByTagName("shininess")[0].firstChild.nodeValue) / 100.0);
    }
    if (melem.getElementsByTagName("max_smooth").length) {
      mat.max_smooth = parseFloat(melem.getElementsByTagName("max_smooth")[0].firstChild.nodeValue);
    }

    if (melem.getElementsByTagName("color").length) {
      mat.color = util.floatDelimArray(melem.getElementsByTagName("color")[0].firstChild.nodeValue);
    }
    if (melem.getElementsByTagName("ambient").length) {
      mat.ambient = util.floatDelimArray(melem.getElementsByTagName("ambient")[0].firstChild.nodeValue);
    }
    if (melem.getElementsByTagName("diffuse").length) {
      mat.diffuse = util.floatDelimArray(melem.getElementsByTagName("diffuse")[0].firstChild.nodeValue);
    }
    if (melem.getElementsByTagName("specular").length) {
      mat.specular = util.floatDelimArray(melem.getElementsByTagName("specular")[0].firstChild.nodeValue);
    }
    if (melem.getElementsByTagName("texture").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture")[0].firstChild.nodeValue;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.COLOR);
    }

    if (melem.getElementsByTagName("texture_luminosity").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_luminosity")[0].firstChild.nodeValue;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.AMBIENT);
    }

    if (melem.getElementsByTagName("texture_normal").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_normal")[0].firstChild.nodeValue;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.NORMAL);
    }

    if (melem.getElementsByTagName("texture_specular").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_specular")[0].firstChild.nodeValue;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.SPECULAR);
    }

    if (melem.getElementsByTagName("texture_bump").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_bump")[0].firstChild.nodeValue;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.BUMP);
    }

    if (melem.getElementsByTagName("texture_envsphere").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_envsphere")[0].firstChild.nodeValue;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.ENVSPHERE);
    }

    if (melem.getElementsByTagName("texture_alpha").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_alpha")[0].firstChild.nodeValue;
      tex = (base.Textures_ref[texName] !== undef) ? base.Textures_obj[base.Textures_ref[texName]] : (new CubicVR.Texture(texName));
      mat.setTexture(tex, enums.texture.map.ALPHA);
    }

    var uvSet = null;

    if (melem.getElementsByTagName("uvmapper").length) {
      var uvm = new CubicVR.UVMapper();
      var uvelem = melem.getElementsByTagName("uvmapper")[0];
      var uvmType = "";

      if (uvelem.getElementsByTagName("type").length) {
        uvmType = melem.getElementsByTagName("type")[0].firstChild.nodeValue;

        switch (uvmType) {
        case "uv":
          break;
        case "planar":
          uvm.projection_mode = enums.uv.projection.PLANAR;
          break;
        case "cylindrical":
          uvm.projection_mode = enums.uv.projection.CYLINDRICAL;
          break;
        case "spherical":
          uvm.projection_mode = enums.uv.projection.SPHERICAL;
          break;
        case "cubic":
          uvm.projection_mode = enums.uv.projection.CUBIC;
          break;
        }
      }

      if (uvmType === "uv") {
        if (uvelem.getElementsByTagName("uv").length) {
          var uvText = util.collectTextNode(melem.getElementsByTagName("uv")[0]);

          uvSet = uvText.split(" ");

          for (j = 0, jMax = uvSet.length; j < jMax; j++) {
            uvSet[j] = util.floatDelimArray(uvSet[j]);
          }
        }
      }

      if (uvelem.getElementsByTagName("axis").length) {
        var uvmAxis = melem.getElementsByTagName("axis")[0].firstChild.nodeValue;

        switch (uvmAxis) {
        case "x":
          uvm.projection_axis = enums.uv.axis.X;
          break;
        case "y":
          uvm.projection_axis = enums.uv.axis.Y;
          break;
        case "z":
          uvm.projection_axis = enums.uv.axis.Z;
          break;
        }

      }

      if (melem.getElementsByTagName("center").length) {
        uvm.center = util.floatDelimArray(melem.getElementsByTagName("center")[0].firstChild.nodeValue);
      }
      if (melem.getElementsByTagName("rotation").length) {
        uvm.rotation = util.floatDelimArray(melem.getElementsByTagName("rotation")[0].firstChild.nodeValue);
      }
      if (melem.getElementsByTagName("scale").length) {
        uvm.scale = util.floatDelimArray(melem.getElementsByTagName("scale")[0].firstChild.nodeValue);
      }

      if (uvmType !== "" && uvmType !== "uv") {
        mappers.push([uvm, mat]);
      }
    }


    var seglist = null;
    var triangles = null;

    if (melem.getElementsByTagName("segments").length) {
      seglist = util.intDelimArray(util.collectTextNode(melem.getElementsByTagName("segments")[0]), " ");
    }
    if (melem.getElementsByTagName("triangles").length) {
      triangles = util.intDelimArray(util.collectTextNode(melem.getElementsByTagName("triangles")[0]), " ");
    }


    if (seglist === null) {
      seglist = [0, parseInt((triangles.length) / 3, 10)];
    }

    var ofs = 0;

    obj.setFaceMaterial(mat);

    if (triangles.length) {
      for (p = 0, pMax = seglist.length; p < pMax; p += 2) {
        var currentSegment = seglist[p];
        var totalPts = seglist[p + 1] * 3;

        obj.setSegment(currentSegment);

        for (j = ofs, jMax = ofs + totalPts; j < jMax; j += 3) {
          var newFace = obj.addFace([triangles[j], triangles[j + 1], triangles[j + 2]]);
          if (uvSet) {
            obj.faces[newFace].setUV([uvSet[j], uvSet[j + 1], uvSet[j + 2]]);
          }
        }

        ofs += totalPts;
      }
    }
  }

  obj.calcNormals();

  for (i = 0, iMax = mappers.length; i < iMax; i++) {
    mappers[i][0].apply(obj, mappers[i][1]);
  }

  obj.compile();

//  MeshPool[meshUrl] = obj;

  return obj;
}







function cubicvr_loadScene(sceneUrl, model_prefix, image_prefix) {
  var util = CubicVR.util;
  if (model_prefix === undef) {
    model_prefix = "";
  }
  if (image_prefix === undef) {
    image_prefix = "";
  }

  var obj = new CubicVR.Mesh();
  var scene = util.getXML(sceneUrl);

  var sceneOut = new CubicVR.Scene();

  var parentingSet = [];

  var sceneobjs = scene.getElementsByTagName("sceneobjects");

  var tempNode;

  var position, rotation, scale;

  //  var pts_str = util.collectTextNode(pts_elem[0]);
  for (var i = 0, iMax = sceneobjs[0].childNodes.length; i < iMax; i++) {
    var sobj = sceneobjs[0].childNodes[i];

    if (sobj.tagName === "sceneobject") {

      var name = "unnamed";
      var parent = "";
      var model = "";

      tempNode = sobj.getElementsByTagName("name");
      if (tempNode.length) {
        name = util.collectTextNode(tempNode[0]);
      }

      tempNode = sobj.getElementsByTagName("parent");
      if (tempNode.length) {
        parent = util.collectTextNode(tempNode[0]);
      }

      tempNode = sobj.getElementsByTagName("model");
      if (tempNode.length) {
        model = util.collectTextNode(tempNode[0]);
      }

      position = null;
      rotation = null;
      scale = null;

      tempNode = sobj.getElementsByTagName("position");
      if (tempNode.length) {
        position = tempNode[0];
      }

      tempNode = sobj.getElementsByTagName("rotation");
      if (tempNode.length) {
        rotation = tempNode[0];
      }

      tempNode = sobj.getElementsByTagName("scale");
      if (tempNode.length) {
        scale = tempNode[0];
      }

      obj = null;

      if (model !== "") {
        obj = cubicvr_loadMesh(model_prefix + model, image_prefix);
      }

      var sceneObject = new CubicVR.SceneObject(obj, name);

      if (cubicvr_isMotion(position)) {
        if (!sceneObject.motion) {
          sceneObject.motion = new CubicVR.Motion();
        }
        cubicvr_nodeToMotion(position, enums.motion.POS, sceneObject.motion);
      } else if (position) {
        sceneObject.position = util.floatDelimArray(util.collectTextNode(position));
      }

      if (cubicvr_isMotion(rotation)) {
        if (!sceneObject.motion) {
          sceneObject.motion = new CubicVR.Motion();
        }
        cubicvr_nodeToMotion(rotation, enums.motion.ROT, sceneObject.motion);
      } else {
        sceneObject.rotation = util.floatDelimArray(util.collectTextNode(rotation));
      }

      if (cubicvr_isMotion(scale)) {
        if (!sceneObject.motion) {
          sceneObject.motion = new CubicVR.Motion();
        }
        cubicvr_nodeToMotion(scale, enums.motion.SCL, sceneObject.motion);
      } else {
        sceneObject.scale = util.floatDelimArray(util.collectTextNode(scale));

      }

      sceneOut.bindSceneObject(sceneObject);

      if (parent !== "") {
        parentingSet.push([sceneObject, parent]);
      }
    }
  }

  for (var j in parentingSet) {
    if (parentingSet.hasOwnProperty(j)) {
      sceneOut.getSceneObject(parentingSet[j][1]).bindChild(parentingSet[j][0]);
    }
  }

  var camera = scene.getElementsByTagName("camera");

  if (camera.length) {
    position = null;
    rotation = null;

    var target = "";

    tempNode = camera[0].getElementsByTagName("name");

    var cam = sceneOut.camera;

    var fov = null;

    if (tempNode.length) {
      target = tempNode[0].firstChild.nodeValue;
    }

    tempNode = camera[0].getElementsByTagName("target");
    if (tempNode.length) {
      target = tempNode[0].firstChild.nodeValue;
    }

    if (target !== "") {
      cam.targetSceneObject = sceneOut.getSceneObject(target);
    }

    tempNode = camera[0].getElementsByTagName("position");
    if (tempNode.length) {
      position = tempNode[0];
    }

    tempNode = camera[0].getElementsByTagName("rotation");
    if (tempNode.length) {
      rotation = tempNode[0];
    }

    tempNode = camera[0].getElementsByTagName("fov");
    if (tempNode.length) {
      fov = tempNode[0];
    }

    if (cubicvr_isMotion(position)) {
      if (!cam.motion) {
        cam.motion = new CubicVR.Motion();
      }
      cubicvr_nodeToMotion(position, enums.motion.POS, cam.motion);
    } else if (position) {
      cam.position = util.floatDelimArray(position.firstChild.nodeValue);
    }

    if (cubicvr_isMotion(rotation)) {
      if (!cam.motion) {
        cam.motion = new CubicVR.Motion();
      }
      cubicvr_nodeToMotion(rotation, enums.motion.ROT, cam.motion);
    } else if (rotation) {
      cam.rotation = util.floatDelimArray(rotation.firstChild.nodeValue);
    }

    if (cubicvr_isMotion(fov)) {
      if (!cam.motion) {
        cam.motion = new CubicVR.Motion();
      }
      cubicvr_nodeToMotion(fov, enums.motion.FOV, cam.motion);
    } else if (fov) {
      cam.fov = parseFloat(fov.firstChild.nodeValue);
    }

  }


  return sceneOut;
}

 function RenderBuffer(width, height, depth_enabled) {
    this.createBuffer(width, height, depth_enabled);
  }

  RenderBuffer.prototype.createBuffer = function(width, height, depth_enabled) {
    this.fbo = null;
    this.depth = null;
    this.texture = null;
    this.width = parseInt(width, 10);
    this.height = parseInt(height, 10);

    var w = this.sizeParam(width);
    var h = this.sizeParam(height);

    var gl = GLCore.gl;

    this.fbo = gl.createFramebuffer();

    if (depth_enabled) {
      this.depth = gl.createRenderbuffer();
    }

    // configure fbo
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

    if (depth_enabled) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);

      if (navigator.appVersion.indexOf("Windows")!==-1)
      {
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth); 
      }
      else
      {
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.depth); 
      }
    }


    // if (depth_enabled) {
    //   gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
    //   gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    // }

    //  GL_DEPTH_COMPONENT32 0x81A7
    //  if (depth_enabled) { gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT, w, h); }
    // if (depth_enabled) {
    //   gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
    // }



    // init texture
    this.texture = new CubicVR.Texture();
    gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.texture.tex_id]);

    // configure texture params
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // clear buffer
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, base.Textures[this.texture.tex_id], 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  RenderBuffer.prototype.destroyBuffer = function() {
    var gl = GLCore.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteRenderbuffer(this.depth);
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(base.Textures[this.texture.tex_id]);
    base.Textures[this.texture.tex_id] = null;
  };

  RenderBuffer.prototype.sizeParam = function(t) {
    return t;
    // var s = 32;
    //
    // while (t > s) s *= 2;
    //
    // return s;
  };


  RenderBuffer.prototype.use = function() {
    var gl = GLCore.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    //  if (this.depth !== null) { gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth); }
    //  gl.viewport(0, 0, this.width, this.height);
  };

  function NormalMapGen(inTex,width,height)
  {
    var gl = GLCore.gl;

    this.width = width;
    this.height = height;
    this.srcTex = inTex;      
    this.outTex = new CubicVR.RenderBuffer(width,height);
    
     var tw = width, th = height;

     var isPOT = true;

     if (tw===1||th===1) {
       isPOT = false;
     } else {
       if (tw !== 1) { while ((tw % 2) === 0) { tw /= 2; } }
       if (th !== 1) { while ((th % 2) === 0) { th /= 2; } }
       if (tw > 1) { isPOT = false; }
       if (th > 1) { isPOT = false; }       
     }

      var vTexel = [1.0/width,1.0/height,0];

    // buffers
    this.outputBuffer = new CubicVR.RenderBuffer(width,height,false);

    // quads
    this.fsQuad = CubicVR.fsQuad.makeFSQuad(width,height);
    
    var vs = ["attribute vec3 aVertex;",
    "attribute vec2 aTex;",
    "varying vec2 vTex;",
    "void main(void)",
    "{",
    "  vTex = aTex;",
    "  vec4 vPos = vec4(aVertex.xyz,1.0);",
    "  gl_Position = vPos;",
    "}"].join("\n");
  

    // simple convolution test shader
    shaderNMap = new CubicVR.Shader(vs,      
    ["#ifdef GL_ES",
    "precision highp float;",
    "#endif",
    "uniform sampler2D srcTex;",
    "varying vec2 vTex;",
    "uniform vec3 texel;",
    "void main(void)",
    "{",
    " vec3 color;",
    " color.r = (texture2D(srcTex,vTex + vec2(texel.x,0)).r-texture2D(srcTex,vTex + vec2(-texel.x,0)).r)/2.0 + 0.5;",
    " color.g = (texture2D(srcTex,vTex + vec2(0,-texel.y)).r-texture2D(srcTex,vTex + vec2(0,texel.y)).r)/2.0 + 0.5;",
    " color.b = 1.0;",
    " gl_FragColor.rgb = color;",
    " gl_FragColor.a = 1.0;",
    "}"].join("\n"));
    
    shaderNMap.use();      
    shaderNMap.addUVArray("aTex");
    shaderNMap.addVertexArray("aVertex");
    shaderNMap.addInt("srcTex",0);
    shaderNMap.addVector("texel");
    shaderNMap.setVector("texel",vTexel);      

    this.shaderNorm = shaderNMap;

    // bind functions to "subclass" a texture
    this.setFilter=this.outputBuffer.texture.setFilter;
    this.clear=this.outputBuffer.texture.clear;
    this.use=this.outputBuffer.texture.use;
    this.tex_id=this.outputBuffer.texture.tex_id;
    this.filterType=this.outputBuffer.texture.filterType;

    this.outTex.use(gl.TEXTURE0);
    // 
    // if (!isPOT) {
    //    this.setFilter(enums.texture.filter.LINEAR);
    //    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    //    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);    
    //  } else {
       this.setFilter(enums.texture.filter.LINEAR);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    //  }
    
  }
  
  
  
  NormalMapGen.prototype.update = function()
  {
    var gl = GLCore.gl;

    var dims = gl.getParameter(gl.VIEWPORT);

    this.outputBuffer.use();
    
    gl.viewport(0, 0, this.width, this.height);
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.srcTex.use(gl.TEXTURE0);

    CubicVR.fsQuad.renderFSQuad(this.shaderNorm,this.fsQuad);  // copy the output buffer to the screen via fullscreen quad

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    gl.viewport(dims[0], dims[1], dims[2], dims[3]);
  }




 
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
  RenderBuffer: RenderBuffer,
  Timer: Timer,
  MainLoop: MainLoop,
  MouseViewController: MouseViewController,
  setMainLoop: setMainLoop,
  Textures: base.Textures,
  Textures_obj: base.Textures_obj,
  Images: base.Images,
  Landscape: Landscape,
  Camera: Camera,
  SkyBox: SkyBox,
  NormalMapGen: NormalMapGen,
  AutoCamera: AutoCamera,
//  MeshPool: MeshPool,
  renderObject: cubicvr_renderObject,
  globalAmbient: [0.1, 0.1, 0.1],
  setGlobalAmbient: function(c) {
    CubicVR.globalAmbient = c;
  },
  loadMesh: cubicvr_loadMesh,
  loadColladaWorker: cubicvr_loadColladaWorker,
  setGlobalDepthAlpha: GLCore.setDepthAlpha,
  setDefaultFilter: GLCore.setDefaultFilter,
  setSoftShadows: GLCore.setSoftShadows,
  Worker: CubicVR_Worker,
  RegisterModule:registerModule,
  getScriptLocation: function() { return SCRIPT_LOCATION; }
};

registerModule("Core",function(base) { return extend; });

//for (var ext in extend) {
//  if (extend.hasOwnProperty(ext)) {
//    this.CubicVR[ext] = extend[ext];
//  }
//}

//Materials.push(new CubicVR.Material("(null)"));

}(window, window.document, Math, function(){console.log('nop!');}));

/* @cuthere */
/* --- SNIP FOR MINIFICATION --- */

// yes document.write is dirty, but it prevents race conditions since they're forced to load and parse now before this script completes
(function() {

  var CubicVR_Modules = [
    "Math","Utility","Shader",
    "Texture","Material","Mesh","UVMapper",
    "Light","Motion","Scene","PostProcess","Layout",
    "Primitives","COLLADA","GML","Particles", 
    "Octree",
  ];

  for (var i = 0; i < CubicVR_Modules.length; i++) {
    document.write('<script type="text/javascript" src="'+CubicVR.getScriptLocation()+'/source/CubicVR.'+CubicVR_Modules[i]+'.js"></script>');
  }
})();


