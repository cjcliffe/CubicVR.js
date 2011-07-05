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
    registry: {}, // new modules register here
    MAX_LIGHTS: 6
  };

  function registerModule(module_id, module_in) {
    //log("Registering Module: "+module_id);
    base.registry[module_id] = true;
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
  setGlobalDepthAlpha: GLCore.setDepthAlpha,
  setDefaultFilter: GLCore.setDefaultFilter,
  setSoftShadows: GLCore.setSoftShadows,
  RegisterModule:registerModule,
  getScriptLocation: function() { return SCRIPT_LOCATION; }
};

registerModule("Core",function(base) { return extend; });

}(window, window.document, Math, function(){console.log('nop!');}));

/* CubicVR:Makefile-cut */
/* --- SNIP FOR MINIFICATION --- */

// yes document.write is dirty, but it prevents race conditions since they're forced to load and parse now before this script completes
(function() {

  var CubicVR_Modules = [
    "Math","Utility","Shader","MainLoop",
    "Texture","Material","Mesh","UVMapper","Renderer",
    "Light","Camera","Motion","Scene","PostProcess","Layout",
    "Primitives","COLLADA","GML","Particles","Landscape", 
    "Octree","CVRXML", "Worker"
  ];

  function importModules () {
    var scripts = [];
    for (var i = 0; i < CubicVR_Modules.length; i++) {
      importScripts(CubicVR.getScriptLocation()+'/source/CubicVR.'+CubicVR_Modules[i]+'.js');
    } //for
  } //importModules

  try {
    for (var i = 0; i < CubicVR_Modules.length; i++) {
      document.write('<script type="text/javascript" src="'+CubicVR.getScriptLocation()+'/source/CubicVR.'+CubicVR_Modules[i]+'.js"></script>');
    }
  }
  catch (e) {
    var safeLoad = function (e) {
      var scriptLocation = e.data.data + "";
      CubicVR.getScriptLocation = function () { return scriptLocation };
      importModules();
      self.removeEventListener('message', safeLoad, false);
      CubicVR.InitWorker();
    };
    self.addEventListener('message', safeLoad, false);
  } //try
})();
