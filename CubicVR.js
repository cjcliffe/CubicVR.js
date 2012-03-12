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
  CubicVR.contexts = {};

  var log;
  try {
    log = (console !== undefined && console.log) ?
      function(msg) { console.log("CubicVR Log: " + msg); } :
      function() {};
  }
  catch(ex) {
    log = nop;
  } //try

  var enums = {
    quality: {
      LOW: 0,
      MEDIUM: 1,
      HIGH: 2      
    }
  };
  
  window['cubicvr'] = enums;
  
  function parseEnum(typeBase,e) {
    if (typeof(typeBase)!=='object') {
        log("enumerator validation failed, invalid type base object.");
        return undef;        
    }
    if (e === undef) {
        return undef;
    } else if (typeof(e) === 'number') {
        return e;
/*        if (typeBase.indexOf(e) !== -1) {
            return e;
        } else {
            log("enumerator validation failed, unknown enum value: "+e);
            return undef;
        }*/
    } else if (typeof(e) === 'string') {
        var finiteVal = parseInt(e,10);
        if (e !== "" && isFinite(finiteVal)) {
            return finiteVal;
        }
    
        var enumName = e.toUpperCase();
        var enumVal = typeBase[enumName];
        if (enumVal !== undef) {
            return enumVal;
        } else {
            log("enumerator validation failed, unknown enum value: "+e);
            var possibles = "";
            for (var k in typeBase) {
                if (typeBase.hasOwnProperty(k)) {
                    if (possibles !== "") {
                        possibles = possibles + ", ";
                    }
                    possibles = possibles + k.toLowerCase();
                }
            }
            log("possible enum values are: "+possibles);
            return undef;
        }
    } else {
        return undef;
    }
  }

  var moduleRegistry = {};

  var cubicvr_identity = [1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0];

  var Core = function( context ) {
    var base = this;
    var _context;

    if( context ) {
      _context = context + "";
      Object.defineProperty( this, "context", {
        enumerable: true,
        configurable: false,
        get: function() {
          return _context;
        }
      });
    }

    base.undef = undef;
    base.nop = nop;
    base.scriptLocation = SCRIPT_LOCATION;
    base.GLCore = GLCore;
    base.Textures = [];
    base.Textures_obj = [];
    base.Textures_ref = [];
    base.Images = [];
    base.ShaderPool = [];
    base.log = log;
    base.enums = CubicVR.enums;
    base.MAX_LIGHTS = 6;
    base.features = {};
    base.quality = CubicVR.enums.HIGH;
  
    var featureSet = {
      low: {
        antiAlias: false,
        lightPerPixel: false,
        lightShadows: false,
        texturePerPixel: false,
        postProcess: false     
      },
      medium: {
        antiAlias: false,
        lightPerPixel: true,
        lightShadows: false,
        texturePerPixel: false,
        postProcess: false           
      },
      high: {
        antiAlias: true,
        lightPerPixel: true,
        lightShadows: true,
        texturePerPixel: true,
        postProcess: true           
      }
    };
    
    base.features = featureSet.high;
    
    function startModules() {
      for (var mod in moduleRegistry) {
        var extend = moduleRegistry[mod](base);
        for (var ext in extend) {
           if (extend.hasOwnProperty(ext)) {
             //log("Added extension: "+ext);
             base[ext] = extend[ext];
          } //if
        } //for
      } //for
    } //startModules

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
      resizeList: [],
      canvasSizeFactor:1
    };

    /* Core Init, single context only at the moment */
    GLCore.init = function(gl_in, vs_in, fs_in) {
      var gl,
        util = base.util,
        enums = CubicVR.enums,
        i;

      if (vs_in && fs_in) {
        vs_in = util.getScriptContents(vs_in);
        fs_in = util.getScriptContents(fs_in);
      } else {  // default shader handler if no custom override specified
        // See if they have been embeded in js
        if (window.CubicVRShader.CubicVRCoreVS && window.CubicVRShader.CubicVRCoreFS) {
          vs_in = window.CubicVRShader.CubicVRCoreVS;
          fs_in = window.CubicVRShader.CubicVRCoreFS;
        } else {
          vs_in = util.getScriptContents(SCRIPT_LOCATION + "CubicVR_Core.vs");
          fs_in = util.getScriptContents(SCRIPT_LOCATION + "CubicVR_Core.fs");
        }
      }

      if (gl_in === undef) {  // no canvas? no problem!
        gl_in = document.createElement("canvas");
        if (!gl) {
          try {
              gl = gl_in.getContext("experimental-webgl",{antialias:base.features.antiAlias});
          } catch (e1) {
              return null;
          }
        }
        
        GLCore.gl = gl;
        
        if (GLCore.fixed_size !== null) {
          GLCore.width = GLCore.fixed_size[0];
          GLCore.height = GLCore.fixed_size[1];
          GLCore.resizeElement(gl_in,GLCore.width,GLCore.height);
        } else {


          // document.body.style.margin = "0px";        
          // document.body.style.padding = "0px";        
          GLCore.addResizeable(gl_in);
          
          if (GLCore.canvasSizeFactor!==1 && gl_in.getContext!==undef) {
            var nw = Math.round(window.innerWidth*GLCore.canvasSizeFactor), nh = Math.round(window.innerHeight*GLCore.canvasSizeFactor);
            GLCore.resizeElement(gl_in,nw,nh);        
            gl_in.style.top = (window.innerHeight/2-nh/2) + "px";
            gl_in.style.left = (window.innerWidth/2-nw/2) + "px";
  //            gl_in.style.top="0px";
  //            gl_in.style.left="0px";
  //            gl_in.style.width="100%";
  //           gl_in.style.height="100%";
            gl_in.style.position = "absolute";
          } else {
            GLCore.resizeElement(gl_in,window.innerWidth,window.innerHeight);        
          }
        }
        
        document.body.appendChild(gl_in);
      }
      
      if (gl_in.getContext !== undef && gl_in.width !== undef && gl_in.height !== undef)
      {
        try {
              if (!gl) gl = gl_in.getContext("experimental-webgl",{antialias:base.features.antiAlias});
              gl.viewport(0, 0, gl_in.width, gl_in.height);
              GLCore.canvas = gl_in;
              GLCore.width = gl_in.width;
              GLCore.height = gl_in.height;
              
              // set these default, can always be easily over-ridden
              gl.clearColor(0.0, 0.0, 0.0, 1.0);
              gl.clearDepth(1.0);
              gl.enable(gl.DEPTH_TEST);
              gl.depthFunc(gl.LEQUAL);            
        } catch (e2) {}
        
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

      for (i = CubicVR.enums.light.type.NULL; i < enums.light.type.MAX; i++) {
        base.ShaderPool[i] = [];
      }

      var dummyTex = new base.Texture();
      var lightTest = new base.Material();

      for (i = 0; i < enums.texture.map.MAX; i++) {
        if (i===enums.texture.map.BUMP) continue; // fix for crashy fglrx driver, todo: check it against newer revisions.
        lightTest.setTexture(dummyTex,i);
      }
      lightTest.opacity = 0.5;

      var lc = 1;
      
      while (1) {
          if (!lightTest.use(enums.light.type.POINT,lc) || lc === 8) {
            base.MAX_LIGHTS=lc;      
            break;
          }
          lc++;
      }

      var emptyLight = GLCore.emptyLight = new base.Light(enums.light.type.POINT);
      emptyLight.diffuse = [0, 0, 0];
      emptyLight.specular = [0, 0, 0];
      emptyLight.distance = 0;
      emptyLight.intensity = 0;
      emptyLight.cutoff = 0;


      log("Calibrated maximum lights per pass to: "+lc);
      

      for (i = enums.light.type.NULL; i < enums.light.type.MAX; i++) {
        base.ShaderPool[i] = [];
      }
      
      if (GLCore.resizeList.length) {
        window.addEventListener('resize',  function()  { base.GLCore.onResize(); }, false);
        GLCore.resize_active = true;
      }
      
      return gl;
    };
    
    GLCore.addResizeable = function(e) {
      base.GLCore.resizeList.push(e);
    };
    
    GLCore.onResize = function() {
      var w = window.innerWidth;
      var h = window.innerHeight; 
      
      if (GLCore.fixed_size !== null) {
        w = base.GLCore.fixed_size[0];
        h = base.GLCore.fixed_size[1];
      }
      
      for (var i = 0, iMax = base.GLCore.resizeList.length; i < iMax; i++) {
        GLCore.resizeElement(base.GLCore.resizeList[i],w,h);
      }    
    };
    
    GLCore.setFixedAspect = function(fa_in) {
      base.GLCore.fixed_aspect = fa_in;
    };
    
    GLCore.setFixedSize = function(fs_width, fs_height) {
      base.GLCore.fixed_size = [fs_width,fs_height];
    };
    
    GLCore.getCanvas = function() {
      return base.GLCore.canvas;
    };

    GLCore.resizeElement = function(e,width,height) {
      var gl = GLCore.gl;

      if (GLCore.fixed_aspect !== 0.0) {
        var aspect_height = width*(1.0/base.GLCore.fixed_aspect);
        if (aspect_height > height) { 
          aspect_height = height;
          width = height*base.GLCore.fixed_aspect;
        }
        height = aspect_height;
      }
      
      if (e.getContext !== undef) {
        e.width = width;
        e.height = height;
        
        if (!base.GLCore.fixed_size) {
          e.style.left = ((window.innerWidth/2.0-width/2.0) | 0) + "px";
          e.style.top = ((window.innerHeight/2.0-height/2.0) | 0) + "px";
          e.style.position='absolute';
        } 
              
        gl.viewport(0, 0, width, height);          
      } else {
        e.resize(width,height);
      }
    };

    GLCore.setDepthAlpha = function(da, near, far) {
      GLCore.depth_alpha = da;
      GLCore.depth_alpha_near = near;
      GLCore.depth_alpha_far = far;
    };

    GLCore.setDefaultFilter = function(filterType) {
      GLCore.default_filter = parseEnum(base.enums.texture.filter,filterType);
    };

    GLCore.setSoftShadows = function(bSoft) {
      GLCore.soft_shadow = bSoft;
    };

    GLCore.setCanvasSizeFactor = function(csfactor) {
      GLCore.canvasSizeFactor = csfactor;
    };

    GLCore.setQuality = function(enum_quality) {
        enum_quality = parseEnum(enums.quality,enum_quality);
        if (enum_quality === enums.quality.HIGH) {
          base.features = featureSet.high;
        } else if (enum_quality === enums.quality.MEDIUM) {
          base.features = featureSet.medium;
        } else if (enum_quality === enums.quality.LOW) {
          base.features = featureSet.low;
        }
        
        base.quality = enum_quality;
        
        return base.features;
    };
    
    
    GLCore.getQuality = function(enum_quality) {
        return base.features;
    };

    var initCubicVR = function( options, vs, fs ) {
      var canvas;

      var scripts = document.getElementsByTagName( "script" );
      for (var i=0; i<scripts.length; ++i) {
        var script = scripts[i];
        if (!script.getAttribute("data-cubicvr")){
          continue;
        }
        var src = script.getAttribute('src');
        if (src) {
          var xmlHttp = new XMLHttpRequest();
          xmlHttp.open('GET', src, false);
          xmlHttp.send(null);
          if (xmlHttp.status === 200 || xmlHttp.status === 0) {
            script.text = xmlHttp.responseText;
          }
        } //if
      }

      if ( typeof(options) === "object" ) {
        if (options.getContext) {
          canvas = options;
        } else {
          canvas = options.canvas;
          vs = options.vertexShader || vs;
          fs = options.fragmentShader || fs;
        }
      } else if (options) {
        if (options[0] == "#") {
          options = options.substr(1);      
        }
        canvas = document.getElementById(options);
      }

      startModules();

      GLCore.init(canvas, vs, fs);

      return GLCore.gl;

    }; //initCubicVR
     
    // simplified initialization with WebGL check 
    function startUp(canvas,pass,fail,vs,fs) {
        if (typeof(canvas) === 'string' && canvas.toLowerCase() === "auto") {
            canvas = undef;
        }
        fail = fail || "Sorry, your browser does not appear to support WebGL :-(";

        var gl = initCubicVR(canvas,vs,fs);
        if (gl) {
            if (pass && typeof(pass) === 'function') {
                pass(gl, base.getCanvas ());
            }
            return gl;
        } if (!gl) {
            if (fail && typeof(fail) === 'function') {
                fail();
            } else {
                alert(fail);
            }
            return false;
        }
    }

    base.GLCore = GLCore;
    base.init = initCubicVR;
    base.start = startUp;
    base.addResizeable = GLCore.addResizeable;
    base.setFixedAspect = GLCore.setFixedAspect;
    base.setFixedSize = GLCore.setFixedSize;
    base.setCanvasSizeFactor = GLCore.setCanvasSizeFactor;
    base.getCanvas = GLCore.getCanvas;
    base.enums = enums;
    base.IdentityMatrix = cubicvr_identity;
    base.Textures = base.Textures;
    base.Textures_obj = base.Textures_obj;
    base.Images = base.Images;
    base.globalAmbient = [0.1, 0.1, 0.1];
    base.setGlobalAmbient = function(c) {
      base.globalAmbient = c;
    };
    base.setGlobalDepthAlpha = GLCore.setDepthAlpha;
    base.setDefaultFilter = GLCore.setDefaultFilter;
    base.setSoftShadows = GLCore.setSoftShadows;
    base.setQuality = GLCore.setQuality;
    base.getQuality = GLCore.getQuality;
    base.RegisterModule = CubicVR.RegisterModule;
    base.getScriptLocation = CubicVR.getScriptLocation;
    base.parseEnum = parseEnum
    
  }; //Core

  //registerModule("Core", Core { return extend; });

  CubicVR.init = function( options, vs, fs ) {
    var context, core;
    if( options && options.context && typeof options.context === "string" ) {
      context = options.context;
    }
    core = new Core( context );
    if( core.context ) {
      CubicVR.contexts[ core.context ] = core;
      core.init( options, vs, fs );
      return core;
    }
    else {
      window.CubicVR = CubicVR = core;
      core.init( options, vs, fs );
      return core.GLCore.gl;
    } //if

  }; //init

  CubicVR.start = function( canvas, pass, fail, vs, fs ) {
    var core = new Core();
    window.CubicVR = CubicVR = core;
    core.start( canvas, pass, fail, vs, fs );
    return core;
  }; //start

  CubicVR.RegisterModule = function( module_id, module_in ) {
    //log("Registering Module: "+module_id);
    moduleRegistry[module_id] = module_in;
  }; //registerModule

  CubicVR.getScriptLocation = function() {
    return SCRIPT_LOCATION;
  }; //getScriptLocation

  CubicVR.enums = enums;

}(window, window.document, Math, function(){}));

window.CubicVRShader = {};	// for embedding shaders and keeping context happy

/* CubicVR:Makefile-cut */
/* --- SNIP FOR MINIFICATION --- */

// yes document.write is dirty, but it prevents race conditions since they're forced to load and parse now before this script completes
(function() {

  var i;

  var CubicVR_Modules = [
    "Math","Utility","Shader","MainLoop",
    "Texture","Material","Mesh","UVMapper","Renderer",
    "Light","Camera","Motion","Event","Scene","PostProcess","Layout",
    "Primitives","COLLADA","GML","PDF","Particles","Landscape",
    "Octree", "CVRXML", "Worker", "Polygon",
    "ScenePhysics","CollisionMap","RigidVehicle"
  ];

  function importModules () {
    var scripts = [];
    for (var i = 0; i < CubicVR_Modules.length; i++) {
      importScripts(CubicVR.getScriptLocation()+'/source/CubicVR.'+CubicVR_Modules[i]+'.js');
    } //for
  } //importModules

  try {
    if (typeof define === 'function' && define.amd) {
      var dependencies = [];
      for (i = 0; i < CubicVR_Modules.length; i++) {
        dependencies.push('order!./source/CubicVR.' + CubicVR_Modules[i]);
      }
      define(dependencies, function () {
        // Do not return a value, since after a build
        // this block will not exist, so the global
        // for CubicVR should always be used.
      });
    } else {
      for (i = 0; i < CubicVR_Modules.length; i++) {
        document.write('<script type="text/javascript" src="'+CubicVR.getScriptLocation()+'source/CubicVR.'+CubicVR_Modules[i]+'.js"></script>');
      }
    }
  }
  catch (e) {
    var safeLoad = function (e) {
      var scriptLocation = e.data.data + "";
      CubicVR.getScriptLocation = function () { return scriptLocation; };
      importModules();
      self.removeEventListener('message', safeLoad, false);
      CubicVR.InitWorker();
    };
    self.addEventListener('message', safeLoad, false);
  } //try
})();

