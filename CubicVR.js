/*
  Javascript port of CubicVR 3D engine for WebGL
  by Charles J. Cliffe
  http://www.cubicvr.org/

  May be used under the terms of LGPL v3.0 or greater.
*/

/*globals alert: false */

/** Global Constants **/
var M_PI = 3.1415926535897932384626433832795028841968;
var M_TWO_PI = 2.0 * M_PI;
var M_HALF_PI = M_PI / 2.0;



(function(undef) {

  var CubicVR = this.CubicVR = {};

  var GLCore = {};
  var Materials = [];
  var Material_ref = [];
  var Textures = [];
  var Textures_obj = [];
  var Texture_ref = [];
  var Images = [];
  var ShaderPool = [];
  var MeshPool = [];

  var CoreShader_vs = null;
  var CoreShader_fs = null;

  var log = (console && console.log) ?
    function(msg) { console.log("CubicVR Log: " + msg); } :
    function() {};

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
        MAX: 5
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
        ALPHA: 7
      },
      filter: {
        LINEAR: 0,
        LINEAR_MIP: 1,
        NEAREST: 2
      }
    },

    uv: {
      /* UV Axis enums */
      axis: {
        X: 0,
        Y: 1,
        Z: 2
      },

      /* UV Projection enums */
      projection: {
        UV: 0,
        PLANAR: 1,
        CYLINDRICAL: 2,
        SPHERICAL: 3,
        CUBIC: 4,
        SKY: 5
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

    motion: {
      POS: 0,
      ROT: 1,
      SCL: 2,
      FOV: 3,
      LENS: 4,
      X: 0,
      Y: 1,
      Z: 2,
      V: 3
    },

    envelope: {
      shape: {
        TCB: 0,
        HERM: 1,
        BEZI: 2,
        LINE: 3,
        STEP: 4,
        BEZ2: 5
      },
      behavior: {
        RESET: 0,
        CONSTANT: 1,
        REPEAT: 2,
        OSCILLATE: 3,
        OFFSET: 4,
        LINEAR: 5
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

  var cubicvr_identity = [1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0];

  /* Base functions */
  var vec2 = {
    equal: function(a, b) {
      var epsilon = 0.00000001;

      if ((a === undef) && (b === undef)) {
        return true;
      }
      if ((a === undef) || (b === undef)) {
        return false;
      }

      return (Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon);
    }
  };

  var vec3 = {
    length: function(pt) {
      return Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1] + pt[2] * pt[2]);
    },
    normalize: function(pt) {
      var d = Math.sqrt((pt[0] * pt[0]) + (pt[1] * pt[1]) + (pt[2] * pt[2]));
      if (d === 0) {
        return [0, 0, 0];
      }
      return [pt[0] / d, pt[1] / d, pt[2] / d];
    },
    dot: function(v1, v2) {
      return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    },
    angle: function(v1, v2) {
      var a = Math.acos((v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]) * Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2])));

      return a;
    },
    cross: function(vectA, vectB) {
      return [
      vectA[1] * vectB[2] - vectB[1] * vectA[2], vectA[2] * vectB[0] - vectB[2] * vectA[0], vectA[0] * vectB[1] - vectB[0] * vectA[1]];
    },
    multiply: function(vectA, constB) {
      return [vectA[0] * constB, vectA[1] * constB, vectA[2] * constB];
    },
    add: function(vectA, vectB) {
      return [vectA[0] + vectB[0], vectA[1] + vectB[1], vectA[2] + vectB[2]];
    },
    subtract: function(vectA, vectB) {
      return [vectA[0] - vectB[0], vectA[1] - vectB[1], vectA[2] - vectB[2]];
    },
    equal: function(a, b) {
      var epsilon = 0.00000001;

      if ((a === undef) && (b === undef)) {
        return true;
      }
      if ((a === undef) || (b === undef)) {
        return false;
      }

      return (Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon && Math.abs(a[2] - b[2]) < epsilon);
    },
    moveViewRelative: function moveViewRelative(position, target, xdelta, zdelta, alt_source) {
      var ang = Math.atan2(zdelta, xdelta);
      var cam_ang = Math.atan2(target[2] - position[2], target[0] - position[0]);
      var mag = Math.sqrt(xdelta * xdelta + zdelta * zdelta);

      var move_ang = cam_ang + ang + M_HALF_PI;

      if (typeof(alt_source) === 'object') {
        return [alt_source[0] + mag * Math.cos(move_ang), alt_source[1], alt_source[2] + mag * Math.sin(move_ang)];
      }

      return [position[0] + mag * Math.cos(move_ang), position[1], position[2] + mag * Math.sin(move_ang)];
    },
    trackTarget: function(position, target, trackingSpeed, safeDistance) {
      var camv = vec3.subtract(target, position);
      var dist = camv;
      var fdist = vec3.length(dist);
      var motionv = camv;

      motionv = vec3.normalize(motionv);
      motionv = vec3.multiply(motionv, trackingSpeed * (1.0 / (1.0 / (fdist - safeDistance))));

      var ret_pos;

      if (fdist > safeDistance) {
        ret_pos = vec3.add(position, motionv);
      } else if (fdist < safeDistance) {
        motionv = camv;
        motionv = vec3.normalize(motionv);
        motionv = vec3.multiply(motionv, trackingSpeed * (1.0 / (1.0 / (Math.abs(fdist - safeDistance)))));
        ret_pos = vec3.subtract(position, motionv);
      } else {
        ret_pos = [position[0], position[1] + motionv[2], position[2]];
      }

      return ret_pos;
    },
    get_closest_to: function(ptA, ptB, ptTest) {
      var S, T, U;

      S = vec3.subtract(ptB, ptA);
      T = vec3.subtract(ptTest, ptA);
      U = vec3.add(vec3.multiply(S, vec3.dot(S, T) / vec3.dot(S, S)), ptA);

      return U;
    }
  };

  var triangle = {
    normal: function(pt1, pt2, pt3) {
      var v1 = [pt1[0] - pt2[0], pt1[1] - pt2[1], pt1[2] - pt2[2]];

      var v2 = [pt2[0] - pt3[0], pt2[1] - pt3[1], pt2[2] - pt3[2]];

      return [v1[1] * v2[2] - v1[2] * v2[1], v1[2] * v2[0] - v1[0] * v2[2], v1[0] * v2[1] - v1[1] * v2[0]];
    }
  };

  var mat4 = {
    lookat: function(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ) {
      var view_vec = vec3.normalize([lookAtX - eyeX, lookAtY - eyeY, lookAtZ - eyeZ]);
      var up_vec = vec3.normalize([upX, upY, upZ]);

      var s = vec3.cross(view_vec, up_vec);
      var u = vec3.cross(s, view_vec);

      var mat = [
        s[0], u[0], -view_vec[0], 0,
        s[1], u[1], -view_vec[1], 0,
        s[2], u[2], -view_vec[2], 0,
        0, 0, 0, 1
        ];

      var trans = new Transform();
      trans.translate(-eyeX, -eyeY, -eyeZ);
      trans.pushMatrix(mat);

      mat = trans.getResult();

      return mat;
    },
    multiply: function(m1, m2) {
      var mOut = [];

      mOut[0] = m2[0] * m1[0] + m2[4] * m1[1] + m2[8] * m1[2] + m2[12] * m1[3];
      mOut[1] = m2[1] * m1[0] + m2[5] * m1[1] + m2[9] * m1[2] + m2[13] * m1[3];
      mOut[2] = m2[2] * m1[0] + m2[6] * m1[1] + m2[10] * m1[2] + m2[14] * m1[3];
      mOut[3] = m2[3] * m1[0] + m2[7] * m1[1] + m2[11] * m1[2] + m2[15] * m1[3];
      mOut[4] = m2[0] * m1[4] + m2[4] * m1[5] + m2[8] * m1[6] + m2[12] * m1[7];
      mOut[5] = m2[1] * m1[4] + m2[5] * m1[5] + m2[9] * m1[6] + m2[13] * m1[7];
      mOut[6] = m2[2] * m1[4] + m2[6] * m1[5] + m2[10] * m1[6] + m2[14] * m1[7];
      mOut[7] = m2[3] * m1[4] + m2[7] * m1[5] + m2[11] * m1[6] + m2[15] * m1[7];
      mOut[8] = m2[0] * m1[8] + m2[4] * m1[9] + m2[8] * m1[10] + m2[12] * m1[11];
      mOut[9] = m2[1] * m1[8] + m2[5] * m1[9] + m2[9] * m1[10] + m2[13] * m1[11];
      mOut[10] = m2[2] * m1[8] + m2[6] * m1[9] + m2[10] * m1[10] + m2[14] * m1[11];
      mOut[11] = m2[3] * m1[8] + m2[7] * m1[9] + m2[11] * m1[10] + m2[15] * m1[11];
      mOut[12] = m2[0] * m1[12] + m2[4] * m1[13] + m2[8] * m1[14] + m2[12] * m1[15];
      mOut[13] = m2[1] * m1[12] + m2[5] * m1[13] + m2[9] * m1[14] + m2[13] * m1[15];
      mOut[14] = m2[2] * m1[12] + m2[6] * m1[13] + m2[10] * m1[14] + m2[14] * m1[15];
      mOut[15] = m2[3] * m1[12] + m2[7] * m1[13] + m2[11] * m1[14] + m2[15] * m1[15];

      return mOut;
    },
    vec4_multiply: function(m1, m2) {
      var mOut = [];

      mOut[0] = m2[0] * m1[0] + m2[4] * m1[1] + m2[8] * m1[2] + m2[12] * m1[3];
      mOut[1] = m2[1] * m1[0] + m2[5] * m1[1] + m2[9] * m1[2] + m2[13] * m1[3];
      mOut[2] = m2[2] * m1[0] + m2[6] * m1[1] + m2[10] * m1[2] + m2[14] * m1[3];
      mOut[3] = m2[3] * m1[0] + m2[7] * m1[1] + m2[11] * m1[2] + m2[15] * m1[3];

      return mOut;
    },
    vec3_multiply: function(m1, m2) {
      var mOut = [];

      mOut[0] = m2[0] * m1[0] + m2[4] * m1[1] + m2[8] * m1[2] + m2[12];
      mOut[1] = m2[1] * m1[0] + m2[5] * m1[1] + m2[9] * m1[2] + m2[13];
      mOut[2] = m2[2] * m1[0] + m2[6] * m1[1] + m2[10] * m1[2] + m2[14];

      return mOut;
    },
    perspective: function(fovy, aspect, near, far) {
      var yFac = Math.tan(fovy * M_PI / 360.0);
      var xFac = yFac * aspect;

      return [
      1.0 / xFac, 0, 0, 0, 0, 1.0 / yFac, 0, 0, 0, 0, -(far + near) / (far - near), -1, 0, 0, -(2.0 * far * near) / (far - near), 0];
    }
  };

  var util = {
    getScriptContents: function(id) {
      var shaderScript = document.getElementById(id);

      var str = "";
      var srcUrl = "";

      if (!shaderScript) {
        srcUrl = id;
      } else {
        if (shaderScript.src !== "" || shaderScript.attributes['srcUrl'] !== undef) {
          srcUrl = (shaderScript.src !== '') ? shaderScript.src : (shaderScript.attributes['srcUrl'].value);
        }
      }

      if (srcUrl.length !== 0) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open('GET', srcUrl, false);
        xmlHttp.send(null);

        if (xmlHttp.status === 200 || xmlHttp.status === 0) {
          str = xmlHttp.responseText;
        }
      } else {
        var k = shaderScript.firstChild;
        while (k) {
          if (k.nodeType === 3) {
            str += k.textContent;
          }
          k = k.nextSibling;
        }
      }

      return str;
    },
    getURL: function(srcUrl) {
      try {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open('GET', srcUrl, false);
        xmlHttp.send(null);

        if (xmlHttp.status === 200 || xmlHttp.status === 0) {
          if (xmlHttp.responseText.length) {
            return xmlHttp.responseText;
          } else if (xmlHttp.responseXML) {
            return xmlHttp.responseXML;
          }
        }
      }
      catch(e) {
        alert(srcUrl + " failed to load.");
      }


      return null;
    },
    getXML: function(srcUrl) {
      try {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open('GET', srcUrl, false);
        xmlHttp.send(null);

        if (xmlHttp.status === 200 || xmlHttp.status === 0) {
          return xmlHttp.responseXML;
        }
      }
      catch(e) {
        alert(srcUrl + " failed to load.");
      }


      return null;
    },
    repackArray: function(data, stride, count) {
      if (data.length !== parseInt(stride, 10) * parseInt(count, 10)) {
        log("array repack error, data size !== stride*count: data.length=" +
            data.length + " stride=" + stride + " count=" + count);
      }

      var returnData = [];

      var c = 0;
      for (var i = 0, iMax = data.length; i < iMax; i++) {
        var ims = i % stride;

        if (ims === 0) {
          returnData[c] = [];
        }

        returnData[c][ims] = data[i];

        if (ims === stride - 1) {
          c++;
        }
      }

      return returnData;
    },
    collectTextNode: function(tn) {
      if (!tn) {
        return "";
      }

      var s = "";
      var textNodeChildren = tn.childNodes;
      for (var i = 0, tnl = textNodeChildren.length; i < tnl; i++) {
        s += textNodeChildren[i].nodeValue;
      }
      return s;
    },
    floatDelimArray: function(float_str, delim) {
      var fa = float_str.split(delim ? delim : ",");
      for (var i = 0, imax = fa.length; i < imax; i++) {
        fa[i] = parseFloat(fa[i]);
      }
      if (fa[fa.length - 1] !== fa[fa.length - 1]) {
        fa.pop();
      }
      return fa;
    },
    intDelimArray: function(float_str, delim) {
      var fa = float_str.split(delim ? delim : ",");
      for (var i = 0, imax = fa.length; i < imax; i++) {
        fa[i] = parseInt(fa[i], 10);
      }
      if (fa[fa.length - 1] !== fa[fa.length - 1]) {
        fa.pop();
      }
      return fa;
    },
    textDelimArray: function(text_str, delim) {
      var fa = text_str.split(delim ? delim : ",");
      for (var i = 0, imax = fa.length; i < imax; i++) {
        fa[i] = fa[i];
      }
      return fa;
    }
  };


  /* Core Init, single context only at the moment */
  GLCore.init = function(gl_in, vs_in, fs_in) {
    var gl = gl_in;

    GLCore.gl = gl_in;
    GLCore.CoreShader_vs = util.getScriptContents(vs_in);
    GLCore.CoreShader_fs = util.getScriptContents(fs_in);
    GLCore.depth_alpha = false;

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    for (var i = enums.light.type.NULL; i < enums.light.type.MAX; i++) {
      ShaderPool[i] = [];
    }
  };

  GLCore.setDepthAlpha = function(da, near, far) {
    GLCore.depth_alpha = da;
    GLCore.depth_alpha_near = near;
    GLCore.depth_alpha_far = far;
  };



  

  var cubicvr_compileShader = function(gl, str, type) {
    var shader;

    if (type === "x-shader/x-fragment") {
      shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (type === "x-shader/x-vertex") {
      shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
      return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  };

  var cubicvr_getShader = function(gl, id) {
    var shaderScript = document.getElementById(id);

    if (!shaderScript) {
      return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
      if (k.nodeType === 3) {
        str += k.textContent;
      }
      k = k.nextSibling;
    }

    var shader;

    if (shaderScript.type === "x-shader/x-fragment") {
      shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type === "x-shader/x-vertex") {
      shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
      return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  };

  /*****************************************************************************
   * Workers
   *****************************************************************************/

  function CubicVR_Worker(fn, message_function) {
    this._worker = new Worker("../../CubicVR.js");
    this._data = null;
    this._function = fn;
    this.message_function = undef;

    var that = this;
    this._worker.onmessage = function(e) {
      this._data = e.data;
      if (that.message_function !== undef) {
        that.message_function(e);
      }
    }; //onmessage
    this._worker.onerror = function(e) {
      if (window.console) {
        log("Error: " + e.message + ": " + e.lineno);
      }
    }; //onerror
  } //CubicVR_Worker::Constructor 
  CubicVR_Worker.prototype.start = function() {
    this._worker.postMessage({
      message: "start",
      data: this._function
    });
  }; //CubicVR_Worker::start
  CubicVR_Worker.prototype.stop = function() {
    this._worker.postMessage({
      message: "stop",
      data: null
    });
  }; //CubicVR_Worker::stop
  CubicVR_Worker.prototype.send = function(message_data) {
    this._worker.postMessage({
      message: "data",
      data: message_data
    });
  }; //CubicVR_Worker::send
  /*****************************************************************************
   * Global Worker Store
   *****************************************************************************/

  function CubicVR_GlobalWorkerStore() {
    this.listener = null;
  } //CubicVR_GlobalWorkerStore
  var global_worker_store = new CubicVR_GlobalWorkerStore();

  /* Transform Controller */

  function Transform(init_mat) {
    return this.clearStack(init_mat);
  }

  Transform.prototype.setIdentity = function() {
    this.m_stack[this.c_stack] = this.getIdentity();
    if (this.valid === this.c_stack && this.c_stack) {
      this.valid--;
    }
    return this;
  };


  Transform.prototype.getIdentity = function() {
    return [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
  };

  Transform.prototype.invalidate = function() {
    this.valid = 0;
    this.result = null;
    return this;
  };

  Transform.prototype.getResult = function() {
    if (!this.c_stack) {
      return this.m_stack[0];
    }

    if (this.valid !== this.c_stack) {
      if (this.valid > this.c_stack) {
        while (this.valid > this.c_stack + 1) {
          this.valid--;
          this.m_cache.pop();
        }
      } else {
        for (var i = this.valid; i <= this.c_stack; i++) {
          if (i === 0) {
            this.m_cache[0] = this.m_stack[0];
          } else {
            this.m_cache[i] = mat4.multiply(this.m_cache[i - 1], this.m_stack[i]);
          }
          this.valid++;
        }
      }

      this.result = this.m_cache[this.valid - 1];
    }
    return this.result;
  };

  Transform.prototype.pushMatrix = function(m) {
    this.c_stack++;
    this.m_stack.push(m ? m : this.getIdentity());
    return this;
  };

  Transform.prototype.popMatrix = function() {
    if (this.c_stack === 0) {
      return;
    }
    this.c_stack--;
    return this;
  };

  Transform.prototype.clearStack = function(init_mat) {
    this.m_stack = [];
    this.m_cache = [];
    this.c_stack = 0;
    this.valid = 0;
    this.result = null;

    if (init_mat !== undef) {
      this.m_stack[0] = init_mat;
    } else {
      this.setIdentity();
    }

    return this;
  };

  Transform.prototype.translate = function(x, y, z) {
    if (typeof(x) === 'object') {
      return this.translate(x[0], x[1], x[2]);
    }

    var m = this.getIdentity();

    m[12] = x;
    m[13] = y;
    m[14] = z;

    this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack], m);
    if (this.valid === this.c_stack && this.c_stack) {
      this.valid--;
    }

    return this;
  };


  Transform.prototype.scale = function(x, y, z) {
    if (typeof(x) === 'object') {
      return this.scale(x[0], x[1], x[2]);
    }


    var m = this.getIdentity();

    m[0] = x;
    m[5] = y;
    m[10] = z;

    this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack], m);
    if (this.valid === this.c_stack && this.c_stack) {
      this.valid--;
    }

    return this;
  };


  Transform.prototype.rotate = function(ang, x, y, z) {
    if (typeof(ang) === 'object') {
      this.rotate(ang[0], 1, 0, 0);
      this.rotate(ang[1], 0, 1, 0);
      this.rotate(ang[2], 0, 0, 1);
      return this;
    }

    var sAng, cAng;

    if (x || y || z) {
      sAng = Math.sin(-ang * (M_PI / 180.0));
      cAng = Math.cos(-ang * (M_PI / 180.0));
    }

    if (z) {
      var Z_ROT = this.getIdentity();

      Z_ROT[0] = cAng * z;
      Z_ROT[4] = sAng * z;
      Z_ROT[1] = -sAng * z;
      Z_ROT[5] = cAng * z;

      this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack], Z_ROT);
    }

    if (y) {
      var Y_ROT = this.getIdentity();

      Y_ROT[0] = cAng * y;
      Y_ROT[8] = -sAng * y;
      Y_ROT[2] = sAng * y;
      Y_ROT[10] = cAng * y;

      this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack], Y_ROT);
    }


    if (x) {
      var X_ROT = this.getIdentity();

      X_ROT[5] = cAng * x;
      X_ROT[9] = sAng * x;
      X_ROT[6] = -sAng * x;
      X_ROT[10] = cAng * x;

      this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack], X_ROT);
    }

    if (this.valid === this.c_stack && this.c_stack) {
      this.valid--;
    }

    return this;
  };

  /* Quaternions */

  function Quaternion() {
    if (arguments.length === 1) {
      this.x = arguments[0][0];
      this.y = arguments[0][1];
      this.z = arguments[0][2];
      this.w = arguments[0][3];
    }
    if (arguments.length === 4) {
      this.x = arguments[0];
      this.y = arguments[0];
      this.z = arguments[0];
      this.w = arguments[0];
    }
  }

  Quaternion.prototype.length = function() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  };

  Quaternion.prototype.normalize = function() {
    var n = Math.sqrt(this.length());
    this.x /= n;
    this.y /= n;
    this.z /= n;
    this.w /= n;
  };

  Quaternion.prototype.fromEuler = function(bank, heading, pitch) // x,y,z
  {
    var c1 = Math.cos((M_PI / 180.0) * heading / 2.0);
    var s1 = Math.sin((M_PI / 180.0) * heading / 2.0);
    var c2 = Math.cos((M_PI / 180.0) * pitch / 2.0);
    var s2 = Math.sin((M_PI / 180.0) * pitch / 2.0);
    var c3 = Math.cos((M_PI / 180.0) * bank / 2.0);
    var s3 = Math.sin((M_PI / 180.0) * bank / 2.0);
    var c1c2 = c1 * c2;
    var s1s2 = s1 * s2;

    this.w = c1c2 * c3 - s1s2 * s3;
    this.x = c1c2 * s3 + s1s2 * c3;
    this.y = s1 * c2 * c3 + c1 * s2 * s3;
    this.z = c1 * s2 * c3 - s1 * c2 * s3;
  };


  Quaternion.prototype.toEuler = function() {
    var sqw = this.w * this.w;
    var sqx = this.x * this.x;
    var sqy = this.y * this.y;
    var sqz = this.z * this.z;

    var x = (180 / M_PI) * ((Math.atan2(2.0 * (this.y * this.z + this.x * this.w), (-sqx - sqy + sqz + sqw))));
    var y = (180 / M_PI) * ((Math.asin(-2.0 * (this.x * this.z - this.y * this.w))));
    var z = (180 / M_PI) * ((Math.atan2(2.0 * (this.x * this.y + this.z * this.w), (sqx - sqy - sqz + sqw))));

    return [x, y, z];
  };

  Quaternion.prototype.multiply = function(q1, q2) {
    var selfSet = false;

    if (q2 === undef) {
      q2 = q1;
      q1 = this;
    }

    var x = q1.x * q2.w + q1.w * q2.x + q1.y * q2.z - q1.z * q2.y;
    var y = q1.y * q2.w + q1.w * q2.y + q1.z * q2.x - q1.x * q2.z;
    var z = q1.z * q2.w + q1.w * q2.z + q1.x * q2.y - q1.y * q2.x;
    var w = q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z;

    if (selfSet) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    } else {
      return new Quaternion(x, y, z, w);
    }
  };


  /* Faces */

  function Face() {
    this.points = [];
    this.point_normals = [];
    this.uvs = [];
    this.normal = [0, 0, 0];
    this.material = 0;
    this.segment = 0;
  }

  Face.prototype.setUV = function(uvs, point_num) {
    if (this.uvs === undef) {
      this.uvs = [];
    }

    if (point_num !== undef) {
      this.uvs[point_num] = uvs;
    } else {
      if (uvs.length !== 2) {
        this.uvs = uvs;
      } else {
        this.uvs.push(uvs);
      }
    }
  };

  Face.prototype.flip = function() {
    for (var i = 0, iMax = this.point_normals.length; i < iMax; i++) {
      this.point_normals[i] = [this.point_normals[i][0], this.point_normals[i][1], this.point_normals[i][2]];
    }

    this.points.reverse();
    this.point_normals.reverse();
    this.uvs.reverse();
    this.normal = [-this.normal[0], -this.normal[1], -this.normal[2]];
  };

  function Mesh(objName) {
    this.points = []; // point list
    this.faces = []; // faces with point references
    this.currentFace = -1; // start with no faces
    this.currentMaterial = 0; // null material
    this.currentSegment = 0; // default segment
    this.compiled = null; // VBO data
    this.bb = null;
    this.name = objName ? objName : null;
    this.hasUV = false;
    this.hasNorm = false;
  }

  Mesh.prototype.showAllSegments = function() {
    for (var i in this.segment_state) {
      if (this.segment_state.hasOwnProperty(i)) {
        this.segment_state[i] = true;
      }
    }
  };

  Mesh.prototype.hideAllSegments = function() {
    for (var i in this.segment_state) {
      if (this.segment_state.hasOwnProperty(i)) {
        this.segment_state[i] = false;
      }
    }
  };

  Mesh.prototype.setSegment = function(i, val) {
    if (val !== undef) {
      this.segment_state[i] = val;
    } else {
      this.currentSegment = i;
    }
  };

  Mesh.prototype.addPoint = function(p) {
    if (p.length !== 3 || typeof(p[0]) === 'object') {
      for (var i = 0, iMax = p.length; i < iMax; i++) {
        this.points.push(p[i]);
      }
    } else {
      this.points.push(p);
    }

    return this.points.length - 1;
  };

  Mesh.prototype.setFaceMaterial = function(mat) {
    this.currentMaterial = (typeof(mat) === 'object') ? mat.material_id : mat;
  };

  Mesh.prototype.addFace = function(p_list, face_num, face_mat, face_seg) {
    if (typeof(p_list[0]) !== 'number') {
      for (var i = 0, iMax = p_list.length; i < iMax; i++) {
        if (!p_list.hasOwnProperty(i)) {
          continue;
        }

        this.addFace(p_list[i]);
      }

      return;
    }

    if (face_num === undef) {
      this.currentFace = this.faces.length;
      this.faces.push(new Face());
    } else {
      if (this.faces[face_num] === undef) {
        this.faces[face_num] = new Face();
      }

      this.currentFace = face_num;
    }

    if (typeof(p_list) === 'object') {
      this.faces[this.currentFace].points = p_list;
    }

    if (face_mat !== undef) {
      this.faces[this.currentFace].material = (typeof(face_mat) === 'object') ? face_mat.material_id : face_mat;
    } else {
      this.faces[this.currentFace].material = this.currentMaterial;
    }

    if (face_seg !== undef) {
      this.faces[this.currentFace].segment = face_seg;
    } else {
      this.faces[this.currentFace].segment = this.currentSegment;
    }


    return this.currentFace;
  };


  Mesh.prototype.triangulateQuads = function() {
    for (var i = 0, iMax = this.faces.length; i < iMax; i++) {
      if (this.faces[i].points.length === 4) {
        var p = this.faces.length;

        this.addFace([this.faces[i].points[2], this.faces[i].points[3], this.faces[i].points[0]], this.faces.length, this.faces[i].material, this.faces[i].segment);
        this.faces[i].points.pop();
        this.faces[p].normal = this.faces[i].normal;

        if (this.faces[i].uvs !== undef) {
          if (this.faces[i].uvs.length === 4) {
            this.faces[p].setUV(this.faces[i].uvs[2], 0);
            this.faces[p].setUV(this.faces[i].uvs[3], 1);
            this.faces[p].setUV(this.faces[i].uvs[0], 2);

            this.faces[i].uvs.pop();
          }
        }

        if (this.faces[i].point_normals.length === 4) {
          this.faces[p].point_normals[0] = this.faces[i].point_normals[2];
          this.faces[p].point_normals[1] = this.faces[i].point_normals[3];
          this.faces[p].point_normals[2] = this.faces[i].point_normals[0];

          this.faces[i].point_normals.pop();
        }

      }
    }
  };


  Mesh.prototype.booleanAdd = function(objAdd, transform) {
    var pofs = this.points.length;
    var fofs = this.faces.length;

    var i, j, iMax, jMax;

    if (transform !== undef) {
      var m = transform.getResult();
      for (i = 0, iMax = objAdd.points.length; i < iMax; i++) {
        this.addPoint(mat4.vec3_multiply(objAdd.points[i], m));
      }
    } else {
      for (i = 0, iMax = objAdd.points.length; i < iMax; i++) {
        this.addPoint([objAdd.points[i][0], objAdd.points[i][1], objAdd.points[i][2]]);
      }
    }

    for (i = 0, iMax = objAdd.faces.length; i < iMax; i++) {
      var newFace = [];

      for (j = 0, jMax = objAdd.faces[i].points.length; j < jMax; j++) {
        newFace.push(objAdd.faces[i].points[j] + pofs);
      }

      var nFaceNum = this.addFace(newFace);
      var nFace = this.faces[nFaceNum];

     nFace.segment = objAdd.faces[i].segment;
     nFace.material = objAdd.faces[i].material;

      for (j = 0, jMax = objAdd.faces[i].uvs.length; j < jMax; j++) {
        nFace.uvs[j] = [objAdd.faces[i].uvs[j][0], objAdd.faces[i].uvs[j][1]];
      }

      for (j = 0, jMax = objAdd.faces[i].point_normals.length; j < jMax; j++) {
        nFace.point_normals[j] = [objAdd.faces[i].point_normals[j][0], objAdd.faces[i].point_normals[j][1], objAdd.faces[i].point_normals[j][2]];
      }
    }
  };

  Mesh.prototype.calcFaceNormals = function() {
    for (var i = 0, iMax = this.faces.length; i < iMax; i++) {
      if (this.faces[i].points.length < 3) {
        this.faces[i].normal = [0, 0, 0];
        continue;
      }

      this.faces[i].normal = vec3.normalize(triangle.normal(this.points[this.faces[i].points[0]], this.points[this.faces[i].points[1]], this.points[this.faces[i].points[2]]));
    }
  };


  Mesh.prototype.getMaterial = function(m_name) {
    for (var i in this.compiled.elements) {
      if (this.compiled.elements.hasOwnProperty(i)) {
        if (Materials[i].name === m_name) { 
          return Materials[i];
        }
      }
    }

    return null;
  };


  Mesh.prototype.calcNormals = function() {
    this.calcFaceNormals();

    var i, j, k, iMax;

    var point_smoothRef = new Array(this.points.length);
    for (i = 0, iMax = point_smoothRef.length; i < iMax; i++) {
      point_smoothRef[i] = [];
    }

    var numFaces = this.faces.length;

    // build a quick list of point/face sharing
    for (i = 0; i < numFaces; i++) {
      var numFacePoints = this.faces[i].points.length;

      for (j = 0; j < numFacePoints; j++) {
        var idx = this.faces[i].points[j];

        //      if (point_smoothRef[idx] === undef) point_smoothRef[idx] = [];
        point_smoothRef[idx].push([i, j]);
      }
    }


    // step through smoothing references and compute normals
    for (i = 0, iMax = this.points.length; i < iMax; i++) {
      //    if(!point_smoothRef.hasOwnProperty(i)) { continue; }
      //    if (typeof(point_smoothRef[i]) === undef) { continue; }
      var numPts = point_smoothRef[i].length;

      for (j = 0; j < numPts; j++) {
        var ptCount = 1;
        var faceNum = point_smoothRef[i][j][0];
        var pointNum = point_smoothRef[i][j][1];
        var max_smooth = Materials[this.faces[faceNum].material].max_smooth;
        var thisFace = this.faces[faceNum];

        // set point to it's face's normal
        var tmpNorm = new Array(3);

        tmpNorm[0] = thisFace.normal[0];
        tmpNorm[1] = thisFace.normal[1];
        tmpNorm[2] = thisFace.normal[2];

        // step through all other faces which share this point
        if (max_smooth !== 0) {
          for (k = 0; k < numPts; k++) {
            if (j === k) {
              continue;
            }
            var faceRefNum = point_smoothRef[i][k][0];
            var thisFaceRef = this.faces[faceRefNum];

            var ang = vec3.angle(thisFaceRef.normal, thisFace.normal);

            if ((ang !== ang) || ((ang * (180.0 / M_PI)) <= max_smooth)) {
              tmpNorm[0] += thisFaceRef.normal[0];
              tmpNorm[1] += thisFaceRef.normal[1];
              tmpNorm[2] += thisFaceRef.normal[2];

              ptCount++;
            }
          }
        }

        tmpNorm[0] /= ptCount;
        tmpNorm[1] /= ptCount;
        tmpNorm[2] /= ptCount;

        this.faces[faceNum].point_normals[pointNum] = vec3.normalize(tmpNorm);
      }
    }
  };

  Mesh.prototype.compile = function() {
    this.compiled = {};

    this.bb = [];

    var compileRef = [];

    var i, j, k, x, y, iMax, kMax, yMax;

    for (i = 0, iMax = this.faces.length; i < iMax; i++) {
      if (this.faces[i].points.length === 3) {
        var matId = this.faces[i].material;
        var segId = this.faces[i].segment;

        if (compileRef[matId] === undef) {
          compileRef[matId] = [];
        }
        if (compileRef[matId][segId] === undef) {
          compileRef[matId][segId] = [];
        }

        compileRef[matId][segId].push(i);
      }
    }

    var vtxRef = [];

    this.compiled.vbo_normals = [];
    this.compiled.vbo_points = [];
    this.compiled.vbo_uvs = [];

    var idxCount = 0;
    var hasUV = false;
    var hasNorm = false;
    var faceNum;

    for (i in compileRef) {
      if (compileRef.hasOwnProperty(i)) {
        for (j in compileRef[i]) {
          if (compileRef[i].hasOwnProperty(j)) {
            for (k = 0; k < compileRef[i][j].length; k++) {
              faceNum = compileRef[i][j][k];
              hasUV = hasUV || (this.faces[faceNum].uvs.length !== 0);
              hasNorm = hasNorm || (this.faces[faceNum].point_normals.length !== 0);
            }
          }
        }
      }
    }

    if (hasUV) {
      for (i = 0; i < this.faces.length; i++) {
        if (!this.faces[i].uvs.length) {
          for (j = 0; j < this.faces[i].points.length; j++) {
            this.faces[i].uvs.push([0, 0]);
          }
        }
      }
    }

    if (hasNorm) {
      for (i = 0; i < this.faces.length; i++) {
        if (!this.faces[i].point_normals.length) {
          for (j = 0; j < this.faces[i].points.length; j++) {
            this.faces[i].point_normals.push([0, 0, 0]);
          }
        }
      }
    }

    this.hasUV = hasUV;
    this.hasNorm = hasNorm;

    var pVisitor = [];

    for (i in compileRef) {
      if (compileRef.hasOwnProperty(i)) {
        for (j in compileRef[i]) {
          if (compileRef[i].hasOwnProperty(j)) {
            for (k = 0, kMax = compileRef[i][j].length; k < kMax; k++) {
              faceNum = compileRef[i][j][k];
              var found = false;

              for (x = 0; x < 3; x++) {
                var ptNum = this.faces[faceNum].points[x];

                var foundPt = -1;

                if (vtxRef[ptNum] !== undef) {
                  for (y = 0, yMax = vtxRef[ptNum].length; y < yMax; y++) {
                    // face / point
                    var oFace = vtxRef[ptNum][y][0]; // faceNum
                    var oPoint = vtxRef[ptNum][y][1]; // pointNum
                    var oIndex = vtxRef[ptNum][y][2]; // index
                    foundPt = oIndex;

                    if (hasNorm) {
                      foundPt = (vec3.equal(
                      this.faces[oFace].point_normals[oPoint], this.faces[faceNum].point_normals[x])) ? foundPt : -1;
                    }

                    if (hasUV) {
                      foundPt = (vec2.equal(
                      this.faces[oFace].uvs[oPoint], this.faces[faceNum].uvs[x])) ? foundPt : -1;
                    }
                  }
                }

                if (foundPt !== -1) {
                  if (this.compiled.elements === undef) {
                    this.compiled.elements = [];
                  }
                  if (this.compiled.elements[i] === undef) {
                    this.compiled.elements[i] = [];
                  }
                  if (this.compiled.elements[i][j] === undef) {
                    this.compiled.elements[i][j] = [];
                  }
                  this.compiled.elements[i][j].push(foundPt);
                } else {
                  this.compiled.vbo_points.push(this.points[ptNum][0]);
                  this.compiled.vbo_points.push(this.points[ptNum][1]);
                  this.compiled.vbo_points.push(this.points[ptNum][2]);

                  if (this.bb.length === 0) {
                    this.bb[0] = [this.points[ptNum][0],
                                                          this.points[ptNum][1],
                                                          this.points[ptNum][2]];

                    this.bb[1] = [this.points[ptNum][0],
                                                          this.points[ptNum][1],
                                                          this.points[ptNum][2]];
                  } else {
                    if (this.points[ptNum][0] < this.bb[0][0]) {
                      this.bb[0][0] = this.points[ptNum][0];
                    }
                    if (this.points[ptNum][1] < this.bb[0][1]) {
                      this.bb[0][1] = this.points[ptNum][1];
                    }
                    if (this.points[ptNum][2] < this.bb[0][2]) {
                      this.bb[0][2] = this.points[ptNum][2];
                    }

                    if (this.points[ptNum][0] > this.bb[1][0]) {
                      this.bb[1][0] = this.points[ptNum][0];
                    }
                    if (this.points[ptNum][1] > this.bb[1][1]) {
                      this.bb[1][1] = this.points[ptNum][1];
                    }
                    if (this.points[ptNum][2] > this.bb[1][2]) {
                      this.bb[1][2] = this.points[ptNum][2];
                    }
                  }

                  if (hasNorm) {
                    this.compiled.vbo_normals.push(this.faces[faceNum].point_normals[x][0]);
                    this.compiled.vbo_normals.push(this.faces[faceNum].point_normals[x][1]);
                    this.compiled.vbo_normals.push(this.faces[faceNum].point_normals[x][2]);
                  }

                  if (hasUV) {
                    this.compiled.vbo_uvs.push(this.faces[faceNum].uvs[x][0]);
                    this.compiled.vbo_uvs.push(this.faces[faceNum].uvs[x][1]);
                  }

                  if (this.compiled.elements === undef) {
                    this.compiled.elements = [];
                  }
                  if (this.compiled.elements[i] === undef) {
                    this.compiled.elements[i] = [];
                  }
                  if (this.compiled.elements[i][j] === undef) {
                    this.compiled.elements[i][j] = [];
                  }

                  this.compiled.elements[i][j].push(idxCount);

                  if (vtxRef[ptNum] === undef) {
                    vtxRef[ptNum] = [];
                  }

                  vtxRef[ptNum].push([faceNum, x, idxCount]);
                  idxCount++;
                }
              }
            }
          }
        }
      }
    }

    this.compiled.gl_points = GLCore.gl.createBuffer();
    GLCore.gl.bindBuffer(GLCore.gl.ARRAY_BUFFER, this.compiled.gl_points);
    GLCore.gl.bufferData(GLCore.gl.ARRAY_BUFFER, new Float32Array(this.compiled.vbo_points), GLCore.gl.STATIC_DRAW);

    if (hasNorm) {
      this.compiled.gl_normals = GLCore.gl.createBuffer();
      GLCore.gl.bindBuffer(GLCore.gl.ARRAY_BUFFER, this.compiled.gl_normals);
      GLCore.gl.bufferData(GLCore.gl.ARRAY_BUFFER, new Float32Array(this.compiled.vbo_normals), GLCore.gl.STATIC_DRAW);
    }
    else
    {
      this.compiled.gl_normals = null;
    }

    if (hasUV) {
      this.compiled.gl_uvs = GLCore.gl.createBuffer();
      GLCore.gl.bindBuffer(GLCore.gl.ARRAY_BUFFER, this.compiled.gl_uvs);
      GLCore.gl.bufferData(GLCore.gl.ARRAY_BUFFER, new Float32Array(this.compiled.vbo_uvs), GLCore.gl.STATIC_DRAW);
    }
    else
    {
      this.compiled.gl_uvs = null;
    }

    var gl_elements = [];

    this.segment_state = [];
    this.compiled.elements_ref = [];

    var ictr = 0;

    for (i in this.compiled.elements) {
      if (this.compiled.elements.hasOwnProperty(i)) {
        this.compiled.elements_ref[ictr] = [];

        var jctr = 0;

        for (j in this.compiled.elements[i]) {
          if (this.compiled.elements[i].hasOwnProperty(j)) {
            for (k in this.compiled.elements[i][j]) {
              if (this.compiled.elements[i][j].hasOwnProperty(k)) {
                gl_elements.push(this.compiled.elements[i][j][k]);
              }
            }

            this.segment_state[j] = true;

            this.compiled.elements_ref[ictr][jctr] = [i, j, this.compiled.elements[i][j].length];

            jctr++;
          }
        }
        ictr++;
      }
    }

    this.compiled.gl_elements = GLCore.gl.createBuffer();
    GLCore.gl.bindBuffer(GLCore.gl.ELEMENT_ARRAY_BUFFER, this.compiled.gl_elements);
    GLCore.gl.bufferData(GLCore.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(gl_elements), GLCore.gl.STATIC_DRAW);

    // dump temporary buffers
    this.compiled.vbo_normals = null;
    this.compiled.vbo_points = null;
    this.compiled.vbo_uvs = null;

    GLCore.gl.bindBuffer(GLCore.gl.ELEMENT_ARRAY_BUFFER, null);
  };



  function UVMapper() {
    this.rotation = [0, 0, 0];
    this.scale = [1, 1, 1];
    this.center = [0, 0, 0];
    this.projection_mode = enums.uv.projection.PLANAR;
    this.projection_axis = enums.uv.axis.X;
    this.wrap_w_count = 1;
    this.wrap_h_count = 1;
  }

  // convert XYZ space to longitude
  var xyz_to_h = function(x, y, z) {
    var h;

    if (x === 0 && z === 0) {
      h = 0;
    } else {
      if (z === 0) {
        h = (x < 0) ? M_HALF_PI : -M_HALF_PI;
      } else if (z < 0) {
        h = -Math.atan(x / z) + M_PI;
      } else {
        h = -Math.atan(x / z);
      }
    }

    return h;
  };


  // convert XYZ space to latitude and longitude
  var xyz_to_hp = function(x, y, z) {
    var h, p;

    if (x === 0 && z === 0) {
      h = 0;

      if (y !== 0) {
        p = (y < 0) ? -M_HALF_PI : M_HALF_PI;
      } else {
        p = 0;
      }
    } else {
      if (z === 0) {
        h = (x < 0) ? M_HALF_PI : -M_HALF_PI;
      } else if (z < 0) {
        h = -Math.atan(x / z) + M_PI;
      } else {
        h = -Math.atan(x / z);
      }

      x = Math.sqrt(x * x + z * z);

      if (x === 0) {
        p = (y < 0) ? -M_HALF_PI : M_HALF_PI;
      } else {
        p = Math.atan(y / x);
      }
    }

    return [h, p];
  };


  UVMapper.prototype.apply = function(obj, mat_num, seg_num) {
    var u, v, s, t, lat, lon;

    var trans = new Transform();
    var transformed = false;
    var t_result = null;

    if (this.center[0] || this.center[1] || this.center[2]) {
      trans.translate(-this.center[0], -this.center[1], -this.center[2]);
      transformed = true;
    }

    if (this.rotation[0] || this.rotation[1] || this.rotation[2]) {
      if (this.rotation[0]) {
        trans.rotate(this.rotation[2], 0, 0, 1);
      }
      if (this.rotation[1]) {
        trans.rotate(this.rotation[1], 0, 1, 0);
      }
      if (this.rotation[2]) {
        trans.rotate(this.rotation[0], 1, 0, 0);
      }
      transformed = true;
    }

    if (transformed) {
      t_result = trans.getResult();
    }

    if (typeof(mat_num) === 'object') {
      mat_num = mat_num.material_id;
    }

    for (var i = 0, iMax = obj.faces.length; i < iMax; i++) {
      if (obj.faces[i].material !== mat_num) {
        continue;
      }
      if (seg_num !== undef) {
        if (obj.faces[i].segment !== seg_num) {
          continue;
        }
      }

      var nx, ny, nz;

      if (this.projection_mode === enums.uv.projection.CUBIC || this.projection_mode === enums.uv.projection.SKY) {
        nx = Math.abs(obj.faces[i].normal[0]);
        ny = Math.abs(obj.faces[i].normal[1]);
        nz = Math.abs(obj.faces[i].normal[2]);
      }

      for (var j = 0, jMax = obj.faces[i].points.length; j < jMax; j++) {
        var uvpoint = obj.points[obj.faces[i].points[j]];

        if (transformed) {
          uvpoint = mat4.vec3_multiply(uvpoint, t_result);
        }

        /* calculate the uv for the points referenced by this face's pointref vector */
        switch (this.projection_mode) {
        case enums.uv.projection.SKY:
          var mapping = obj.sky_mapping;
          /* see enums.uv.projection.CUBIC for normalization reasoning */
          if (nx >= ny && nx >= nz) {
            s = uvpoint[2] / (this.scale[2]) + this.scale[2] / 2;
            t = -uvpoint[1] / (this.scale[1]) + this.scale[1] / 2;
            if (obj.faces[i].normal[0] < 0) {
              //left
              s = (mapping[2][2] - mapping[2][0]) * (1-s);
              t = 1-((mapping[2][3] - mapping[2][1]) * (t));
              s += mapping[2][0];
              t += mapping[2][1];
            }
            else {
              //right
              s = (mapping[3][2] - mapping[3][0]) * (s);
              t = 1-((mapping[3][3] - mapping[3][1]) * (t));
              s += mapping[3][0];
              t += mapping[3][1];
            } //if
          } //if
          if (ny >= nx && ny >= nz) {
            s = uvpoint[0] / (this.scale[0]) + this.scale[0] / 2;
            t = -uvpoint[2] / (this.scale[2]) + this.scale[2] / 2;
            if (obj.faces[i].normal[1] < 0) {
              //down
              s = ((mapping[1][2] - mapping[1][0]) * (s));
              t = 1-((mapping[1][3] - mapping[1][1]) * (t));
              s += mapping[1][0];
              t -= mapping[1][1];
            }
            else {
              //up
              s = ((mapping[0][2] - mapping[0][0]) * (s));
              t = 1-((mapping[0][3] - mapping[0][1]) * (t));
              s += mapping[0][0];
              t -= mapping[0][1];
            } //if
          } //if
          if (nz >= nx && nz >= ny) {
            s = uvpoint[0] / (this.scale[0]) + this.scale[0] / 2;
            t = uvpoint[1] / (this.scale[1]) + this.scale[1] / 2;
            if (obj.faces[i].normal[2] < 0) {
              //front
              s = ((mapping[4][2] - mapping[4][0]) * (s));
              t = 1-((mapping[4][3] - mapping[4][1]) * (1-t));
              s += mapping[4][0];
              t -= mapping[4][1];
            }
            else {
              //back
              s = ((mapping[5][2] - mapping[5][0]) * (1-s));
              t = 1-((mapping[5][3] - mapping[5][1]) * (1-t));
              s += mapping[5][0];
              t += mapping[5][1];
            } //if
          } //if
          obj.faces[i].setUV([s, t], j);
          break;

        case enums.uv.projection.CUBIC:
          /* cubic projection needs to know the surface normal */
          /* x portion of vector is dominant, we're mapping in the Y/Z plane */
          if (nx >= ny && nx >= nz) {
            /* we use a .5 offset because texture coordinates range from 0->1, so to center it we need to offset by .5 */
            s = uvpoint[2] / this.scale[2] + 0.5;
            /* account for scale here */
            t = uvpoint[1] / this.scale[1] + 0.5;
          }

          /* y portion of vector is dominant, we're mapping in the X/Z plane */
          if (ny >= nx && ny >= nz) {

            s = -uvpoint[0] / this.scale[0] + 0.5;
            t = uvpoint[2] / this.scale[2] + 0.5;
          }

          /* z portion of vector is dominant, we're mapping in the X/Y plane */
          if (nz >= nx && nz >= ny) {
            s = -uvpoint[0] / this.scale[0] + 0.5;
            t = uvpoint[1] / this.scale[1] + 0.5;
          }

          if (obj.faces[i].normal[0] > 0) {
            s = -s;
          }
          if (obj.faces[i].normal[1] < 0) {
            s = -s;
          }
          if (obj.faces[i].normal[2] > 0) {
            s = -s;
          }

          obj.faces[i].setUV([s, t], j);
          break;

        case enums.uv.projection.PLANAR:
          s = ((this.projection_axis === enums.uv.axis.X) ? uvpoint[2] / this.scale[2] + 0.5 : -uvpoint[0] / this.scale[0] + 0.5);
          t = ((this.projection_axis === enums.uv.axis.Y) ? uvpoint[2] / this.scale[2] + 0.5 : uvpoint[1] / this.scale[1] + 0.5);

          obj.faces[i].setUV([s, t], j);
          break;

        case enums.uv.projection.CYLINDRICAL:
          // Cylindrical is a little more tricky, we map based on the degree around the center point
          switch (this.projection_axis) {
          case enums.uv.axis.X:
            // xyz_to_h takes the point and returns a value representing the 'unwrapped' height position of this point
            lon = xyz_to_h(uvpoint[2], uvpoint[0], -uvpoint[1]);
            t = -uvpoint[0] / this.scale[0] + 0.5;
            break;

          case enums.uv.axis.Y:
            lon = xyz_to_h(-uvpoint[0], uvpoint[1], uvpoint[2]);
            t = -uvpoint[1] / this.scale[1] + 0.5;
            break;

          case enums.uv.axis.Z:
            lon = xyz_to_h(-uvpoint[0], uvpoint[2], -uvpoint[1]);
            t = -uvpoint[2] / this.scale[2] + 0.5;
            break;
          }

          // convert it from radian space to texture space 0 to 1 * wrap, TWO_PI = 360 degrees
          lon = 1.0 - lon / (M_TWO_PI);

          if (this.wrap_w_count !== 1.0) {
            lon = lon * this.wrap_w_count;
          }

          u = lon;
          v = t;

          obj.faces[i].setUV([u, v], j);
          break;

        case enums.uv.projection.SPHERICAL:
          var latlon;

          // spherical is similar to cylindrical except we also unwrap the 'width'
          switch (this.projection_axis) {
          case enums.uv.axis.X:
            // xyz to hp takes the point value and 'unwraps' the latitude and longitude that projects to that point
            latlon = xyz_to_hp(uvpoint[2], uvpoint[0], -uvpoint[1]);
            break;
          case enums.uv.axis.Y:
            latlon = xyz_to_hp(uvpoint[0], -uvpoint[1], uvpoint[2]);
            break;
          case enums.uv.axis.Z:
            latlon = xyz_to_hp(-uvpoint[0], uvpoint[2], -uvpoint[1]);
            break;
          }

          // convert longitude and latitude to texture space coordinates, multiply by wrap height and width
          lon = 1.0 - latlon[0] / M_TWO_PI;
          lat = 0.5 - latlon[1] / M_PI;

          if (this.wrap_w_count !== 1.0) {
            lon = lon * this.wrap_w_count;
          }
          if (this.wrap_h_count !== 1.0) {
            lat = lat * this.wrap_h_count;
          }

          u = lon;
          v = lat;

          obj.faces[i].setUV([u, v], j);
          break;

          // case enums.uv.projection.UV:
          //   // not handled here..
          // break;
        default:
          // else mapping cannot be handled here, this shouldn't have happened :P
          u = 0;
          v = 0;
          obj.faces[i].setUV([u, v], j);
          break;
        }
      }
    }
  };

  function AABB_size(aabb) {
    var x = aabb[0][0] < aabb[1][0] ? aabb[1][0] - aabb[0][0] : aabb[0][0] - aabb[1][0];
    var y = aabb[0][1] < aabb[1][1] ? aabb[1][1] - aabb[0][1] : aabb[0][1] - aabb[1][1];
    var z = aabb[0][2] < aabb[1][2] ? aabb[1][2] - aabb[0][2] : aabb[0][2] - aabb[1][2];
    return [x,y,z];
  } //AABB_size
  function AABB_reset(aabb, point) {
    if (point === undefined) {
      point = [0,0,0];
    } //if
    aabb[0][0] = point[0];
    aabb[0][1] = point[1];
    aabb[0][2] = point[2];
    aabb[1][0] = point[0];
    aabb[1][1] = point[1];
    aabb[1][2] = point[2];
  } //AABB_reset
  function AABB_engulf(aabb, point) {
    if (aabb[0][0] > point[0]) {
      aabb[0][0] = point[0];
    }
    if (aabb[0][1] > point[1]) {
      aabb[0][1] = point[1];
    }
    if (aabb[0][2] > point[2]) {
      aabb[0][2] = point[2];
    }
    if (aabb[1][0] < point[0]) {
      aabb[1][0] = point[0];
    }
    if (aabb[1][1] < point[1]) {
      aabb[1][1] = point[1];
    }
    if (aabb[1][2] < point[2]) {
      aabb[1][2] = point[2];
    }
  } //AABB::engulf


/* Lights */

function Light(light_type, lighting_method) {
  if (light_type === undef) {
    light_type = enums.light.type.POINT;
  }
  if (lighting_method === undef) {
    lighting_method = enums.light.method.DYNAMIC;
  }
  this.trans = new Transform();
  this.lposition = [0, 0, 0];
  this.tMatrix = this.trans.getResult();
  this.dirty = true;
  this.light_type = light_type;
  this.diffuse = [1, 1, 1];
  this.specular = [0.1, 0.1, 0.1];
  this.intensity = 1.0;
  this.position = [0, 0, 0];
  this.direction = [0, 0, 0];
  this.distance = 10;
  this.method = lighting_method;
  this.octree_leaves = [];
  this.octree_common_root = null;
  this.octree_aabb = [[0, 0, 0], [0, 0, 0]];
  this.ignore_octree = false;
  this.visible = true;
  this.culled = true;
  this.was_culled = true;
  this.aabb = [[0,0,0],[0,0,0]];
  AABB_reset(this.aabb, this.position);
  this.adjust_octree = SceneObject.prototype.adjust_octree;
}

Light.prototype.doTransform = function(mat) {
  if (!vec3.equal(this.lposition, this.position) || (mat !== undef)) {
    this.trans.clearStack();
    this.trans.translate(this.position);
    if ((mat !== undef)) {
      this.trans.pushMatrix(mat);
    }
    this.tMatrix = this.trans.getResult();
    this.lposition[0] = this.position[0];
    this.lposition[1] = this.position[1];
    this.lposition[2] = this.position[2];
    this.dirty = true;
    this.adjust_octree();
  } //if
} //Light::doTransform

Light.prototype.getAABB = function() {
  var aabb = [[0, 0, 0], [0, 0, 0]];
  AABB_engulf(aabb, [this.distance, this.distance, this.distance]);
  AABB_engulf(aabb, [-this.distance, -this.distance, -this.distance]);
  aabb[0] = vec3.add(aabb[0], this.position);
  aabb[1] = vec3.add(aabb[1], this.position);
  this.aabb = aabb;
  return this.aabb;
};

Light.prototype.setDirection = function(x, y, z) {
  if (typeof(x) === 'object') {
    this.setDirection(x[0], x[1], x[2]);
    return;
  }


  this.direction = vec3.normalize([x, y, z]);
};

Light.prototype.setRotation = function(x, y, z) {
  if (typeof(x) === 'object') {
    this.setRotation(x[0], x[1], x[2]);
    return;
  }

  var t = new Transform();
  t.rotate([-x, -y, -z]);
  t.pushMatrix();

  this.direction = vec3.normalize(mat4.vec3_multiply([1, 0, 0], t.getResult()));
};


Light.prototype.setupShader = function(lShader) {
  lShader.setVector("lDiff", this.diffuse);
  lShader.setVector("lSpec", this.specular);
  lShader.setFloat("lInt", this.intensity);
  lShader.setFloat("lDist", this.distance);
  lShader.setVector("lPos", this.position);
  lShader.setVector("lDir", this.direction);
};

var emptyLight = new Light(enums.light.type.POINT);
emptyLight.diffuse = [0, 0, 0];
emptyLight.specular = [0, 0, 0];
emptyLight.distance = 0;
emptyLight.intensity = 0;

/* Shaders */

function Shader(vs_id, fs_id) {
  var vertexShader;
  var fragmentShader;
  var loadedShader;

  this.uniforms = [];
  this.uniform_type = [];
  this.uniform_typelist = [];

  if (vs_id.indexOf("\n") !== -1) {
    vertexShader = cubicvr_compileShader(GLCore.gl, vs_id, "x-shader/x-vertex");
  } else {
    vertexShader = cubicvr_getShader(GLCore.gl, vs_id);

    if (vertexShader === null) {
      loadedShader = util.getURL(vs_id);

      vertexShader = cubicvr_compileShader(GLCore.gl, loadedShader, "x-shader/x-vertex");
    }
  }

  if (fs_id.indexOf("\n") !== -1) {
    fragmentShader = cubicvr_compileShader(GLCore.gl, fs_id, "x-shader/x-fragment");
  } else {
    fragmentShader = cubicvr_getShader(GLCore.gl, fs_id);

    if (fragmentShader === null) {
      loadedShader = util.getURL(fs_id);

      fragmentShader = cubicvr_compileShader(GLCore.gl, loadedShader, "x-shader/x-fragment");
    }

  }


  this.shader = GLCore.gl.createProgram();
  GLCore.gl.attachShader(this.shader, vertexShader);
  GLCore.gl.attachShader(this.shader, fragmentShader);
  GLCore.gl.linkProgram(this.shader);

  if (!GLCore.gl.getProgramParameter(this.shader, GLCore.gl.LINK_STATUS)) {
    alert("Could not initialise shader vert(" + vs_id + "), frag(" + fs_id + ")");
    return;
  }
}

Shader.prototype.addMatrix = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = enums.shader.uniform.MATRIX;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

Shader.prototype.addVector = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = enums.shader.uniform.VECTOR;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

Shader.prototype.addFloat = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = enums.shader.uniform.FLOAT;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};


Shader.prototype.addVertexArray = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = GLCore.gl.getAttribLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = enums.shader.uniform.ARRAY_VERTEX;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

Shader.prototype.addUVArray = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = GLCore.gl.getAttribLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = enums.shader.uniform.ARRAY_UV;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

Shader.prototype.addFloatArray = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = GLCore.gl.getAttribLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = enums.shader.uniform.ARRAY_FLOAT;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

Shader.prototype.addInt = function(uniform_id, default_val) {
  this.use();
  this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = enums.shader.uniform.INT;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

  if (default_val !== undef) {
    this.setInt(uniform_id, default_val);
  }
};



Shader.prototype.use = function() {
  GLCore.gl.useProgram(this.shader);
};

Shader.prototype.init = function(istate) {
  if (istate === undef) {
    istate = true;
  }
  
  var u;
  var typeList;

  for (var i = 0, imax = this.uniform_typelist.length; i < imax; i++) {
    typeList = this.uniform_typelist[i][1];
    if (typeList === enums.shader.uniform.ARRAY_VERTEX || typeList === enums.shader.uniform.ARRAY || typeList === enums.shader.uniform.ARRAY_UV || typeList === enums.shader.uniform.ARRAY_FLOAT) {
      u = this.uniform_typelist[i][0];
      
      if (u !== -1) {
        if (istate) {
          GLCore.gl.enableVertexAttribArray(u);
        } else {
          GLCore.gl.disableVertexAttribArray(u);
        }
      }
    }
    /*
    switch (this.uniform_typelist[i][1]) {
      // case enums.shader.uniform.MATRIX:
      //
      // break;
      // case enums.shader.uniform.VECTOR:
      //
      // break;
      // case enums.shader.uniform.FLOAT:
      //
      // break;
    case enums.shader.uniform.ARRAY_VERTEX:
    case enums.shader.uniform.ARRAY_UV:
    case enums.shader.uniform.ARRAY_FLOAT:
      u = this.uniform_typelist[i][0];
      
      if (u !== -1) {
        if (istate) {
          GLCore.gl.enableVertexAttribArray(u);
        } else {
          GLCore.gl.disableVertexAttribArray(u);
        }
      }
      break;
    }
    */
  }
};

Shader.prototype.setMatrix = function(uniform_id, mat) {
  var u = this.uniforms[uniform_id];
  if (u === null) {
    return;
  }
  GLCore.gl.uniformMatrix4fv(u, false, new Float32Array(mat));
};

Shader.prototype.setInt = function(uniform_id, val) {
  var u = this.uniforms[uniform_id];
  if (u === null) {
    return;
  }
  GLCore.gl.uniform1i(u, val);
};

Shader.prototype.setFloat = function(uniform_id, val) {
  var u = this.uniforms[uniform_id];
  if (u === null) {
    return;
  }
  GLCore.gl.uniform1f(u, val);
};

Shader.prototype.setVector = function(uniform_id, val) {
  var u = this.uniforms[uniform_id];
  if (u === null) {
    return;
  }

  GLCore.gl.uniform3fv(u, val);
};


Shader.prototype.setArray = function(uniform_id, buf) {
  switch (this.uniform_type[uniform_id]) {
  case enums.shader.uniform.ARRAY_VERTEX:
    GLCore.gl.bindBuffer(GLCore.gl.ARRAY_BUFFER, buf);
    GLCore.gl.vertexAttribPointer(this.uniforms[uniform_id], 3, GLCore.gl.FLOAT, false, 0, 0);
    break;
  case enums.shader.uniform.ARRAY_UV:
    GLCore.gl.bindBuffer(GLCore.gl.ARRAY_BUFFER, buf);
    GLCore.gl.vertexAttribPointer(this.uniforms[uniform_id], 2, GLCore.gl.FLOAT, false, 0, 0);
    break;
  case enums.shader.uniform.ARRAY_FLOAT:
    GLCore.gl.bindBuffer(GLCore.gl.ARRAY_BUFFER, buf);
    GLCore.gl.vertexAttribPointer(this.uniforms[uniform_id], 1, GLCore.gl.FLOAT, false, 0, 0);
    break;
  }

};


/* Materials */

var Material = function(mat_name) {
  if (mat_name !== undef) {
    Material_ref[mat_name] = this;
  }

  this.material_id = Materials.length;
  Materials.push(this);

  this.diffuse = [1.0, 1.0, 1.0];
  this.specular = [0.5, 0.5, 0.5];
  this.color = [1, 1, 1];
  this.ambient = [0, 0, 0];
  this.opacity = 1.0;
  this.shininess = 1.0;
  this.max_smooth = 60.0;
  this.initialized = false;
  this.textures = [];
  this.shader = [];
  this.customShader = null;
  this.name = mat_name;
};

Material.prototype.setTexture = function(tex, tex_type) {
  if (tex_type === undef) {
    tex_type = 0;
  }

  this.textures[tex_type] = tex;
};



Material.prototype.calcShaderMask = function() {
  var shader_mask = 0;

  shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.COLOR]) === 'object') ? enums.shader.map.COLOR : 0);
  shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.SPECULAR]) === 'object') ? enums.shader.map.SPECULAR : 0);
  shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.NORMAL]) === 'object') ? enums.shader.map.NORMAL : 0);
  shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.BUMP]) === 'object') ? enums.shader.map.BUMP : 0);
  shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.REFLECT]) === 'object') ? enums.shader.map.REFLECT : 0);
  shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.ENVSPHERE]) === 'object') ? enums.shader.map.ENVSPHERE : 0);
  shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.AMBIENT]) === 'object') ? enums.shader.map.AMBIENT : 0);
  shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.ALPHA]) === 'object') ? enums.shader.map.ALPHA : 0);
  shader_mask = shader_mask + ((this.opacity !== 1.0) ? enums.shader.map.ALPHA : 0);

  return shader_mask;
};


Material.prototype.getShaderHeader = function(light_type) {
  return "#define hasColorMap " + ((typeof(this.textures[enums.texture.map.COLOR]) === 'object') ? 1 : 0) + "\n#define hasSpecularMap " + ((typeof(this.textures[enums.texture.map.SPECULAR]) === 'object') ? 1 : 0) + "\n#define hasNormalMap " + ((typeof(this.textures[enums.texture.map.NORMAL]) === 'object') ? 1 : 0) + "\n#define hasBumpMap " + ((typeof(this.textures[enums.texture.map.BUMP]) === 'object') ? 1 : 0) + "\n#define hasReflectMap " + ((typeof(this.textures[enums.texture.map.REFLECT]) === 'object') ? 1 : 0) + "\n#define hasEnvSphereMap " + ((typeof(this.textures[enums.texture.map.ENVSPHERE]) === 'object') ? 1 : 0) + "\n#define hasAmbientMap " + ((typeof(this.textures[enums.texture.map.AMBIENT]) === 'object') ? 1 : 0) + "\n#define hasAlphaMap " + ((typeof(this.textures[enums.texture.map.ALPHA]) === 'object') ? 1 : 0) + "\n#define hasAlpha " + ((this.opacity !== 1.0) ? 1 : 0) + "\n#define lightPoint " + ((light_type === enums.light.type.POINT) ? 1 : 0) + "\n#define lightDirectional " + ((light_type === enums.light.type.DIRECTIONAL) ? 1 : 0) + "\n#define lightSpot " + ((light_type === enums.light.type.SPOT) ? 1 : 0) + "\n#define lightArea " + ((light_type === enums.light.type.AREA) ? 1 : 0) + "\n#define alphaDepth " + (GLCore.depth_alpha ? 1 : 0) + "\n\n";
};


Material.prototype.bindObject = function(obj_in, light_type) {
  var gl = GLCore.gl;

  if (light_type === undef) {
    light_type = 0;
  }
  
  var u = this.shader[light_type].uniforms;
  var up = u["aVertexPosition"];
  var uv = u["aTextureCoord"]; 
  var un = u["aNormal"]; 

  gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_points);
  gl.vertexAttribPointer(up, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(up);

  if (obj_in.compiled.gl_uvs!==null && uv !==-1) {
    gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_uvs);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(uv);
  }

  if (obj_in.compiled.gl_normals!==null && un !==-1) {
    gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_normals);
    gl.vertexAttribPointer(un, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(un);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj_in.compiled.gl_elements);
};

Material.prototype.use = function(light_type) {
  if (this.customShader !== null) {
    this.customShader.use();
    return;
  }

  if (light_type === undef) {
    light_type = 0;
  }

  var m;
  var thistex = this.textures;


  if (this.shader[light_type] === undef) {
    var smask = this.calcShaderMask(light_type);

    if (ShaderPool[light_type][smask] === undef) {
      var hdr = this.getShaderHeader(light_type);
      var vs = hdr + GLCore.CoreShader_vs;
      var fs = hdr + GLCore.CoreShader_fs;

      ShaderPool[light_type][smask] = new Shader(vs, fs);

      m = 0;

      if (typeof(thistex[enums.texture.map.COLOR]) === 'object') {
        ShaderPool[light_type][smask].addInt("colorMap", m++);
      }
      if (typeof(thistex[enums.texture.map.ENVSPHERE]) === 'object') {
        ShaderPool[light_type][smask].addInt("envSphereMap", m++);
      }
      if (typeof(thistex[enums.texture.map.NORMAL]) === 'object') {
        ShaderPool[light_type][smask].addInt("normalMap", m++);
      }
      if (typeof(thistex[enums.texture.map.BUMP]) === 'object') {
        ShaderPool[light_type][smask].addInt("bumpMap", m++);
      }
      if (typeof(thistex[enums.texture.map.REFLECT]) === 'object') {
        ShaderPool[light_type][smask].addInt("reflectMap", m++);
      }
      if (typeof(thistex[enums.texture.map.SPECULAR]) === 'object') {
        ShaderPool[light_type][smask].addInt("specularMap", m++);
      }
      if (typeof(thistex[enums.texture.map.AMBIENT]) === 'object') {
        ShaderPool[light_type][smask].addInt("ambientMap", m++);
      }
      if (typeof(thistex[enums.texture.map.ALPHA]) === 'object') {
        ShaderPool[light_type][smask].addInt("alphaMap", m++);
      }

      ShaderPool[light_type][smask].addMatrix("uMVMatrix");
      ShaderPool[light_type][smask].addMatrix("uPMatrix");
      ShaderPool[light_type][smask].addMatrix("uOMatrix");

      ShaderPool[light_type][smask].addVertexArray("aVertexPosition");
      ShaderPool[light_type][smask].addVertexArray("aNormal");

      if (light_type) {
        ShaderPool[light_type][smask].addVector("lDiff");
        ShaderPool[light_type][smask].addVector("lSpec");
        ShaderPool[light_type][smask].addFloat("lInt");
        ShaderPool[light_type][smask].addFloat("lDist");
        ShaderPool[light_type][smask].addVector("lPos");
        ShaderPool[light_type][smask].addVector("lDir");
      }

      ShaderPool[light_type][smask].addVector("lAmb");
      ShaderPool[light_type][smask].addVector("mDiff");
      ShaderPool[light_type][smask].addVector("mColor");
      ShaderPool[light_type][smask].addVector("mAmb");
      ShaderPool[light_type][smask].addVector("mSpec");
      ShaderPool[light_type][smask].addFloat("mShine");
      ShaderPool[light_type][smask].addFloat("mAlpha");

      if (GLCore.depth_alpha) {
        ShaderPool[light_type][smask].addVector("depthInfo");
      }

      /* do nothing right now -- place holder 
      if (light_type === enums.light.type.NULL) {
      } else if (light_type === enums.light.type.POINT) {
      } else if (light_type === enums.light.type.DIRECTIONAL) {
      } else if (light_type === enums.light.type.SPOT) {
      } else if (light_type === enums.light.type.AREA) {
      }
      */
      /*
      switch (light_type) {
      case enums.light.type.NULL:
        break; // do nothing
      case enums.light.type.POINT:
        break;
      case enums.light.type.DIRECTIONAL:
        break;
      case enums.light.type.SPOT:
        break;
      case enums.light.type.AREA:
        break;
      }
      */

      // if (thistex.length !== 0) {
        ShaderPool[light_type][smask].addUVArray("aTextureCoord");
      // }

      //      ShaderPool[light_type][smask].init();
    }

    this.shader[light_type] = ShaderPool[light_type][smask];
  }

  this.shader[light_type].use();

  var tex_list = [GLCore.gl.TEXTURE0, GLCore.gl.TEXTURE1, GLCore.gl.TEXTURE2, GLCore.gl.TEXTURE3, GLCore.gl.TEXTURE4, GLCore.gl.TEXTURE5, GLCore.gl.TEXTURE6, GLCore.gl.TEXTURE7];

  m = 0;
  
  if (typeof(thistex[enums.texture.map.COLOR]) === 'object') {
    thistex[enums.texture.map.COLOR].use(tex_list[m++]);
  }
  if (typeof(thistex[enums.texture.map.ENVSPHERE]) === 'object') {
    thistex[enums.texture.map.ENVSPHERE].use(tex_list[m++]);
  }
  if (typeof(thistex[enums.texture.map.NORMAL]) === 'object') {
    thistex[enums.texture.map.NORMAL].use(tex_list[m++]);
  }
  if (typeof(thistex[enums.texture.map.BUMP]) === 'object') {
    thistex[enums.texture.map.BUMP].use(tex_list[m++]);
  }
  if (typeof(thistex[enums.texture.map.REFLECT]) === 'object') {
    thistex[enums.texture.map.REFLECT].use(tex_list[m++]);
  }
  if (typeof(thistex[enums.texture.map.SPECULAR]) === 'object') {
    thistex[enums.texture.map.SPECULAR].use(tex_list[m++]);
  }
  if (typeof(thistex[enums.texture.map.AMBIENT]) === 'object') {
    thistex[enums.texture.map.AMBIENT].use(tex_list[m++]);
  }
  if (typeof(thistex[enums.texture.map.ALPHA]) === 'object') {
    thistex[enums.texture.map.ALPHA].use(tex_list[m++]);
  }

  this.shader[light_type].setVector("mColor", this.color);
  this.shader[light_type].setVector("mDiff", this.diffuse);
  this.shader[light_type].setVector("mAmb", this.ambient);
  this.shader[light_type].setVector("mSpec", this.specular);
  this.shader[light_type].setFloat("mShine", this.shininess);
  this.shader[light_type].setVector("lAmb", CubicVR.globalAmbient);

  if (GLCore.depth_alpha) {
    this.shader[light_type].setVector("depthInfo", [GLCore.depth_alpha_near, GLCore.depth_alpha_far, 0.0]);
  }

  if (this.opacity !== 1.0) {
    this.shader[light_type].setFloat("mAlpha", this.opacity);
  }
};




/* Textures */

var Texture = function(img_path,filter_type) {
  var gl = GLCore.gl;

  this.tex_id = Textures.length;
  this.filterType = -1;
  Textures[this.tex_id] = gl.createTexture();
  Textures_obj[this.tex_id] = this;

  if (img_path) {
    Images[this.tex_id] = new Image();
    Texture_ref[img_path] = this.tex_id;
  }

  gl.bindTexture(gl.TEXTURE_2D, Textures[this.tex_id]);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  if (img_path) {
    var texId = this.tex_id;
    var filterType = (filter_type!==undef)?filter_type:enums.texture.filter.LINEAR_MIP;
    Images[this.tex_id].onload = function() {
      gl.bindTexture(gl.TEXTURE_2D, Textures[texId]);

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      var img = Images[texId];

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

      var tw = img.width, th = img.height;
      
      var isPOT = true;
      
      if (tw===1||th===1) {
        isPOT = false;
      } else {
        if (tw!==1) { while ((tw % 2) === 0) { tw /= 2; } }
        if (th!==1) { while ((th % 2) === 0) { th /= 2; } }
        if (tw>1) { isPOT = false; }
        if (th>1) { isPOT = false; }        
      }

      if (!isPOT) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        if (filterType === enums.texture.filter.LINEAR_MIP) {
          filterType = enums.texture.filter.LINEAR;
        }
      }

      if (Textures_obj[texId].filterType===-1) {
        Textures_obj[texId].setFilter(filterType);      
      }          

      gl.bindTexture(gl.TEXTURE_2D, null);
    };

    Images[this.tex_id].src = img_path;
  }

  this.active_unit = -1;
};


Texture.prototype.setFilter = function(filterType) {
  var gl = CubicVR.GLCore.gl;

  gl.bindTexture(gl.TEXTURE_2D, Textures[this.tex_id]);
  /*
  switch (filterType)
  {
    case enums.texture.filter.LINEAR:
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    break;
    case enums.texture.filter.LINEAR_MIP:
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
      gl.generateMipmap(gl.TEXTURE_2D);			
    break;
    case enums.texture.filter.NEAREST:    
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);  
    break;
  }
  */

  if (filterType === enums.texture.filter.LINEAR) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  } else if (filterType === enums.texture.filter.LINEAR_MIP) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
      gl.generateMipmap(gl.TEXTURE_2D);			
  } else if (filterType === enums.texture.filter.NEAREST) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);  
  }

  this.filterType = filterType;
};

Texture.prototype.use = function(tex_unit) {
  GLCore.gl.activeTexture(tex_unit);
  GLCore.gl.bindTexture(GLCore.gl.TEXTURE_2D, Textures[this.tex_id]);
  this.active_unit = tex_unit;
};

Texture.prototype.clear = function() {
  if (this.active_unit !== -1) {
    GLCore.gl.activeTexture(this.active_unit);
    GLCore.gl.bindTexture(GLCore.gl.TEXTURE_2D, null);
    this.active_unit = -1;
  }
};



function PJSTexture(pjsURL, width, height) {
  var gl = CubicVR.GLCore.gl;
  this.texture = new CubicVR.Texture();
  this.canvas = document.createElement("CANVAS");
  this.canvas.width = width;
  this.canvas.height = height;
  
  // this assumes processing is already included..
  this.pjs = new Processing(this.canvas,CubicVR.util.getURL(pjsURL));
  this.pjs.noLoop();
  this.pjs.redraw();
  
  var tw = this.canvas.width, th = this.canvas.height;
  
  var isPOT = true;
  
  if (tw===1||th===1) {
    isPOT = false;
  } else {
    if (tw !== 1) { while ((tw % 2) === 0) { tw /= 2; } }
    if (th !== 1) { while ((th % 2) === 0) { th /= 2; } }
    if (tw > 1) { isPOT = false; }
    if (th > 1) { isPOT = false; }       
  }

  
  // bind functions to "subclass" a texture
  this.setFilter=this.texture.setFilter;
  this.clear=this.texture.clear;
  this.use=this.texture.use;
  this.tex_id=this.texture.tex_id;
  this.filterType=this.texture.filterType;


  if (!isPOT) {
    this.setFilter(enums.texture.filter.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);    
  } else {
    this.setFilter(enums.texture.filter.LINEAR_MIP);
  }
}

PJSTexture.prototype.update = function() {
  var gl = CubicVR.GLCore.gl;

  this.pjs.redraw();
 
  gl.bindTexture(gl.TEXTURE_2D, CubicVR.Textures[this.texture.tex_id]);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
  
  if (this.filterType === enums.texture.filter.LINEAR_MIP) {
    gl.generateMipmap(gl.TEXTURE_2D);			    
  }
  
  gl.bindTexture(gl.TEXTURE_2D, null); 
};


/* Render functions */


function cubicvr_renderObject(obj_in,mv_matrix,p_matrix,o_matrix,lighting) {
	var ofs = 0;
	var gl = CubicVR.GLCore.gl;
	var numLights = (lighting === undef) ? 0: lighting.length;
  var mshader, last_ltype, l;
  var lcount = 0;
  var j;
	var nullAmbient = [0,0,0];
	var tmpAmbient = CubicVR.globalAmbient;
	
	gl.depthFunc(gl.LEQUAL);
	
	if (o_matrix === undef) { o_matrix = cubicvr_identity; }
	
	for (var ic = 0, icLen = obj_in.compiled.elements_ref.length; ic < icLen; ic++) {
		var i = obj_in.compiled.elements_ref[ic][0][0];

		var mat = Materials[i];
				
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
			j = obj_in.compiled.elements_ref[ic][jc][1];
			
			drawn = false;
			
			var this_len = obj_in.compiled.elements_ref[ic][jc][2];
			
			len += this_len;
			
			if (obj_in.segment_state[j]) {
				// ...
			} else if (len > this_len) {
				ofs += this_len*2;
				len -= this_len;
				
				// start lighting loop
				// start inner
				if (!numLights) {
					mat.use(0);

					mat.shader[0].init(true);				

					mat.shader[0].setMatrix("uMVMatrix",mv_matrix);
					mat.shader[0].setMatrix("uPMatrix",p_matrix);
					mat.shader[0].setMatrix("uOMatrix",o_matrix);

					mat.bindObject(obj_in,0);

					gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);

					mat.shader[0].init(false);				
				} else {	
					mshader = undef;
					last_ltype = 0;

					for (lcount = 0; lcount < numLights; lcount++) {
						l = lighting[lcount];

						if (lcount === 1) {
							gl.enable(gl.BLEND);
							gl.blendFunc(gl.ONE,gl.ONE);
							gl.depthFunc(gl.EQUAL);
							CubicVR.globalAmbient = nullAmbient;
						}

						if (last_ltype !== l.light_type) {
							if (lcount) { mat.shader[last_ltype].init(false); }

							mat.use(l.light_type);

							mshader = mat.shader[l.light_type];
							mshader.init(true);				

							mshader.setMatrix("uMVMatrix",mv_matrix);
							mshader.setMatrix("uPMatrix",p_matrix);
							mshader.setMatrix("uOMatrix",o_matrix);

							mat.bindObject(obj_in,l.light_type);

							last_ltype = l.light_type;
						}

						l.setupShader(mshader);

						gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);
					}
				}

				if (lcount>1) { mat.shader[last_ltype].init(false); }
				if (lcount !== 0) {
					gl.depthFunc(gl.LEQUAL);
					CubicVR.globalAmbient = tmpAmbient;
				}
				// end inner
				
				
				ofs += len*2;	// Note: unsigned short = 2 bytes
				len = 0;			
				drawn = true;
			} else {
				ofs += len*2;
				len = 0;
			}
		}

		if (!drawn && obj_in.segment_state[j]) {
			// this is an exact copy/paste of above
			// start inner
			if (!numLights) {
				mat.use(0);

				mat.shader[0].init(true);				

				mat.shader[0].setMatrix("uMVMatrix",mv_matrix);
				mat.shader[0].setMatrix("uPMatrix",p_matrix);
				mat.shader[0].setMatrix("uOMatrix",o_matrix);

				mat.bindObject(obj_in,0);

				gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);

				mat.shader[0].init(false);				
			} else {	
				mshader = undef;
				last_ltype = 0;

				for (lcount = 0; lcount < numLights; lcount++) {
					l = lighting[lcount];

					if (lcount === 1) {
						gl.enable(gl.BLEND);
						gl.blendFunc(gl.ONE,gl.ONE);
						gl.depthFunc(gl.EQUAL);
						CubicVR.globalAmbient = nullAmbient;
					}

					if (last_ltype !== l.light_type) {
						if (lcount) { mat.shader[last_ltype].init(false); }

						mat.use(l.light_type);

						mshader = mat.shader[l.light_type];
						mshader.init(true);				

						mshader.setMatrix("uMVMatrix",mv_matrix);
						mshader.setMatrix("uPMatrix",p_matrix);
						mshader.setMatrix("uOMatrix",o_matrix);

						mat.bindObject(obj_in,l.light_type);

						last_ltype = l.light_type;
					}

					l.setupShader(mshader);

					gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);
				}
			}

			if (lcount>1) { mat.shader[last_ltype].init(false); }
			if (lcount !== 0) {
				gl.depthFunc(gl.LEQUAL);
				CubicVR.globalAmbient = tmpAmbient;
			}
			// end inner

			
			ofs += len*2;
		}
	}
	
	gl.depthMask(1);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}


/* Procedural Objects */

function cubicvr_latheObject(obj_in, pointList, lathe_divisions, material, transform) {
  var slices = [];
  var sliceNum;

  var up = [0, 1, 0];
  var right = [1, 0, 0];
  var pos = [0, 0, 0];
  var pofs = obj_in.points.length;

  var i, j, jMax, k, kMax;

  sliceNum = 0;

  for (i = 0; i < M_TWO_PI; i += (M_TWO_PI / lathe_divisions)) {
    if (sliceNum === lathe_divisions) {
      break;
    }

    right = [Math.cos(i), 0, Math.sin(i)];

    for (j = 0, jMax = pointList.length; j < jMax; j++) {
      pos = vec3.add(vec3.multiply(right, pointList[j][0]), vec3.multiply(up, pointList[j][1]));

      if (slices[sliceNum] === undef) {
        slices[sliceNum] = [];
      }

      slices[sliceNum].push(pos);
    }

    sliceNum++;
  }

  var transformed = (transform !== undef);

  for (j = 0; j < lathe_divisions; j++) {
    for (k = 0, kMax = pointList.length; k < kMax; k++) {
      if (transformed) {
        obj_in.addPoint(mat4.vec3_multiply(slices[j][k], transform.getResult()));
      } else {
        obj_in.addPoint(slices[j][k]);
      }
    }
  }

  obj_in.setFaceMaterial(material);

  for (k = 0; k < lathe_divisions; k++) {
    for (j = 0, jMax = pointList.length - 1; j < jMax; j++) {
      var pt = j + (pointList.length * k);
      var pt_r = j + (pointList.length * ((k + 1) % (lathe_divisions)));

      if (vec3.equal(obj_in.points[pofs + pt], obj_in.points[pofs + pt_r])) {
        obj_in.addFace([pofs + pt + 1, pofs + pt_r + 1, pofs + pt_r]);
      } else if (vec3.equal(obj_in.points[pofs + pt + 1], obj_in.points[pofs + pt_r + 1])) {
        obj_in.addFace([pofs + pt, pofs + pt + 1, pofs + pt_r]);
      } else {
        obj_in.addFace([pofs + pt, pofs + pt + 1, pofs + pt_r + 1, pofs + pt_r]);
      }
    }
  }
}

function cubicvr_planeObject(mesh, size, mat, transform) {
  var half_size = size*0.5;
  var pofs = mesh.points.length;
  mesh.setFaceMaterial(mat);
  mesh.addPoint([
    [half_size, -half_size, 0],
    [half_size, half_size, 0],
    [-half_size, half_size, 0],
    [-half_size, -half_size, 0]
  ]);
  mesh.addFace([
    [pofs+0, pofs+1, pofs+2, pofs+3], //back
    [pofs+3, pofs+2, pofs+1, pofs+0]  //front
  ]);

} //cubicvr_planeObject

function cubicvr_boxObject(boxObj, box_size, box_mat, transform) {
  var half_box = box_size / 2.0;
  var pofs = boxObj.points.length;

  boxObj.setFaceMaterial(box_mat);

  if (transform !== undef) {
    var m = transform.getResult();
    boxObj.addPoint([
      mat4.vec3_multiply([half_box, -half_box, half_box], m),
      mat4.vec3_multiply([half_box, half_box, half_box], m),
      mat4.vec3_multiply([-half_box, half_box, half_box], m),
      mat4.vec3_multiply([-half_box, -half_box, half_box], m),
      mat4.vec3_multiply([half_box, -half_box, -half_box], m),
      mat4.vec3_multiply([half_box, half_box, -half_box], m),
      mat4.vec3_multiply([-half_box, half_box, -half_box], m),
      mat4.vec3_multiply([-half_box, -half_box, -half_box], m)
      ]);
  } else {
    boxObj.addPoint([
      [half_box, -half_box, half_box],
      [half_box, half_box, half_box],
      [-half_box, half_box, half_box],
      [-half_box, -half_box, half_box],
      [half_box, -half_box, -half_box],
      [half_box, half_box, -half_box],
      [-half_box, half_box, -half_box],
      [-half_box, -half_box, -half_box]
      ]);

}

boxObj.addFace([
  [pofs + 0, pofs + 1, pofs + 2, pofs + 3],
  [pofs + 7, pofs + 6, pofs + 5, pofs + 4],
  [pofs + 4, pofs + 5, pofs + 1, pofs + 0],
  [pofs + 5, pofs + 6, pofs + 2, pofs + 1],
  [pofs + 6, pofs + 7, pofs + 3, pofs + 2],
  [pofs + 7, pofs + 4, pofs + 0, pofs + 3]
  ]);
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

  this.obj = new Mesh();

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

Landscape.prototype.getFaceAt = function(x, y, z) {
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


/*
  cvrFloat Landscape::getHeightValue(XYZ &pt)
  {
    Face *tmpFace;
    XYZ *tmpPoint;

    int faceNum = getFaceAt(pt);

    if (faceNum === -1) return 0;

    tmpFace = obj->faces[faceNum];
    tmpPoint = obj->points[obj->faces[faceNum]->pointref[0]];

    tmpFace->calcFaceNormal();

    cvrFloat na = tmpFace->face_normal.x;
    cvrFloat nb = tmpFace->face_normal.y;
    cvrFloat nc = tmpFace->face_normal.z;

    cvrFloat d = -na * tmpPoint->x - nb * tmpPoint->y - nc * tmpPoint->z;

    return ((na * pt.x + nc * pt.z+d)/-nb)+getPosition().y;
  };
  */

Landscape.prototype.getHeightValue = function(x, y, z) {

  if (typeof(x) === 'object') {
    return this.getHeightValue(x[0], x[1], x[2]);
  }

  var tmpFace;
  var tmpPoint;

  var faceNum = this.getFaceAt(x, y, z);

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

  heading *= (M_PI / 180.0);

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
  [-xrot * (180.0 / M_PI), heading, -zrot * (180.0 / M_PI)]];
};

var scene_object_uuid = 0;

function SceneObject(obj, name) {
  this.drawn_this_frame = false;

  this.position = [0, 0, 0];
  this.rotation = [0, 0, 0];
  this.scale = [1, 1, 1];

  this.lposition = [0, 0, 0];
  this.lrotation = [0, 0, 0];
  this.lscale = [0, 0, 0];

  this.trans = new Transform();

  this.tMatrix = this.trans.getResult();

  this.dirty = true;

  this.motion = null;

  this.obj = (obj !== undef) ? obj : null;
  this.name = (name !== undef) ? name : null;
  this.aabb = [];
  this.children = null;
  this.parent = null;

  this.id = -1;

  this.octree_leaves = [];
  this.octree_common_root = null;
  this.octree_aabb = [[0,0,0],[0,0,0]];
  AABB_reset(this.octree_aabb, [0,0,0]);
  this.ignore_octree = false;
  this.visible = true;
  this.culled = true;
  this.was_culled = true;

  this.dynamic_lights = [];
  this.static_lights = [];
}

SceneObject.prototype.doTransform = function(mat) {
  if (!vec3.equal(this.lposition, this.position) || !vec3.equal(this.lrotation, this.rotation) || !vec3.equal(this.lscale, this.scale) || (mat !== undef)) {

    this.trans.clearStack();

    if (! (this.scale[0] === 1 && this.scale[1] === 1 && this.scale[2] === 1)) {
      this.trans.pushMatrix();
      this.trans.scale(this.scale);
    }

    if (! (this.rotation[0] === 0 && this.rotation[1] === 0 && this.rotation[2] === 0)) {
      this.trans.rotate(this.rotation);
      this.trans.pushMatrix();
    }

    this.trans.translate(this.position);

    if ((mat !== undef)) {
      this.trans.pushMatrix(mat);
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
      AABB_reset(this.octree_aabb, this.position);
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

  /*
  switch (controllerId) {
  case enums.motion.POS:
    this.position[motionId] = value;
    break;
  case enums.motion.SCL:
    this.scale[motionId] = value;
    break;
  case enums.motion.ROT:
    this.rotation[motionId] = value;
    break;
  }
  */
};

SceneObject.prototype.getAABB = function() {
  if (this.dirty) {
    var p = new Array(8);

    this.doTransform();

    var aabbMin = this.obj.bb[0];
    var aabbMax = this.obj.bb[1];

    if (this.scale[0] !== 1 || this.scale[1] !== 1 || this.scale[2] !== 1) {
      aabbMin[0] *= this.scale[0];
      aabbMin[1] *= this.scale[1];
      aabbMin[2] *= this.scale[2];
      aabbMax[0] *= this.scale[0];
      aabbMax[1] *= this.scale[1];
      aabbMax[2] *= this.scale[2];
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
};

var cubicvr_env_range = function(v, lo, hi) {
  var v2, i = 0,
    r;

  r = hi - lo;

  if (r === 0.0) {
    return [lo, 0];
  }

  v2 = v - r * Math.floor((v - lo) / r);

  i = -parseInt((v2 - v) / r + (v2 > v ? 0.5 : -0.5), 10);

  return [v2, i];
};

var cubicvr_env_hermite = function(t) {
  var h1, h2, h3, h4;
  var t2, t3;

  t2 = t * t;
  t3 = t * t2;

  h2 = 3.0 * t2 - t3 - t3;
  h1 = 1.0 - h2;
  h4 = t3 - t2;
  h3 = h4 - t2 + t;

  return [h1, h2, h3, h4];
};

var cubicvr_env_bezier = function(x0, x1, x2, x3, t) {
  var a, b, c, t2, t3;

  t2 = t * t;
  t3 = t2 * t;

  c = 3.0 * (x1 - x0);
  b = 3.0 * (x2 - x1) - c;
  a = x3 - x0 - c - b;

  return a * t3 + b * t2 + c * t + x0;
};



var cubicvr_env_bez2_time = function(x0, x1, x2, x3, time, t0, t1) {

  var v, t;

  t = t0 + (t1 - t0) * 0.5;
  v = cubicvr_env_bezier(x0, x1, x2, x3, t);
  if (Math.abs(time - v) > 0.0001) {
    if (v > time) {
      t1 = t;
    } else {
      t0 = t;
    }
    return cubicvr_env_bez2_time(x0, x1, x2, x3, time, t0, t1);
  } else {
    return t;
  }
};



var cubicvr_env_bez2 = function(key0, key1, time)
{
   var x, y, t, t0 = 0.0, t1 = 1.0;

   if ( key0.shape === enums.envelope.shape.BEZ2 ) {
     
      x = key0.time + key0.param[ 2 ];
  } else {
      x = key0.time + ( key1.time - key0.time ) / 3.0;
    }
    
   t = cubicvr_env_bez2_time( key0.time, x, key1.time + key1.param[ 0 ], key1.time, time, t0, t1 );

   if ( key0.shape === enums.envelope.shape.BEZ2 ){
      y = key0.value + key0.param[ 3 ];
    }
   else {
      y = key0.value + key0.param[ 1 ] / 3.0;
    }

   return cubicvr_env_bezier( key0.value, y, key1.param[ 1 ] + key1.value, key1.value, t );
}


var cubicvr_env_outgoing = function(key0, key1) {
  var a, b, d, t, out;

  switch (key0.shape) {
  case enums.envelope.shape.TCB:
    a = (1.0 - key0.tension) * (1.0 + key0.continuity) * (1.0 + key0.bias);
    b = (1.0 - key0.tension) * (1.0 - key0.continuity) * (1.0 - key0.bias);
    d = key1.value - key0.value;

    if (key0.prev) {
      t = (key1.time - key0.time) / (key1.time - (key0.prev).time);
      out = t * (a * (key0.value - (key0.prev).value) + b * d);
    } else {
      out = b * d;
    }
    break;

  case enums.envelope.shape.LINE:
    d = key1.value - key0.value;
    if (key0.prev) {
      t = (key1.time - key0.time) / (key1.time - (key0.prev).time);
      out = t * (key0.value - (key0.prev).value + d);
    } else {
      out = d;
    }
    break;

  case enums.envelope.shape.BEZI:
  case enums.envelope.shape.HERM:
    out = key0.param[1];
    if (key0.prev) {
      out *= (key1.time - key0.time) / (key1.time - (key0.prev).time);
    }
    break;

  case enums.envelope.shape.BEZ2:
    out = key0.param[3] * (key1.time - key0.time);
    if (Math.abs(key0.param[2]) > 1e-5) {
      out /= key0.param[2];
    } else {
      out *= 1e5;
    }
    break;

  default:
  case enums.envelope.shape.STEP:
    out = 0.0;
    break;
  }

  return out;
};



var cubicvr_env_incoming = function(key0, key1) {
  var a, b, d, t, inval;

  switch (key1.shape) {
  case enums.envelope.shape.LINE:
    d = key1.value - key0.value;
    if (key1.next) {
      t = (key1.time - key0.time) / ((key1.next).time - key0.time);
      inval = t * ((key1.next).value - key1.value + d);
    } else {
      inval = d;
    }
    break;

  case enums.envelope.shape.TCB:
    a = (1.0 - key1.tension) * (1.0 - key1.continuity) * (1.0 + key1.bias);
    b = (1.0 - key1.tension) * (1.0 + key1.continuity) * (1.0 - key1.bias);
    d = key1.value - key0.value;

    if (key1.next) {
      t = (key1.time - key0.time) / ((key1.next).time - key0.time);
      inval = t * (b * ((key1.next).value - key1.value) + a * d);
    } else {
      inval = a * d;
    }
    break;

  case enums.envelope.shape.BEZI:
  case enums.envelope.shape.HERM:
    inval = key1.param[0];
    if (key1.next) {
      inval *= (key1.time - key0.time) / ((key1.next).time - key0.time);
    }
    break;

  case enums.envelope.shape.BEZ2:
    inval = key1.param[1] * (key1.time - key0.time);
    if (Math.abs(key1.param[0]) > 1e-5) {
      inval /= key1.param[0];
    } else {
      inval *= 1e5;
    }
    break;

  default:
  case enums.envelope.shape.STEP:
    inval = 0.0;
    break;
  }

  return inval;
};


function EnvelopeKey() {
  this.value = 0;
  this.time = 0;
  this.shape = enums.envelope.shape.TCB;
  this.tension = 0;
  this.continuity = 0;
  this.bias = 0;
  this.prev = null;
  this.next = null;

  this.param = new Array(4);

  this.param[0] = 0;
  this.param[1] = 0;
  this.param[2] = 0;
  this.param[3] = 0;
}


function Envelope() {
  this.nKeys = 0;
  this.keys = null;
  this.firstKey = null;
  this.lastKey = null;
  this.in_behavior = enums.envelope.behavior.CONSTANT;
  this.out_behavior = enums.envelope.behavior.CONSTANT;
}

Envelope.prototype.setBehavior = function(in_b, out_b) {
  this.in_behavior = in_b;
  this.out_behavior = out_b;
};


Envelope.prototype.empty = function() {
  return (this.nKeys === 0);
};


Envelope.prototype.addKey = function(time, value) {
  var tempKey;

  tempKey = this.insertKey(time);
  tempKey.value = value;

  return tempKey;
};


Envelope.prototype.insertKey = function(time) {
  var tempKey = new EnvelopeKey();

  tempKey.time = time;

  if (!this.nKeys) {
    this.keys = tempKey;
    this.firstKey = tempKey;
    this.lastKey = tempKey;
    this.nKeys++;

    return tempKey;
  }

  var k1 = this.keys;

  while (k1) {
    // update first/last key
    if (this.firstKey.time > time) {
      this.firstKey = tempKey;
    } else if (this.lastKey.time < time) {
      this.lastKey = tempKey;
    }

    if (k1.time > tempKey.time) {
      tempKey.prev = k1.prev;
      if (tempKey.prev) {
        tempKey.prev.next = tempKey;
      }

      tempKey.next = k1;
      tempKey.next.prev = tempKey;

      this.nKeys++;
      
      return tempKey;
    } else if (!k1.next) {
      tempKey.prev = k1;
      k1.next = tempKey;

      this.nKeys++;

      return tempKey;
    }

    k1 = k1.next;
  }

  return null; // you should not be here, time and space has imploded
};

Envelope.prototype.evaluate = function(time) {
  var key0, key1, skey, ekey;
  var t, h1, h2, h3, h4, inval, out, offset = 0.0;
  var noff;

  /* if there's no key, the value is 0 */
  if (this.nKeys === 0) {
    return 0.0;
  }

  /* if there's only one key, the value is constant */
  if (this.nKeys === 1) {
    return (this.keys).value;
  }

  /* find the first and last keys */
  skey = this.firstKey;
  ekey = this.lastKey;

  var tmp, behavior;

  /* use pre-behavior if time is before first key time */
  if (time < skey.time) {
    behavior = this.in_behavior;

    if (behavior        === enums.envelope.behavior.RESET) {
      return 0.0;
    } else if (behavior === enums.envelope.behavior.CONSTANT) {
      return skey.value;
    } else if (behavior === enums.envelope.behavior.REPEAT) {
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
    } else if (behavior === enums.envelope.behavior.OCILLATE) {
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];

      if (noff % 2) {
        time = ekey.time - skey.time - time;
      }
    } else if (behavior === enums.envelope.behavior.OFFSET) {
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];
      offset = noff * (ekey.value - skey.value);
    } else if (behavior === enums.envelope.behavior.LINEAR) {
      out = cubicvr_env_outgoing(skey, skey.next) / (skey.next.time - skey.time);
      return out * (time - skey.time) + skey.value;
    } 

    /*
    switch (this.in_behavior) {
    case enums.envelope.behavior.RESET:
      return 0.0;

    case enums.envelope.behavior.CONSTANT:
      return skey.value;

    case enums.envelope.behavior.REPEAT:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      break;

    case enums.envelope.behavior.OSCILLATE:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];

      if (noff % 2) {
        time = ekey.time - skey.time - time;
      }
      break;

    case enums.envelope.behavior.OFFSET:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];
      offset = noff * (ekey.value - skey.value);
      break;

    case enums.envelope.behavior.LINEAR:
      out = cubicvr_env_outgoing(skey, skey.next) / (skey.next.time - skey.time);
      return out * (time - skey.time) + skey.value;
    }
    */
  }

  /* use post-behavior if time is after last key time */
  else if (time > ekey.time) {
    behavior = this.out_behavior;

    if (behavior        === enums.envelope.behavior.RESET) {
      return 0.0;
    } else if (behavior === enums.envelope.behavior.CONSTANT) {
      return ekey.value;
    } else if (behavior === enums.envelope.behavior.REPEAT) {
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
    } else if (behavior === enums.envelope.behavior.OCILLATE) {
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];

      if (noff % 2) {
        time = ekey.time - skey.time - time;
      }
    } else if (behavior === enums.envelope.behavior.OFFSET) {
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];
      offset = noff * (ekey.value - skey.value);
    } else if (behavior === enums.envelope.behavior.LINEAR) {
      inval = cubicvr_env_incoming(ekey.prev, ekey) / (ekey.time - ekey.prev.time);
      return inval * (time - ekey.time) + ekey.value;
    } 
    /*
    switch (this.out_behavior) {
    case enums.envelope.behavior.RESET:
      return 0.0;

    case enums.envelope.behavior.CONSTANT:
      return ekey.value;

    case enums.envelope.behavior.REPEAT:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      break;

    case enums.envelope.behavior.OSCILLATE:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];

      if (noff % 2) {
        time = ekey.time - skey.time - time;
      }
      break;

    case enums.envelope.behavior.OFFSET:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];
      offset = noff * (ekey.value - skey.value);
      break;

    case enums.envelope.behavior.LINEAR:
      inval = cubicvr_env_incoming(ekey.prev, ekey) / (ekey.time - ekey.prev.time);
      return inval * (time - ekey.time) + ekey.value;
    }
    */
  }

  // get the endpoints of the interval being evaluated
  key0 = this.keys;
  while (time > key0.next.time) {
    key0 = key0.next;
  }
  key1 = key0.next;

  // check for singularities first
  if (time === key0.time) {
    return key0.value + offset;
  } else if (time === key1.time) {
    return key1.value + offset;
  }

  // get interval length, time in [0, 1]
  t = (time - key0.time) / (key1.time - key0.time);

  // interpolate
  /*
  switch (key1.shape) {
  case enums.envelope.shape.TCB:
  case enums.envelope.shape.BEZI:
  case enums.envelope.shape.HERM:
    out = cubicvr_env_outgoing(key0, key1);
    inval = cubicvr_env_incoming(key0, key1);
    var h = cubicvr_env_hermite(t);
    return h[0] * key0.value + h[1] * key1.value + h[2] * out + h[3] * inval + offset;

  case enums.envelope.shape.BEZ2:
    return cubicvr_env_bez2_time(key0, key1, time) + offset;

  case enums.envelope.shape.LINE:
    return key0.value + t * (key1.value - key0.value) + offset;

  case enums.envelope.shape.STEP:
    return key0.value + offset;

  default:
    return offset;
  }
  */

  var keyShape = key1.shape;

  if (keyShape === enums.envelope.shape.TCB || keyShape === enums.envelope.shape.BEZI || keyShape === enums.envelope.shape.HERM) {
    out = cubicvr_env_outgoing(key0, key1);
    inval = cubicvr_env_incoming(key0, key1);
    var h = cubicvr_env_hermite(t);
    return h[0] * key0.value + h[1] * key1.value + h[2] * out + h[3] * inval + offset;
  } else if (keyShape === enums.envelope.shape.BEZ2) {
    return cubicvr_env_bez2(key0, key1, time) + offset;
  } else if (keyShape === enums.envelope.shape.LINE) {
    return key0.value + t * (key1.value - key0.value) + offset;
  } else if (keyShape === enums.envelope.shape.STEP) {
    return key0.value + offset;
  } else {
    return offset;
  }
};

function Motion() {
  this.controllers = [];
  this.yzflip = false;
  this.rscale = 1;
}

Motion.prototype.envelope = function(controllerId, motionId) {
  if (this.controllers[controllerId] === undef) {
    this.controllers[controllerId] = [];
  }
  if (this.controllers[controllerId][motionId] === undef) {
    this.controllers[controllerId][motionId] = new Envelope();
  }

  return this.controllers[controllerId][motionId];
};

Motion.prototype.evaluate = function(index) {
  var retArr = [];

  for (var i in this.controllers) {
    if (this.controllers.hasOwnProperty(i)) {
      retArr[i] = [];

      for (var j in this.controllers[i]) {
        if (this.controllers[i].hasOwnProperty(j)) {
          retArr[i][j] = this.controllers[i][j].evaluate(index);
        }
      }
    }
  }

  return retArr;
};

Motion.prototype.apply = function(index, target) {
  for (var i in this.controllers) {
    if (this.controllers.hasOwnProperty(i)) {
      var ic = parseInt(i, 10);

      /* Special case quaternion fix for ZY->YZ rotation envelopes */
      if (this.yzflip && ic === enums.motion.ROT) // assume channel 0,1,2
      {
        if (!this.q) {
          this.q = new Quaternion();
        }
        var q = this.q;

        var x = this.controllers[i][0].evaluate(index);
        var y = this.controllers[i][1].evaluate(index);
        var z = this.controllers[i][2].evaluate(index);

        q.fromEuler(x*this.rscale, z*this.rscale, -y*this.rscale);

        var qr = q.toEuler();

        target.control(ic, 0, qr[0]);
        target.control(ic, 1, qr[1]);
        target.control(ic, 2, qr[2]);
      }
      else {
        for (var j in this.controllers[i]) {
          if (this.controllers[i].hasOwnProperty(j)) {
            target.control(ic, parseInt(j, 10), this.controllers[i][j].evaluate(index));
          }
        }
      }
    }
  }
};


Motion.prototype.setKey = function(controllerId, motionId, index, value) {
  var ev = this.envelope(controllerId, motionId);
  return ev.addKey(index, value);
};

Motion.prototype.setArray = function(controllerId, index, value) {
  var tmpKeys = [];

  for (var i in value) {
    if (value.hasOwnProperty(i)) {
      var ev = this.envelope(controllerId, i);
      tmpKeys[i] = ev.addKey(index, value[i]);
    }
  }

  return tmpKeys;
};


Motion.prototype.setBehavior = function(controllerId, motionId, behavior_in, behavior_out) {
  var ev = this.envelope(controllerId, motionId);
  ev.setBehavior(behavior_in, behavior_out);
};


Motion.prototype.setBehaviorArray = function(controllerId, behavior_in, behavior_out) {
  for (var motionId in this.controllers[controllerId]) {
    if (this.controllers[controllerId].hasOwnProperty(motionId)) {
      var ev = this.envelope(controllerId, motionId);
      ev.setBehavior(behavior_in, behavior_out);
    }
  }
};



function cubicvr_nodeToMotion(node, controllerId, motion) {
  var c = [];
  c[0] = node.getElementsByTagName("x");
  c[1] = node.getElementsByTagName("y");
  c[2] = node.getElementsByTagName("z");
  c[3] = node.getElementsByTagName("fov");

  var etime, evalue, ein, eout, etcb;

  for (var k in c) {
    if (c.hasOwnProperty(k)) {
      if (c[k] !== undef) {
        if (c[k].length) {
          etime = c[k][0].getElementsByTagName("time");
          evalue = c[k][0].getElementsByTagName("value");
          ein = c[k][0].getElementsByTagName("in");
          eout = c[k][0].getElementsByTagName("out");
          etcb = c[k][0].getElementsByTagName("tcb");

          var time = null,
            value = null,
            tcb = null;

          var intype = null,
            outtype = null;

          if (ein.length) {
            intype = util.collectTextNode(ein[0]);
          }

          if (eout.length) {
            outtype = util.collectTextNode(eout[0]);
          }

          if (etime.length) {
            time = util.floatDelimArray(util.collectTextNode(etime[0]), " ");
          }

          if (evalue.length) {
            value = util.floatDelimArray(util.collectTextNode(evalue[0]), " ");
          }

          if (etcb.length) {
            tcb = util.floatDelimArray(util.collectTextNode(etcb[0]), " ");
          }


          if (time !== null && value !== null) {
            for (var i = 0, iMax = time.length; i < iMax; i++) {
              var mkey = motion.setKey(controllerId, k, time[i], value[i]);

              if (tcb) {
                mkey.tension = tcb[i * 3];
                mkey.continuity = tcb[i * 3 + 1];
                mkey.bias = tcb[i * 3 + 2];
              }
            }
          }

          var in_beh = enums.envelope.behavior.CONSTANT;
          var out_beh = enums.envelope.behavior.CONSTANT;

          if (intype) {
            switch (intype) {
            case "reset":
              in_beh = enums.envelope.behavior.RESET;
              break;
            case "constant":
              in_beh = enums.envelope.behavior.CONSTANT;
              break;
            case "repeat":
              in_beh = enums.envelope.behavior.REPEAT;
              break;
            case "oscillate":
              in_beh = enums.envelope.behavior.OSCILLATE;
              break;
            case "offset":
              in_beh = enums.envelope.behavior.OFFSET;
              break;
            case "linear":
              in_beh = enums.envelope.behavior.LINEAR;
              break;
            }
          }

          if (outtype) {
            switch (outtype) {
            case "reset":
              out_beh = enums.envelope.behavior.RESET;
              break;
            case "constant":
              out_beh = enums.envelope.behavior.CONSTANT;
              break;
            case "repeat":
              out_beh = enums.envelope.behavior.REPEAT;
              break;
            case "oscillate":
              out_beh = enums.envelope.behavior.OSCILLATE;
              break;
            case "offset":
              out_beh = enums.envelope.behavior.OFFSET;
              break;
            case "linear":
              out_beh = enums.envelope.behavior.LINEAR;
              break;
            }
          }

          motion.setBehavior(controllerId, k, in_beh, out_beh);
        }
      }
    }
  }
}


function cubicvr_isMotion(node) {
  if (node === null) {
    return false;
  }

  return (node.getElementsByTagName("x").length || node.getElementsByTagName("y").length || node.getElementsByTagName("z").length || node.getElementsByTagName("fov").length);
}

/***********************************************
 * Plane
 ***********************************************/

function Plane() {
  this.a = 0;
  this.b = 0;
  this.c = 0;
  this.d = 0;
} //Plane::Constructor
Plane.prototype.classify_point = function(pt) {
  var dist = (this.a * pt[0]) + (this.b * pt[1]) + (this.c * pt[2]) + (this.d);
  if (dist < 0) {
    return -1;
  }
  if (dist > 0) {
    return 1;
  }
  return 0;
}; //Plane::classify_point
Plane.prototype.normalize = function() {
  var mag = Math.sqrt(this.a * this.a + this.b * this.b + this.c * this.c);
  this.a = this.a / mag;
  this.b = this.b / mag;
  this.c = this.c / mag;
  this.d = this.d / mag;
}; //Plane::normalize
Plane.prototype.toString = function() {
  return "[Plane " + this.a + ", " + this.b + ", " + this.c + ", " + this.d + "]";
}; //Plane::toString
/***********************************************
 * Sphere
 ***********************************************/

function Sphere(position, radius) {
  this.position = position;
  if (this.position === undef) {
    this.position = [0, 0, 0];
  }
  this.radius = radius;
} //Sphere::Constructor
Sphere.prototype.intersects = function(other_sphere) {
  var diff = vec3.subtract(this.position, other_sphere.position);
  var mag = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]);
  var sum_radii = this.radius + other_sphere.radius;
  if (mag * mag < sum_radii * sum_radii) {
    return true;
  }
  return false;
}; //Sphere::intersects

function OcTreeWorkerProxy(worker, camera, octree, scene) {
  this.worker = worker;
  this.scene = scene;
  this.worker.send({
    type: "init",
    data: {
      size: octree._size,
      max_depth: octree._max_depth
    }
  });
  this.worker.send({
    type: "set_camera",
    data: camera
  });

  var that = this;

  this._last_on = [];

  this.onmessage = function(e) {
    switch (e.data.type) {
    case "log":
      log(e.data.data);
      break;

    case "get_frustum_hits":
      var i, l;
      var hits = e.data.data;

      if (that._last_on !== undef) {
        for (i = 0, l = that._last_on.length; i < l; ++i) {
          that._last_on.culled = true;
        } //for
      } //if
      that._last_on = [];
      for (i = 0, l = hits.length; i < l; ++i) {
        var index = hits[i];
        var node = that.scene.sceneObjectsById[index];
        node.culled = false;
        node.drawn_this_frame = false;
        that._last_on.push(node);
      } //for
      break;

    default:
      break;
    } //switch
  }; //onmessage
  this.worker.message_function = this.onmessage;

  this.toString = function() {
    return "[OcTreeWorkerProxy]";
  }; //toString
  this.insert = function(node) {
    var s = JSON.stringify(node);
    that.worker.send({
      type: "insert",
      data: s
    });
  }; //insert
  this.cleanup = function() {
    that.worker.send({
      type: "cleanup",
      data: null
    });
  }; //cleanup
  this.draw_on_map = function() {
    return;
  }; //draw_on_map
  this.reset_node_visibility = function() {
    return;
  }; //reset_node_visibility
  this.get_frustum_hits = function() {
    for (var i = 0, l = that._last_on.length; i < l; ++i) {
      that._last_on[i].drawn_this_frame = false;
    } //for
    return that._last_on;
  }; //get_frustum_hits
} //OcTreeWorkerProxy

function OcTree(size, max_depth, root, position, child_index) {
  this._children = [];
  this._dirty = false;
  for (var i = 0; i < 8; ++i) {
    this._children[i] = null;
  }

  if (child_index === undef) {
    this._child_index = -1;
  } else {
    this._child_index = child_index;
  }

  if (size === undef) {
    this._size = 0;
  } else {
    this._size = size;
  }

  if (max_depth === undef) {
    this._max_depth = 0;
  } else {
    this._max_depth = max_depth;
  }

  if (root === undef) {
    this._root = null;
  } else {
    this._root = root;
  }

  if (position === undef) {
    this._position = [0, 0, 0];
  } else {
    this._position = position;
  }

  this._nodes = [];
  //this._static_nodes = [];
  this._lights = [];
  this._static_lights = [];

  this._sphere = new Sphere(this._position, Math.sqrt(3 * (this._size / 2 * this._size / 2)));
  this._bbox = [[0,0,0],[0,0,0]];
  AABB_reset(this._bbox, this._position);

  var s = this._size/2;
  AABB_engulf(this._bbox, [this._position[0] + s, this._position[1] + s, this._position[2] + s]);
  AABB_engulf(this._bbox, [this._position[0] - s, this._position[1] - s, this._position[2] - s]);
  this._debug_visible = false;
} //OcTree::Constructor
Array_remove = function(arr, from, to) {
  var rest = arr.slice((to || from) + 1 || arr.length);
  arr.length = from < 0 ? arr.length + from : from;
  return arr.push.apply(arr, rest);
};
OcTree.prototype.toString = function() {
  var real_size = [this._bbox[1][0] - this._bbox[0][0], this._bbox[1][2] - this._bbox[0][2]];
  return "[OcTree: @" + this._position + ", depth: " + this._max_depth + ", size: " + this._size + ", nodes: " + this._nodes.length + ", measured size:" + real_size + "]";
}; //OcTree::toString
OcTree.prototype.remove = function(node) {
  var dont_check_lights = false;
  var len = this._nodes.length;
  var i;
  for (i = len - 1, len = this._nodes.length; i >= 0; --i) {
    if (node === this._nodes[i]) {
      Array_remove(this._nodes, i);
      this.dirty_lineage();
      dont_check_lights = true;
      break;
    } //if
  } //for
  if (!dont_check_lights) {
    for (i = len - 1, len = this._lights.length; i >= 0; --i) {
      if (node === this._lights[i]) {
        Array_remove(this._lights, i);
        this.dirty_lineage();
        break;
      } //if      
    } //for
  } //if
}; //OcTree::remove
OcTree.prototype.dirty_lineage = function() {
  this._dirty = true;
  if (this._root !== null) { this._root.dirty_lineage(); }
} //OcTree::dirty_lineage
OcTree.prototype.cleanup = function() {
  var num_children = this._children.length;
  var num_keep_children = 0;
  for (var i = 0; i < num_children; ++i) {
    var child = this._children[i];
    if (child !== null) {
      var keep = true;
      if (child._dirty === true) {
        keep = child.cleanup();
      } //if
      if (!keep) {
        this._children[i] = null;
      } else {
        ++num_keep_children;
      }
    } //if
  } //for
  if ((this._nodes.length === 0 && this._static_lights.length === 0 && this._lights.length === 0) && (num_keep_children === 0 || num_children === 0)) {
    return false;
  }
  return true;
}; //OcTree::cleanup
OcTree.prototype.insert_light = function(light) {
  this.insert(light, true);
}; //insert_light
OcTree.prototype.propagate_static_light = function(light) {
  var i,l;
  for (i = 0, l = this._nodes.length; i < l; ++i) {
    if (this._nodes[i].static_lights.indexOf(light) === -1) {
      this._nodes[i].static_lights.push(light);
    } //if
  } //for
  for (i = 0; i < 8; ++i) {
    if (this._children[i] !== null) {
      this._children[i].propagate_static_light(light);
    } //if
  } //for
}; //propagate_static_light
OcTree.prototype.insert = function(node, is_light) {
  if (is_light === undef) { is_light = false; }
  function $insert(octree, node, is_light, root) {
    var i, li;
    if (is_light) {
      if (node.method === enums.light.method.STATIC) {
        if (octree._static_lights.indexOf(node) === -1) {
          octree._static_lights.push(node);
        } //if
        for (i=0; i<octree._nodes.length; ++i) {
          if (octree._nodes[i].static_lights.indexOf(node) === -1) {
            octree._nodes[i].static_lights.push(node);
          } //if
        } //for
      }
      else {
        if (octree._lights.indexOf(node) === -1) {
          octree._lights.push(node);
        } //if
      } //if
    } else {
      octree._nodes.push(node);
      for (i=0, li = octree._static_lights.length; i<li; ++i) {
        if (node.static_lights.indexOf(octree._static_lights[i]) === -1) {
          node.static_lights.push(octree._static_lights[i]);
        }
      } //for
      var root = octree._root;
      while (root !== null) {
        for (var i=0, l=root._static_lights.length; i<l; ++i) {
          var light = root._static_lights[i];
          if (node.static_lights.indexOf(light) === -1) {
            node.static_lights.push(light);
          } //if
        } //for
        root = root._root;
      } //while
    } //if
    node.octree_leaves.push(octree);
    node.octree_common_root = root;
    AABB_engulf(node.octree_aabb, octree._bbox[0]);
    AABB_engulf(node.octree_aabb, octree._bbox[1]);
  } //$insert
  if (this._root === null) {
    node.octree_leaves = [];
    node.octree_common_root = null;
  } //if
  if (this._max_depth === 0) {
    $insert(this, node, is_light, this._root);
    return;
  } //if
  //Check to see where the node is
  var p = this._position;
  var t_nw, t_ne, t_sw, t_se, b_nw, b_ne, b_sw, b_se;
  var aabb = node.getAABB();
  var min = [aabb[0][0], aabb[0][1], aabb[0][2]];
  var max = [aabb[1][0], aabb[1][1], aabb[1][2]];

  t_nw = min[0] < p[0] && min[1] < p[1] && min[2] < p[2];
  t_ne = max[0] > p[0] && min[1] < p[1] && min[2] < p[2];
  b_nw = min[0] < p[0] && max[1] > p[1] && min[2] < p[2];
  b_ne = max[0] > p[0] && max[1] > p[1] && min[2] < p[2];
  t_sw = min[0] < p[0] && min[1] < p[1] && max[2] > p[2];
  t_se = max[0] > p[0] && min[1] < p[1] && max[2] > p[2];
  b_sw = min[0] < p[0] && max[1] > p[1] && max[2] > p[2];
  b_se = max[0] > p[0] && max[1] > p[1] && max[2] > p[2];

  //Is it in every sector?
  if (t_nw && t_ne && b_nw && b_ne && t_sw && t_se && b_sw && b_se) {
    $insert(this, node, is_light, this);
    if (is_light && node.method == enums.light.method.STATIC) {
      this.propagate_static_light(node);
    } //if
  } else {

    //Add static lights in this octree
    for (var i=0, ii=this._static_lights.length; i<ii; ++i) {
      if (node.static_lights.indexOf(this._static_lights[i]) === -1) {
        node.static_lights.push(this._static_lights[i]);
      } //if
    } //for

    var new_size = this._size / 2;
    var offset = this._size / 4;
    var new_position;

    var num_inserted = 0;
    //Create & check children to see if node fits there too
    var x = this._position[0];
    var y = this._position[1];
    var z = this._position[2];
    if (t_nw) {
      new_position = [x - offset, y - offset, z - offset];
      if (this._children[enums.octree.TOP_NW] === null) {
        this._children[enums.octree.TOP_NW] = new OcTree(new_size, this._max_depth - 1, this, new_position, enums.octree.TOP_NW);
      }
      this._children[enums.octree.TOP_NW].insert(node, is_light);
      ++num_inserted;
    } //if
    if (t_ne) {
      new_position = [x + offset, y - offset, z - offset];
      if (this._children[enums.octree.TOP_NE] === null) {
        this._children[enums.octree.TOP_NE] = new OcTree(new_size, this._max_depth - 1, this, new_position, enums.octree.TOP_NE);
      }
      this._children[enums.octree.TOP_NE].insert(node, is_light);
      ++num_inserted;
    } //if
    if (b_nw) {
      new_position = [x - offset, y + offset, z - offset];
      if (this._children[enums.octree.BOTTOM_NW] === null) {
        this._children[enums.octree.BOTTOM_NW] = new OcTree(new_size, this._max_depth - 1, this, new_position, enums.octree.BOTTOM_NW);
      }
      this._children[enums.octree.BOTTOM_NW].insert(node, is_light);
      ++num_inserted;
    } //if
    if (b_ne) {
      new_position = [x + offset, y + offset, z - offset];
      if (this._children[enums.octree.BOTTOM_NE] === null) {
        this._children[enums.octree.BOTTOM_NE] = new OcTree(new_size, this._max_depth - 1, this, new_position, enums.octree.BOTTOM_NE);
      }
      this._children[enums.octree.BOTTOM_NE].insert(node, is_light);
      ++num_inserted;
    } //if
    if (t_sw) {
      new_position = [x - offset, y - offset, z + offset];
      if (this._children[enums.octree.TOP_SW] === null) {
        this._children[enums.octree.TOP_SW] = new OcTree(new_size, this._max_depth - 1, this, new_position, enums.octree.TOP_SW);
      }
      this._children[enums.octree.TOP_SW].insert(node, is_light);
      ++num_inserted;
    } //if
    if (t_se) {
      new_position = [x + offset, y - offset, z + offset];
      if (this._children[enums.octree.TOP_SE] === null) {
        this._children[enums.octree.TOP_SE] = new OcTree(new_size, this._max_depth - 1, this, new_position, enums.octree.TOP_SE);
      }
      this._children[enums.octree.TOP_SE].insert(node, is_light);
      ++num_inserted;
    } //if
    if (b_sw) {
      new_position = [x - offset, y + offset, z + offset];
      if (this._children[enums.octree.BOTTOM_SW] === null) {
        this._children[enums.octree.BOTTOM_SW] = new OcTree(new_size, this._max_depth - 1, this, new_position, enums.octree.BOTTOM_SW);
      }
      this._children[enums.octree.BOTTOM_SW].insert(node, is_light);
      ++num_inserted;
    } //if
    if (b_se) {
      new_position = [x + offset, y + offset, z + offset];
      if (this._children[enums.octree.BOTTOM_SE] === null) {
        this._children[enums.octree.BOTTOM_SE] = new OcTree(new_size, this._max_depth - 1, this, new_position, enums.octree.BOTTOM_SE);
      }
      this._children[enums.octree.BOTTOM_SE].insert(node, is_light);
      ++num_inserted;
    } //if
    if (num_inserted > 1 || node.octree_common_root === null) {
      node.octree_common_root = this;
    } //if
  } //if
}; //OcTree::insert
OcTree.prototype.draw_on_map = function(map_canvas, map_context, target) {
  var mhw = map_canvas.width/2;
  var mhh = map_canvas.height/2;
  var x, y, w, h;
  var i, len;

  if (target === undef || target === "map") {
    map_context.save();
    if (this._debug_visible !== false) {
      map_context.fillStyle = "rgba(0,0,0,0)";
      map_context.strokeStyle = "#FF0000";
    }
    else {
      map_context.fillStyle = "rgba(0,0,0,0)";
      map_context.strokeStyle = "rgba(0,0,0,0)";
    } //if
    map_context.beginPath();
    var offset = this._size / 2;
    x = this._position[0];
    y = this._position[2];
    map_context.moveTo(mhw + x - offset, mhw + y - offset);
    map_context.lineTo(mhw + x - offset, mhw + y + offset);
    map_context.lineTo(mhw + x + offset, mhw + y + offset);
    map_context.lineTo(mhw + x + offset, mhw + y - offset);
    map_context.stroke();
    map_context.fill();
    map_context.restore();
  }

  if (target === undef || target === "objects") {
    map_context.save();
    for (i = 0, len = this._nodes.length; i < len; ++i) {
      var n = this._nodes[i];
      map_context.fillStyle = "#5500FF";
      if (n.visible === true && n.culled === false) {
        map_context.strokeStyle = "#FFFFFF";
      } else {
        map_context.strokeStyle = "#000000";
      } //if
      map_context.beginPath();
      x = n.aabb[0][0];
      y = n.aabb[0][2];
      w = n.aabb[1][0] - x;
      h = n.aabb[1][2] - y;
      map_context.rect(mhw + x, mhh + y, w, h);
      map_context.stroke();
    } //for
    map_context.restore();
  }

  if (target === undef || target === "lights") {
    for (i = 0, len = this._lights.length; i < len; ++i) {
      var l = this._lights[i];
      if (l.culled === false && l.visible === true) {
        map_context.fillStyle = "rgba(255, 255, 255, 0.1)";
      } else {
        map_context.fillStyle = "rgba(255, 255, 255, 0.0)";
      }
      map_context.strokeStyle = "#FFFF00";
      map_context.beginPath();
      var d = l.distance;
      x = l.position[0];
      y = l.position[2];
      map_context.arc(mhw + x, mhh + y, d, 0, Math.PI * 2, true);
      map_context.closePath();
      map_context.stroke();
      map_context.fill();
      map_context.beginPath();
      x = l.aabb[0][0];
      y = l.aabb[0][2];
      w = l.aabb[1][0] - x;
      h = l.aabb[1][2] - y;
      map_context.rect(mhw + x, mhh + y, w, h);
      map_context.closePath();
      map_context.stroke();
    } //for
    for (i = 0, len = this._static_lights.length; i < len; ++i) {
      var l = this._static_lights[i];
      if (l.culled === false && l.visible === true) {
        map_context.fillStyle = "rgba(255, 255, 255, 0.01)";
      } else {
        map_context.fillStyle = "rgba(255, 255, 255, 0.0)";
      }
      map_context.strokeStyle = "#FF66BB";
      map_context.beginPath();
      var d = l.distance;
      x = l.position[0];
      y = l.position[2];
      map_context.arc(mhw + x, mhh + y, d, 0, Math.PI * 2, true);
      map_context.closePath();
      map_context.stroke();
      map_context.fill();
      map_context.beginPath();
      x = l.aabb[0][0];
      y = l.aabb[0][2];
      w = l.aabb[1][0] - x;
      h = l.aabb[1][2] - y;
      map_context.rect(mhw + x, mhh + y, w, h);
      map_context.closePath();
      map_context.stroke();
    } //for
  } //if

  function $draw_box(x1, y1, x2, y2, fill) {
    var x = x1 < x2 ? x1 : x2;
    var y = y1 < y2 ? y1 : y2;
    var w = x1 < x2 ? x2-x1 : x1-x2;
    var h = y1 < y2 ? y2-y1 : y1-y2;
    map_context.save();
    if (fill !== undefined) {
      map_context.fillStyle = fill;
      map_context.fillRect(mhw+x,mhh+y,w,h);
    } //if
    map_context.strokeRect(mhw+x,mhh+y,w,h);
    map_context.restore();
  } //$draw_box

  function $draw_oct(oct, fill) {
    var x1 = oct._bbox[0][0];
    var y1 = oct._bbox[0][2];
    var x2 = oct._bbox[1][0];
    var y2 = oct._bbox[1][2];
    $draw_box(x1, y1, x2, y2, fill);
  } //$draw_oct
  if (target != "lights" && target != "objects" && target != "map") {
    map_context.save();
    var nodes = this._nodes;
    for (var i=0,l=nodes.length;i<l;++i) {
      var n = nodes[i];
      if (n.name == target) {
        map_context.strokeStyle = "#FFFF00";
        map_context.lineWidth = 3;
        map_context.beginPath();
        x = n.aabb[0][0];
        y = n.aabb[0][2];
        w = n.aabb[1][0] - x;
        h = n.aabb[1][2] - y;
        map_context.rect(mhw + x, mhh + y, w, h);
        map_context.closePath();
        map_context.stroke();

        var oab = n.octree_aabb;
        map_context.strokeStyle = "#0000FF";
        $draw_box(oab[0][0], oab[0][2], oab[1][0], oab[1][2]);
        map_context.lineWidth = 1;
        if (n.common_root !== null) {
          map_context.strokeStyle = "#00FF00";
          //$draw_oct(n.octree_common_root);
        } //if
        break;
      } //if
    } //for
    map_context.lineWidth = 1;
    map_context.strokeStyle = "#FFFF00";
    $draw_oct(this, "#444444");
    map_context.fill();
    map_context.restore();

  } //if

  for (i = 0, len = this._children.length; i < len; ++i) {
    if (this._children[i] !== null) {
      this._children[i].draw_on_map(map_canvas, map_context, target);
    }
  } //for
}; //OcTree::draw_on_map
OcTree.prototype.contains_point = function(position) {
  return position[0] <= this._position[0] + this._size / 2 && position[1] <= this._position[1] + this._size / 2 && position[2] <= this._position[2] + this._size / 2 && position[0] >= this._position[0] - this._size / 2 && position[1] >= this._position[1] - this._size / 2 && position[2] >= this._position[2] - this._size / 2;
}; //OcTree::contains_point
OcTree.prototype.get_frustum_hits = function(camera, test_children) {
  var hits = {
    objects: [],
    lights: []
  };
  if (test_children === undef || test_children === true) {
    if (! (this.contains_point(camera.position))) {
      if (camera.frustum.sphere.intersects(this._sphere) === false) {
        return hits;
      }
      //if(_sphere.intersects(c.get_frustum().get_cone()) === false) return;
      switch (camera.frustum.contains_sphere(this._sphere)) {
      case -1:
        this._debug_visible = false;
        return hits;

      case 1:
        this._debug_visible = 2;
        test_children = false;
        break;

      case 0:
        this._debug_visible = true;
        switch (camera.frustum.contains_box(this._bbox)) {
        case -1:
          this._debug_visible = false;
          return hits;

        case 1:
          this._debug_visible = 3;
          test_children = false;
          break;
        } //switch
        break;
      } //switch
    } //if
  } //if
  var i, max_i;
  for (i = 0, max_i = this._nodes.length; i < max_i; ++i) {
    var n = this._nodes[i];
    hits.objects.push(n);
    n.dynamic_lights = [].concat(this._lights);
    n.was_culled = n.culled;
    n.culled = false;
    n.drawn_this_frame = false;
  } //for objects
  this._debug_visible = this._lights.length > 0 ? 4 : this._debug_visible;
  for (i = 0, max_i = this._lights.length; i < max_i; ++i) {
    var l = this._lights[i];
    if (l.visible === true) {
      hits.lights.push(l);
      l.was_culled = l.culled;
      l.culled = false;
    } //if
  } //for dynamic lights
  for (i = 0, max_i = this._static_lights.length; i < max_i; ++i) {
    var l = this._static_lights[i];
    if (l.visible === true) {
      l.culled = false;
    } //if
  } //for static lights
  for (i = 0; i < 8; ++i) {
    if (this._children[i] !== null) {
      var child_hits = this._children[i].get_frustum_hits(camera, test_children);
      var o, max_o;
      for (o = 0, max_o = child_hits.objects.length; o < max_o; ++o) {
        hits.objects.push(child_hits.objects[o]);
        var obj_lights = child_hits.objects[o].dynamic_lights;
        for (var j=0, lj=this._lights.length; j<lj; ++j) {
          if(obj_lights.indexOf(this._lights[j]) < 0) {
            obj_lights.push(this._lights[j]);
          } //if
        } //for j
      } //for o
      //hits.lights = hits.lights.concat(child_hits.lights);
      //collect lights and make sure they're unique <- really slow
      for (o = 0, max_o = child_hits.lights.length; o < max_o; ++o) {
        if (hits.lights.indexOf(child_hits.lights[o]) < 0) {
          hits.lights.push(child_hits.lights[o]);
        } //if
      } //for o
    } //if
  } //for
  return hits;
}; //OcTree::get_frustum_hits
OcTree.prototype.reset_node_visibility = function() {
  this._debug_visible = false;

  var i, l;
  for (i = 0, l = this._nodes.length; i < l; ++i) {
    this._nodes[i].culled = true;
  } //for
  for (i = 0, l = this._lights.length; i < l; ++i) {
    this._lights[i].culled = true;
  } //for
  for (i = 0, l = this._static_lights.length; i < l; ++i) {
    this._static_lights[i].culled = true;
  } //for
  for (i = 0, l = this._children.length; i < l; ++i) {
    if (this._children[i] !== null) {
      this._children[i].reset_node_visibility();
    } //if
  } //for
}; //OcTree::reset_visibility
/***********************************************
 * OcTreeNode
 ***********************************************/

function OcTreeNode() {
  this.position = [0, 0, 0];
  this.visible = false;
  this._object = null;
} //OcTreeNode::Constructor
OcTreeNode.prototype.toString = function() {
  return "[OcTreeNode " + this.position + "]";
}; //OcTreeNode::toString
OcTreeNode.prototype.attach = function(obj) {
  this._object = obj;
}; //OcTreeNode::attach

/*****************************************************************************
 * OcTree Worker
 *****************************************************************************/

function CubicVR_OcTreeWorker() {
  this.octree = null;
  this.nodes = [];
  this.camera = null;
  this._last_on = undef;
  this._last_off = undef;
} //CubicVR_OcTreeWorker::Constructor
CubicVR_OcTreeWorker.prototype.onmessage = function(e) {
  var i;

  switch (e.data.data.type) {
  case "init":
    var params = e.data.data.data;
    this.octree = new OcTree(params.size, params.max_depth);
    this.camera = new Camera();
    break;

  case "set_camera":
    var data = e.data.data.data;
    this.camera.mvMatrix = data.mvMatrix;
    this.camera.pMatrix = data.pMatrix;
    this.camera.position = data.position;
    this.camera.target = data.target;
    this.camera.frustum.extract(this.camera, this.camera.mvMatrix, this.camera.pMatrix);
    break;

  case "insert":
    var json_node = JSON.parse(e.data.data.data);
    var node = new SceneObject();
    var trans = new Transform();

    for (i in json_node) {
      if (json_node.hasOwnProperty(i)) {
        node[i] = json_node[i];
      }
    }

    for (i in json_node.trans) {
      if (json_node.trans.hasOwnProperty(i)) {
        trans[i] = json_node.trans[i];
      }
    }

    node.trans = trans;
    node.id = json_node.id;

    this.octree.insert(node);
    this.nodes[node.id] = node;
    break;

  case "cleanup":
    this.octree.cleanup();
    break;

  default:
    break;
  } //switch
}; //onmessage

function CubicVR_OctreeWorker_mkInterval(context) {
  var cxt = context;
  return function() {
    cxt.listener.run(cxt.listener);
  };
}

CubicVR_OcTreeWorker.prototype.run = function(that) {
  if (that.camera !== null && that.octree !== null) {
    var i, l;

    if (this._last_on !== undef) {
      for (i = 0, l = this._last_on.length; i < l; ++i) {
        this._last_on[i].culled = true;
      } //for
    } //if
    // set new visibility on nodes
    var new_hits = that.octree.get_frustum_hits(that.camera);

    // so that ids are in order
    var ids = [];
    for (i = 0, l = that.nodes.length; i < l; ++i) {
      if (that.nodes[i].culled !== that.nodes[i].was_culled) {
        ids.push(that.nodes[i].id);
      } //if
    } //for
    // is there anything to send?
    if (ids.length > 0) {
      postMessage({
        type: "get_frustum_hits",
        data: ids
      });
    } //if
    this._last_on = new_hits;
  } //if
}; //run
/***********************************************
 * Frustum
 ***********************************************/

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

function Frustum() {
  this.last_in = [];
  this._planes = [];
  this.sphere = null;
  for (var i = 0; i < 6; ++i) {
    this._planes[i] = new Plane();
  } //for
} //Frustum::Constructor
Frustum.prototype.extract = function(camera, mvMatrix, pMatrix) {
  if (mvMatrix === undef || pMatrix === undef) {
    return;
  }
  var comboMatrix = mat4.multiply(mvMatrix, pMatrix);

  // Left clipping plane
  this._planes[enums.frustum.plane.LEFT].a = comboMatrix[3] + comboMatrix[0];
  this._planes[enums.frustum.plane.LEFT].b = comboMatrix[7] + comboMatrix[4];
  this._planes[enums.frustum.plane.LEFT].c = comboMatrix[11] + comboMatrix[8];
  this._planes[enums.frustum.plane.LEFT].d = comboMatrix[15] + comboMatrix[12];

  // Right clipping plane
  this._planes[enums.frustum.plane.RIGHT].a = comboMatrix[3] - comboMatrix[0];
  this._planes[enums.frustum.plane.RIGHT].b = comboMatrix[7] - comboMatrix[4];
  this._planes[enums.frustum.plane.RIGHT].c = comboMatrix[11] - comboMatrix[8];
  this._planes[enums.frustum.plane.RIGHT].d = comboMatrix[15] - comboMatrix[12];

  // Top clipping plane
  this._planes[enums.frustum.plane.TOP].a = comboMatrix[3] - comboMatrix[1];
  this._planes[enums.frustum.plane.TOP].b = comboMatrix[7] - comboMatrix[5];
  this._planes[enums.frustum.plane.TOP].c = comboMatrix[11] - comboMatrix[9];
  this._planes[enums.frustum.plane.TOP].d = comboMatrix[15] - comboMatrix[13];

  // Bottom clipping plane
  this._planes[enums.frustum.plane.BOTTOM].a = comboMatrix[3] + comboMatrix[1];
  this._planes[enums.frustum.plane.BOTTOM].b = comboMatrix[7] + comboMatrix[5];
  this._planes[enums.frustum.plane.BOTTOM].c = comboMatrix[11] + comboMatrix[9];
  this._planes[enums.frustum.plane.BOTTOM].d = comboMatrix[15] + comboMatrix[13];

  // Near clipping plane
  this._planes[enums.frustum.plane.NEAR].a = comboMatrix[3] + comboMatrix[2];
  this._planes[enums.frustum.plane.NEAR].b = comboMatrix[7] + comboMatrix[6];
  this._planes[enums.frustum.plane.NEAR].c = comboMatrix[11] + comboMatrix[10];
  this._planes[enums.frustum.plane.NEAR].d = comboMatrix[15] + comboMatrix[14];

  // Far clipping plane
  this._planes[enums.frustum.plane.FAR].a = comboMatrix[3] - comboMatrix[2];
  this._planes[enums.frustum.plane.FAR].b = comboMatrix[7] - comboMatrix[6];
  this._planes[enums.frustum.plane.FAR].c = comboMatrix[11] - comboMatrix[10];
  this._planes[enums.frustum.plane.FAR].d = comboMatrix[15] - comboMatrix[14];

  for (var i = 0; i < 6; ++i) {
    this._planes[i].normalize();
  }

  //Sphere
  var fov = 1 / pMatrix[5];
  var near = -this._planes[enums.frustum.plane.NEAR].d;
  var far = this._planes[enums.frustum.plane.FAR].d;
  var view_length = far - near;
  var height = view_length * fov;
  var width = height;

  var P = [0, 0, near + view_length * 0.5];
  var Q = [width, height, near + view_length];
  var diff = vec3.subtract(P, Q);
  var diff_mag = vec3.length(diff);

  var look_v = [comboMatrix[3], comboMatrix[9], comboMatrix[10]];
  var look_mag = vec3.length(look_v);
  look_v = vec3.multiply(look_v, 1 / look_mag);

  this.sphere = new Sphere([camera.position[0], camera.position[1], camera.position[2]], diff_mag);
  this.sphere.position = vec3.add(this.sphere.position, vec3.multiply(look_v, view_length * 0.5));
  this.sphere.position = vec3.add(this.sphere.position, vec3.multiply(look_v, 1));

}; //Frustum::extract
Frustum.prototype.contains_sphere = function(sphere) {
  for (var i = 0; i < 6; ++i) {
    var p = this._planes[i];
    var normal = [p.a, p.b, p.c];
    var distance = vec3.dot(normal, sphere.position) + p.d;
    this.last_in[i] = 1;

    //OUT
    if (distance < -sphere.radius) {
      return -1;
    }

    //INTERSECT
    if (Math.abs(distance) < sphere.radius) {
      return 0;
    }

  } //for
  //IN
  return 1;
}; //Frustum::contains_sphere
Frustum.prototype.draw_on_map = function(map_canvas, map_context) {
  var mhw = map_canvas.width/2;
  var mhh = map_canvas.height/2;
  map_context.save();
  for (var pi = 0, l = this._planes.length; pi < l; ++pi) {
    if (pi === 2 || pi === 3) {continue;}
    map_context.strokeStyle = "#FF00FF";
    if (pi < this.last_in.length) {
      if (this.last_in[pi]) {
        map_context.strokeStyle = "#FFFF00";
      }
    } //if
    var p = this._planes[pi];
    var x1 = -mhw;
    var y1 = (-p.d - p.a * x1) / p.c;
    var x2 = mhw;
    var y2 = (-p.d - p.a * x2) / p.c;
    map_context.moveTo(mhw + x1, mhh + y1);
    map_context.lineTo(mhw + x2, mhh + y2);
    map_context.stroke();
  } //for
  map_context.strokeStyle = "#0000FF";
  map_context.beginPath();
  map_context.arc(mhw + this.sphere.position[0], mhh + this.sphere.position[2], this.sphere.radius, 0, Math.PI * 2, false);
  map_context.closePath();
  map_context.stroke();
  map_context.restore();
}; //Frustum::draw_on_map
Frustum.prototype.contains_box = function(bbox) {
  var total_in = 0;

  var points = [];
  points[0] = bbox[0];
  points[1] = [bbox[0][0], bbox[0][1], bbox[1][2]];
  points[2] = [bbox[0][0], bbox[1][1], bbox[0][2]];
  points[3] = [bbox[0][0], bbox[1][1], bbox[1][2]];
  points[4] = [bbox[1][0], bbox[0][1], bbox[0][2]];
  points[5] = [bbox[1][0], bbox[0][1], bbox[1][2]];
  points[6] = [bbox[1][0], bbox[1][1], bbox[0][2]];
  points[7] = bbox[1];

  for (var i = 0; i < 6; ++i) {
    var in_count = 8;
    var point_in = 1;

    for (var j = 0; j < 8; ++j) {
      if (this._planes[i].classify_point(points[j]) === -1) {
        point_in = 0;
        --in_count;
      } //if
    } //for j
    this.last_in[i] = point_in;

    //OUT
    if (in_count === 0) {
      return -1;
    }

    total_in += point_in;
  } //for i
  //IN
  if (total_in === 6) {
    return 1;
  }

  return 0;
}; //Frustum::contains_box

function Camera(width, height, fov, nearclip, farclip) {
  this.frustum = new Frustum();

  this.position = [0, 0, 0];
  this.rotation = [0, 0, 0];
  this.target = [0, 0, 0];
  this.fov = (fov !== undef) ? fov : 60.0;
  this.nearclip = (nearclip !== undef) ? nearclip : 0.1;
  this.farclip = (farclip !== undef) ? farclip : 400.0;
  this.targeted = true;
  this.targetSceneObject = null;
  this.motion = null;
  this.transform = new Transform();

  this.manual = false;

  this.setDimensions((width !== undef) ? width : 512, (height !== undef) ? height : 512);

  this.mvMatrix = cubicvr_identity;
  this.pMatrix = null;
  this.calcProjection();
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
  }
  /*
  switch (controllerId) {
  case enums.motion.ROT:
    this.rotation[motionId] = value;
    break;
  case enums.motion.POS:
    this.position[motionId] = value;
    break;
  case enums.motion.FOV:
    this.setFOV(value);
    break;
  }
  */
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
  this.pMatrix = mat4.perspective(this.fov, this.aspect, this.nearclip, this.farclip);
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

    // console.log(this.rotation);
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


Camera.prototype.setFOV = function(fov) {
  this.fov = fov;
  this.calcProjection();
};

Camera.prototype.setLENS = function(lens) {
  this.setFOV(2.0*Math.atan(16.0/lens)*(180.0/M_PI));
};

Camera.prototype.lookat = function(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ) {
  this.mvMatrix = mat4.lookat(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ);
  this.frustum.extract(this, this.mvMatrix, this.pMatrix);
};


Camera.prototype.getRayTo = function(x, y) {
  var rayFrom = this.position;
  var rayForward = vec3.multiply(vec3.normalize(vec3.subtract(this.target, this.position)), this.farclip);

  var rightOffset = [0, 0, 0];
  var vertical = [0, 1, 0];

  var hor;

  hor = vec3.normalize(vec3.cross(rayForward, vertical));

  vertical = vec3.normalize(vec3.cross(hor, rayForward));

  var tanfov = Math.tan(0.5 * (this.fov * (M_PI / 180.0)));

  var aspect = this.width / this.height;

  hor = vec3.multiply(hor, 2.0 * this.farclip * tanfov);
  vertical = vec3.multiply(vertical, 2.0 * this.farclip * tanfov);

  if (vec3.length(hor) < vec3.length(vertical)) {
    hor = vec3.multiply(hor, aspect);
  } else {
    vertical = vec3.multiply(vertical, 1.0 / aspect);
  }

  var rayToCenter = vec3.add(rayFrom, rayForward);
  var dHor = vec3.multiplyant(hor, 1.0 / this.width);
  var dVert = vec3.multiplyant(vertical, 1.0 / this.height);


  var rayTo = vec3.add(rayToCenter, vec3.add(vec3.multiply(hor, -0.5), vec3.multiply(vertical, 0.5)));
  rayTo = vec3.add(rayTo, vec3.multiply(dHor, x));
  rayTo = vec3.add(rayTo, vec3.multiply(dVert, -y));

  return rayTo;
};

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
  this.camPath = new Motion();
  this.targetPath = new Motion();

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

function Scene(width, height, fov, nearclip, farclip, octree) {
  this.frames = 0;

  this.sceneObjects = [];
  this.sceneObjectsByName = [];
  this.sceneObjectsById = [];
  this.lights = [];
  this.global_lights = [];
  this.dynamic_lights = [];
  this.pickables = [];
  this.octree = octree;
  this.skybox = null;
  this.camera = new Camera(width, height, fov, nearclip, farclip);
  this._workers = null;
  this._parallelized = false;
  this.stats = [];
  this.collect_stats = false;
}

Scene.prototype.attachOcTree = function(octree) {
  this.octree = octree;
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
      AABB_reset(obj.octree_aabb, obj.position);
      this.octree.insert(obj);
    } //for
  } //if
} //Scene::attachOcTree

Scene.prototype.parallelize = function() {
  this._parallelized = true;
  this._workers = [];
  if (this.octree !== undef) {
    this._workers["octree"] = new CubicVR_Worker("octree");
    this._workers["octree"].start();
    this.octree = new OcTreeWorkerProxy(this._workers["octree"], this.camera, this.octree, this);
    this.camera.frustum = new FrustumWorkerProxy(this._workers["octree"], this.camera);
  } //if
}; //Scene.parallelize
Scene.prototype.setSkyBox = function(skybox) {
  this.skybox = skybox;
  //this.bindSceneObject(skybox.scene_object, null, false);
};

Scene.prototype.getSceneObject = function(name) {
  return this.sceneObjectsByName[name];
};

Scene.prototype.bindSceneObject = function(sceneObj, pickable, use_octree) {
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
    AABB_reset(sceneObj.octree_aabb, sceneObj.position);
    this.octree.insert(sceneObj);
  } //if
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
};

Scene.prototype.bindCamera = function(cameraObj) {
  this.camera = cameraObj;
};


Scene.prototype.evaluate = function(index) {
  for (var i = 0, iMax = this.sceneObjects.length; i < iMax; i++) {
    if (this.sceneObjects[i].motion === null) {
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
};

Scene.prototype.renderSceneObjectChildren = function(sceneObj) {
  var gl = GLCore.gl;
  var sflip = false;

  for (var i = 0, iMax = sceneObj.children.length; i < iMax; i++) {
      sceneObj.children[i].doTransform(sceneObj.tMatrix);

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

      cubicvr_renderObject(sceneObj.children[i].obj, this.camera.mvMatrix, this.camera.pMatrix, sceneObj.children[i].tMatrix, this.lights);

      if (sflip) {
        gl.cullFace(gl.BACK);
      }

      if (sceneObj.children[i].children !== null) {
        this.renderSceneObjectChildren(sceneObj.children[i]);
      }
  }
};

Scene.prototype.render = function() {
  ++this.frames;

  var gl = GLCore.gl;
  var frustum_hits;

  if (this.camera.manual===false)
  {    
    if (this.camera.targeted) {
      this.camera.lookat(this.camera.position[0], this.camera.position[1], this.camera.position[2], this.camera.target[0], this.camera.target[1], this.camera.target[2], 0, 1, 0);
    } else {
      this.camera.calcProjection();
    }
  }  

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
        lights = [emptyLight];
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

      cubicvr_renderObject(scene_object.obj, this.camera.mvMatrix, this.camera.pMatrix, scene_object.tMatrix, lights);

      if (sflip) {
        gl.cullFace(gl.BACK);
      }

      sflip = false;
    } //if
  
    if (scene_object.children !== null) {
      this.renderSceneObjectChildren(scene_object);
    } //if
  } //for
  
  if (this.collect_stats) {
    this.stats['objects.num_rendered'] = objects_rendered;
    this.stats['lights.num_rendered'] = lights_rendered;
    this.stats['lights.rendered'] = lights_list;
    this.stats['lights.num_global'] = this.global_lights.length;
    this.stats['lights.num_dynamic'] = this.dynamic_lights.length;
  } //if

  if (this.skybox !== null) {
    gl.cullFace(gl.FRONT);
    var size = (this.camera.farclip * 2) / Math.sqrt(3.0);
    this.skybox.scene_object.position = [this.camera.position[0], this.camera.position[1], this.camera.position[2]];
    this.skybox.scene_object.scale = [size, size, size];
    this.skybox.scene_object.doTransform();
    cubicvr_renderObject(this.skybox.scene_object.obj, this.camera.mvMatrix, this.camera.pMatrix, this.skybox.scene_object.tMatrix, []);
    gl.cullFace(gl.BACK);
  } //if
};


Scene.prototype.bbRayTest = function(pos, ray, axisMatch) {
  var pt1, pt2;
  var selList = [];

  if (ray.length === 2) {
    ray = this.camera.getRayTo(ray[0], ray[1]);
  }

  pt1 = pos;
  pt2 = vec3.add(pos, ray);

  var i = 0;

  for (var obj_i in this.pickables) {
    if (this.pickables.hasOwnProperty(obj_i)) {
      var obj = this.pickables[obj_i];

      var bb1, bb2;

      bb1 = obj.aabb[0];
      bb2 = obj.aabb[1];

      var center = vec3.multiply(vec3.add(bb1, bb2), 0.5);

      var testPt = vec3.get_closest_to(pt1, pt2, center);

      var testDist = vec3.length(vec3.subtract(testPt, center));

      if (((testPt[0] >= bb1[0] && testPt[0] <= bb2[0]) ? 1 : 0) + ((testPt[1] >= bb1[1] && testPt[1] <= bb2[1]) ? 1 : 0) + ((testPt[2] >= bb1[2] && testPt[2] <= bb2[2]) ? 1 : 0) >= axisMatch) {
        selList[testDist] = obj;
      }
    }
  }

  return selList;
};

function cubicvr_loadMesh(meshUrl, prefix) {
  if (MeshPool[meshUrl] !== undef) {
    return MeshPool[meshUrl];
  }

  var i, j, p, iMax, jMax, pMax;

  var obj = new Mesh();
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
    var mat = new Material(matName);

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
      tex = (Texture_ref[texName] !== undef) ? Textures_obj[Texture_ref[texName]] : (new Texture(texName));
      mat.setTexture(tex, enums.texture.map.COLOR);
    }

    if (melem.getElementsByTagName("texture_luminosity").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_luminosity")[0].firstChild.nodeValue;
      tex = (Texture_ref[texName] !== undef) ? Textures_obj[Texture_ref[texName]] : (new Texture(texName));
      mat.setTexture(tex, enums.texture.map.AMBIENT);
    }

    if (melem.getElementsByTagName("texture_normal").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_normal")[0].firstChild.nodeValue;
      tex = (Texture_ref[texName] !== undef) ? Textures_obj[Texture_ref[texName]] : (new Texture(texName));
      mat.setTexture(tex, enums.texture.map.NORMAL);
    }

    if (melem.getElementsByTagName("texture_specular").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_specular")[0].firstChild.nodeValue;
      tex = (Texture_ref[texName] !== undef) ? Textures_obj[Texture_ref[texName]] : (new Texture(texName));
      mat.setTexture(tex, enums.texture.map.SPECULAR);
    }

    if (melem.getElementsByTagName("texture_bump").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_bump")[0].firstChild.nodeValue;
      tex = (Texture_ref[texName] !== undef) ? Textures_obj[Texture_ref[texName]] : (new Texture(texName));
      mat.setTexture(tex, enums.texture.map.BUMP);
    }

    if (melem.getElementsByTagName("texture_envsphere").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_envsphere")[0].firstChild.nodeValue;
      tex = (Texture_ref[texName] !== undef) ? Textures_obj[Texture_ref[texName]] : (new Texture(texName));
      mat.setTexture(tex, enums.texture.map.ENVSPHERE);
    }

    if (melem.getElementsByTagName("texture_alpha").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_alpha")[0].firstChild.nodeValue;
      tex = (Texture_ref[texName] !== undef) ? Textures_obj[Texture_ref[texName]] : (new Texture(texName));
      mat.setTexture(tex, enums.texture.map.ALPHA);
    }

    var uvSet = null;

    if (melem.getElementsByTagName("uvmapper").length) {
      var uvm = new UVMapper();
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

    if (triangles.length) {
      for (p = 0, pMax = seglist.length; p < pMax; p += 2) {
        var currentSegment = seglist[p];
        var totalPts = seglist[p + 1] * 3;

        obj.setSegment(currentSegment);
        obj.setFaceMaterial(mat);

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

  MeshPool[meshUrl] = obj;

  return obj;
}







function cubicvr_loadScene(sceneUrl, model_prefix, image_prefix) {
  if (model_prefix === undef) {
    model_prefix = "";
  }
  if (image_prefix === undef) {
    image_prefix = "";
  }

  var obj = new Mesh();
  var scene = util.getXML(sceneUrl);

  var sceneOut = new Scene();

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

      var sceneObject = new SceneObject(obj, name);

      if (cubicvr_isMotion(position)) {
        if (!sceneObject.motion) {
          sceneObject.motion = new Motion();
        }
        cubicvr_nodeToMotion(position, enums.motion.POS, sceneObject.motion);
      } else if (position) {
        sceneObject.position = util.floatDelimArray(util.collectTextNode(position));
      }

      if (cubicvr_isMotion(rotation)) {
        if (!sceneObject.motion) {
          sceneObject.motion = new Motion();
        }
        cubicvr_nodeToMotion(rotation, enums.motion.ROT, sceneObject.motion);
      } else {
        sceneObject.rotation = util.floatDelimArray(util.collectTextNode(rotation));
      }

      if (cubicvr_isMotion(scale)) {
        if (!sceneObject.motion) {
          sceneObject.motion = new Motion();
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
        cam.motion = new Motion();
      }
      cubicvr_nodeToMotion(position, enums.motion.POS, cam.motion);
    } else if (position) {
      cam.position = util.floatDelimArray(position.firstChild.nodeValue);
    }

    if (cubicvr_isMotion(rotation)) {
      if (!cam.motion) {
        cam.motion = new Motion();
      }
      cubicvr_nodeToMotion(rotation, enums.motion.ROT, cam.motion);
    } else if (rotation) {
      cam.rotation = util.floatDelimArray(rotation.firstChild.nodeValue);
    }

    if (cubicvr_isMotion(fov)) {
      if (!cam.motion) {
        cam.motion = new Motion();
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
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  }

  //  GL_DEPTH_COMPONENT32 0x81A7
  //  if (depth_enabled) { gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT, w, h); }
  if (depth_enabled) {
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
  }

  // init texture
  this.texture = new Texture();
  gl.bindTexture(gl.TEXTURE_2D, Textures[this.texture.tex_id]);

  // configure texture params
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // clear buffer
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, Textures[this.texture.tex_id], 0);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

RenderBuffer.prototype.destroyBuffer = function() {
  var gl = GLCore.gl;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteRenderbuffer(this.depth);
  gl.deleteFramebuffer(this.fbo);
  gl.deleteTexture(Textures[this.texture.tex_id]);
  Textures[this.texture.tex_id] = null;
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



function PostProcessFX(width, height) {
  this.bloom = true;

  this.renderBuffer = new RenderBuffer(width, height, true);
  this.blurBuffer = new RenderBuffer(width, height, false);
  this.bloomBuffer = new RenderBuffer(parseInt(width / 6, 10), parseInt(height / 6, 10), false);

  this.copyShader = new Shader("attribute vec3 aVertex;\n" + "attribute vec2 aTex;\n" + "varying vec2 vTex;\n" + "void main(void)\n" + "{\n" + "vTex = aTex;\n" + "vec4 vPos = vec4(aVertex.xyz,1.0);\n" + "gl_Position = vPos;\n" + "}\n", "#ifdef GL_ES\nprecision highp float;\n#endif\n" + "uniform sampler2D srcTex;\n" + "varying vec2 vTex;\n" + "void main(void)\n" + "{\n" + "gl_FragColor = texture2D(srcTex, vTex);\n" + "}\n");


  this.copyShader.use();
  this.copyShader.addUVArray("aTex");
  this.copyShader.addVertexArray("aVertex");
  this.copyShader.addInt("srcTex", 0);

  this.fsQuad = this.makeFSQuad(width, height);

  this.bloomShader = new Shader("attribute vec3 aVertex;\n" + "attribute vec2 aTex;\n" + "varying vec2 vTex;\n" + "void main(void)\n" + "{\n" + "vTex = aTex;\n" + "vec4 vPos = vec4(aVertex.xyz,1.0);\n" + "gl_Position = vPos;\n" + "}\n",

  "#ifdef GL_ES\nprecision highp float;\n#endif\n" + "uniform sampler2D srcTex;\n" + "uniform vec3 texel_ofs;\n" + "varying vec2 vTex;\n" + "vec3 rangeValHDR(vec3 src)\n" + "{\n" + "return (src.r>0.90||src.g>0.90||src.b>0.90)?(src):vec3(0.0,0.0,0.0);\n" + "}\n" + "vec4 hdrSample(float rad)\n" + "{\n" + "vec3 accum;\n" + "float radb = rad*0.707106781;\n" + "accum =  rangeValHDR(texture2D(srcTex, vec2(vTex.s+texel_ofs.x*rad,  vTex.t)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s,          vTex.t+texel_ofs.y*rad)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s-texel_ofs.x*rad,  vTex.t)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s,          vTex.t-texel_ofs.y*rad)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s+texel_ofs.x*radb, vTex.t+texel_ofs.y*radb)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s-texel_ofs.x*radb, vTex.t-texel_ofs.y*radb)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s+texel_ofs.x*radb, vTex.t-texel_ofs.y*radb)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s-texel_ofs.x*radb, vTex.t+texel_ofs.y*radb)).rgb);\n" + "accum /= 8.0;\n" + "return vec4(accum,1.0);\n" + "}\n" + "void main(void)\n" + "{\n" + "vec4 color;\n" + "color = hdrSample(2.0);\n" + "color += hdrSample(8.0);\n" + "color += hdrSample(12.0);\n" + "gl_FragColor = color/2.0;\n" + "}\n");

  this.bloomShader.use();
  this.bloomShader.addUVArray("aTex");
  this.bloomShader.addVertexArray("aVertex");
  this.bloomShader.addInt("srcTex", 0);
  this.bloomShader.addVector("texel_ofs");
  this.bloomShader.setVector("texel_ofs", [1.0 / this.renderBuffer.sizeParam(width), 1.0 / this.renderBuffer.sizeParam(height), 0]);

  this.fsQuadBloom = this.makeFSQuad(this.bloomBuffer.width, this.bloomBuffer.height);

  this.blurShader = new Shader("attribute vec3 aVertex;\n" + "attribute vec2 aTex;\n" + "varying vec2 vTex;\n" + "void main(void)\n" + "{\n" + "vTex = aTex;\n" + "vec4 vPos = vec4(aVertex.xyz,1.0);\n" + "gl_Position = vPos;\n" + "}\n", "#ifdef GL_ES\nprecision highp float;\n#endif\n" + "uniform sampler2D srcTex;\n" + "varying vec2 vTex;\n" + "uniform float opacity;\n" + "void main(void)\n" + "{\n" + "gl_FragColor = vec4(texture2D(srcTex, vTex).rgb, opacity);\n" + "}\n");

  this.blurShader.use();
  this.blurShader.addUVArray("aTex");
  this.blurShader.addVertexArray("aVertex");
  this.blurShader.addInt("srcTex", 0);
  this.blurShader.addFloat("opacity");
  this.blurOpacity = 0.1;


  var gl = GLCore.gl;

  this.blurBuffer.use();
  gl.clear(gl.COLOR_BUFFER_BIT);
  this.end();
}

PostProcessFX.prototype.resize = function(width, height) {
  this.renderBuffer.destroyBuffer();
  this.blurBuffer.destroyBuffer();
  this.bloomBuffer.destroyBuffer();
  this.renderBuffer.createBuffer(width, height, true);
  this.blurBuffer.createBuffer(width, height, false);
  this.bloomBuffer.createBuffer(parseInt(width / 6, 10), parseInt(height / 6, 10), false);

  this.bloomShader.use();
  this.bloomShader.setVector("texel_ofs", [1.0 / this.renderBuffer.sizeParam(width), 1.0 / this.renderBuffer.sizeParam(height), 0]);

  this.destroyFSQuad(this.fsQuad);
  this.fsQuad = this.makeFSQuad(width, height);
  this.destroyFSQuad(this.fsQuadBloom);
  this.fsQuadBloom = this.makeFSQuad(this.bloomBuffer.width, this.bloomBuffer.height);
};

PostProcessFX.prototype.begin = function() {
  this.renderBuffer.use();
};

PostProcessFX.prototype.end = function() {
  var gl = GLCore.gl;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  //  if (this.depth !== null) { gl.bindRenderbuffer(gl.RENDERBUFFER, null); }
};

PostProcessFX.prototype.makeFSQuad = function(width, height) {
  var gl = GLCore.gl;
  var fsQuad = []; // intentional empty object
  var w = this.renderBuffer.sizeParam(width);
  var h = this.renderBuffer.sizeParam(height);

  var uscale = (width / w);
  var vscale = (height / h);

  // fsQuad.addPoint([[-1,-1,0],[1, -1, 0],[1, 1, 0],[-1, 1, 0]]);
  // var faceNum = fsQuad.addFace([0,1,2,3]);
  // fsQuad.faces[faceNum].setUV([[0, 0],[uscale, 0],[uscale, vscale],[0, vscale]]);
  // fsQuad.triangulateQuads();
  // fsQuad.calcNormals();
  // fsQuad.compile();
  fsQuad.vbo_points = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0]);
  fsQuad.vbo_uvs = new Float32Array([0, 0, uscale, 0, uscale, vscale, 0, vscale, 0, 0, uscale, vscale]);

  fsQuad.gl_points = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fsQuad.gl_points);
  gl.bufferData(gl.ARRAY_BUFFER, fsQuad.vbo_points, gl.STATIC_DRAW);

  fsQuad.gl_uvs = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fsQuad.gl_uvs);
  gl.bufferData(gl.ARRAY_BUFFER, fsQuad.vbo_uvs, gl.STATIC_DRAW);


  return fsQuad;
};

PostProcessFX.prototype.destroyFSQuad = function(fsQuad) {
  var gl = GLCore.gl;

  gl.deleteBuffer(fsQuad.gl_points);
  gl.deleteBuffer(fsQuad.gl_uvs);
};

PostProcessFX.prototype.renderFSQuad = function(shader, fsq) {
  var gl = GLCore.gl;

  shader.init(true);
  shader.use();

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, fsq.gl_points);
  gl.vertexAttribPointer(shader.uniforms["aVertex"], 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, fsq.gl_uvs);
  gl.vertexAttribPointer(shader.uniforms["aTex"], 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  shader.init(false);
};

PostProcessFX.prototype.render = function() {
  var gl = GLCore.gl;

  gl.disable(gl.DEPTH_TEST);

  this.renderBuffer.texture.use(gl.TEXTURE0);
  this.copyShader.use();
  this.copyShader.setInt("srcTex", 0);

  this.renderFSQuad(this.copyShader, this.fsQuad);

  if (this.blur) {
    this.renderBuffer.texture.use(gl.TEXTURE0);
    this.blurShader.use();
    this.blurShader.setInt("srcTex", 0);
    this.blurShader.setFloat("opacity", this.blurOpacity);

    this.blurBuffer.use();
    gl.enable(gl.BLEND);
    gl.depthMask(0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.renderFSQuad(this.blurShader, this.fsQuad);
    gl.disable(gl.BLEND);
    gl.depthMask(1);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.end();

    this.blurBuffer.texture.use(gl.TEXTURE0);

    this.blurShader.setFloat("opacity", 0.5);

    gl.enable(gl.BLEND);
    gl.depthMask(0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.renderFSQuad(this.blurShader, this.fsQuad);

    gl.disable(gl.BLEND);
    gl.depthMask(1);
    gl.blendFunc(gl.ONE, gl.ONE);
  }

  if (this.bloom) {
    this.renderBuffer.texture.use(gl.TEXTURE0);

    gl.viewport(0, 0, this.bloomBuffer.width, this.bloomBuffer.height);

    this.bloomShader.use();
    this.bloomShader.setInt("srcTex", 0);

    this.bloomBuffer.use();
    this.renderFSQuad(this.bloomShader, this.fsQuad);
    this.end();

    this.bloomBuffer.texture.use(gl.TEXTURE0);
    this.copyShader.use();
    this.copyShader.setInt("srcTex", 0);

    gl.viewport(0, 0, this.renderBuffer.width, this.renderBuffer.height);

    gl.enable(gl.BLEND);
    gl.depthMask(0);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);

    this.renderFSQuad(this.copyShader, this.fsQuadBloom);

    gl.disable(gl.BLEND);
    gl.depthMask(1);
    gl.blendFunc(gl.ONE, gl.ONE);

  }

  gl.enable(gl.DEPTH_TEST);
};

/*
    PostProcessShader:
    
    shaderInfo
    {
      enabled: enabled (default true)
      shader_vertex: id or url for vertex shader
      shader_fragment: id or url for fragment shader
      outputMode: method of output for this shader
      init: function to perform to initialize shader
      onresize: function to perform on resize; params ( shader, width, height )
      onupdate: function to perform on update; params ( shader )
      outputDivisor: use custom output buffer size, divisor of (outputDivisor) eg. 1 (default) = 1024x768, 2 = 512x384, 3 = 256x192
    }

  */

var postProcessDivisorBuffers = [];
var postProcessDivisorQuads = [];

function PostProcessShader(shaderInfo) {
  if (shaderInfo.shader_vertex === undef) {
    return null;
  }
  if (shaderInfo.shader_fragment === undef) {
    return null;
  }

  this.outputMode = (shaderInfo.outputMode === undef) ? enums.post.output.REPLACE : shaderInfo.outputMode;
  this.onresize = (shaderInfo.onresize === undef) ? null : shaderInfo.onresize;
  this.onupdate = (shaderInfo.onupdate === undef) ? null : shaderInfo.onupdate;
  this.init = (shaderInfo.init === undef) ? null : shaderInfo.init;
  this.enabled = (shaderInfo.enabled === undef) ? true : shaderInfo.enabled;
  this.outputDivisor = (shaderInfo.outputDivisor === undef) ? 1 : shaderInfo.outputDivisor;

  this.shader = new Shader(shaderInfo.shader_vertex, shaderInfo.shader_fragment);
  this.shader.use();

  // set defaults
  this.shader.addUVArray("aTex");
  this.shader.addVertexArray("aVertex");
  this.shader.addInt("srcTex", 0);
  this.shader.addInt("captureTex", 1);
  this.shader.addVector("texel");

  if (this.init !== null) {
    this.init(this.shader);
  }
}

/* New post-process shader chain -- to replace postProcessFX */

function PostProcessChain(width, height, accum) {
  var gl = GLCore.gl;

  this.width = width;
  this.height = height;
  this.accum = (accum === undef)?false:true;
  this.vTexel = [1.0 / this.width, 1.0 / this.height, 0];

  // buffers
  this.captureBuffer = new RenderBuffer(width, height, true);
  this.bufferA = new RenderBuffer(width, height, false);
  this.bufferB = new RenderBuffer(width, height, false);
  this.bufferC = new RenderBuffer(width, height, false);

  this.accumOpacity = 1.0;
  this.accumIntensity = 0.3;
  
  if (this.accum) {
    this.accumBuffer = new RenderBuffer(width, height, false);
    this.accumBuffer.use();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    this.blur_shader = new PostProcessShader({
      shader_vertex: ["attribute vec3 aVertex;",
                      "attribute vec2 aTex;",
                      "varying vec2 vTex;",
                      "void main(void)",
                      "{",
                        "vTex = aTex;",
                        "vec4 vPos = vec4(aVertex.xyz,1.0);",
                        "gl_Position = vPos;",
                        "}"].join("\n"),
      shader_fragment: ["#ifdef GL_ES",
                        "precision highp float;",
                        "#endif",
                        "uniform sampler2D srcTex;",
                        "varying vec2 vTex;",
                        "uniform float opacity;",
                        "void main(void)",
                        "{ gl_FragColor = vec4(texture2D(srcTex, vTex).rgb, opacity);",
                        "}"].join("\n"),
      init: function(shader) {
		    shader.addFloat("opacity");
		    shader.setFloat("opacity",1.0);
		  }});
  }

  this.bufferA.use();

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  this.bufferB.use();

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  this.end();

  // quad
  this.fsQuad = this.makeFSQuad(this.width, this.height);

  this.shaders = [];

  this.copy_shader = new PostProcessShader({
    shader_vertex: ["attribute vec3 aVertex;",
                "attribute vec2 aTex;",
                "varying vec2 vTex;",
                "void main(void) {",
                  "vTex = aTex;",
                  "vec4 vPos = vec4(aVertex.xyz,1.0);",
                  "gl_Position = vPos;",
                "}"].join("\n"),
    shader_fragment: [
      "#ifdef GL_ES",
      "precision highp float;",
      "#endif",
      "uniform sampler2D srcTex;",
      "varying vec2 vTex;",
      "void main(void) {",
        "gl_FragColor = texture2D(srcTex, vTex);",
      "}"].join("\n")
  });

  this.resize(width, height);
}

PostProcessChain.prototype.setBlurOpacity = function (opacity)
{  
  this.accumOpacity = opacity;
}

PostProcessChain.prototype.setBlurIntensity = function (intensity)
{  
  this.accumIntensity = intensity;
}


PostProcessChain.prototype.makeFSQuad = function(width, height) {
  var gl = GLCore.gl;
  var fsQuad = []; // intentional empty object
  var w = width;
  var h = height;

  var uscale = (width / w);
  var vscale = (height / h);

  fsQuad.vbo_points = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0]);
  fsQuad.vbo_uvs = new Float32Array([0, 0, uscale, 0, uscale, vscale, 0, vscale, 0, 0, uscale, vscale]);

  fsQuad.gl_points = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fsQuad.gl_points);
  gl.bufferData(gl.ARRAY_BUFFER, fsQuad.vbo_points, gl.STATIC_DRAW);

  fsQuad.gl_uvs = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fsQuad.gl_uvs);
  gl.bufferData(gl.ARRAY_BUFFER, fsQuad.vbo_uvs, gl.STATIC_DRAW);


  return fsQuad;
};

PostProcessChain.prototype.destroyFSQuad = function(fsQuad) {
  var gl = GLCore.gl;

  gl.deleteBuffer(fsQuad.gl_points);
  gl.deleteBuffer(fsQuad.gl_uvs);
};

PostProcessChain.prototype.renderFSQuad = function(shader, fsq) {
  var gl = GLCore.gl;

  shader.init(true);
  shader.use();

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, fsq.gl_points);
  gl.vertexAttribPointer(shader.uniforms["aVertex"], 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, fsq.gl_uvs);
  gl.vertexAttribPointer(shader.uniforms["aTex"], 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  shader.init(false);
};


PostProcessChain.prototype.addShader = function(shader) {
  this.shaders[this.shaders.length] = shader;
  if (shader.outputDivisor && shader.outputDivisor != 1)
  {
    if (postProcessDivisorBuffers[shader.outputDivisor] === undef)
    
    var divw = parseInt(this.width/shader.outputDivisor);
    var divh = parseInt(this.height/shader.outputDivisor);
    
    postProcessDivisorBuffers[shader.outputDivisor] = new RenderBuffer(divw, divh, false);  
    postProcessDivisorQuads[shader.outputDivisor] = this.makeFSQuad(divw, divh);
  }
};

PostProcessChain.prototype.resize = function(width, height) {
  this.width = width;
  this.height = height;

  this.vTexel = [1.0 / this.width, 1.0 / this.height, 0];

  this.captureBuffer.destroyBuffer();
  this.captureBuffer.createBuffer(this.width, this.height, true);

  this.bufferA.destroyBuffer();
  this.bufferA.createBuffer(this.width, this.height, false);

  this.bufferB.destroyBuffer();
  this.bufferB.createBuffer(this.width, this.height, false);

  this.bufferC.destroyBuffer();
  this.bufferC.createBuffer(this.width, this.height, false);

  if (this.accum) {
    this.accumBuffer.destroyBuffer();
    this.accumBuffer.createBuffer(this.width, this.height, false);
    this.accumBuffer.use();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  for (var p in postProcessDivisorBuffers)
  {
    var divw = parseInt(this.width/p);
    var divh = parseInt(this.height/p);

    postProcessDivisorBuffers[p].destroyBuffer();
    postProcessDivisorBuffers[p].createBuffer(divw, divh, false); 

    this.destroyFSQuad(postProcessDivisorQuads[p]);
    postProcessDivisorQuads[p] = this.makeFSQuad(divw, divh);            
  }

  this.inputBuffer = this.bufferA;
  this.outputBuffer = this.bufferB;

  for (var i = 0, iMax = this.shaders.length; i < iMax; i++) {
    this.shaders[i].shader.use();
    this.shaders[i].shader.setVector("texel", this.vTexel);
    if (this.shaders[i].onresize !== null) {
      this.shaders[i].onresize(this.shaders[i].shader, this.width, this.height);
    }
  }

  this.destroyFSQuad(this.fsQuad);
  this.fsQuad = this.makeFSQuad(this.width, this.height);
};

PostProcessChain.prototype.swap = function() {
  var t = this.inputBuffer;

  this.inputBuffer = this.outputBuffer;
  this.outputBuffer = t;
};

PostProcessChain.prototype.begin = function() {
  this.captureBuffer.use();
};

PostProcessChain.prototype.end = function() {
  var gl = GLCore.gl;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

PostProcessChain.prototype.render = function() {
  var gl = GLCore.gl;

  var initBuffer = null;

  this.captureBuffer.texture.use(gl.TEXTURE1);

  this.outputBuffer.use();
  this.captureBuffer.texture.use(gl.TEXTURE0);
  this.renderFSQuad(this.copy_shader.shader, this.fsQuad);
  this.end();

  var c = 0;
  for (var i = 0, iMax = this.shaders.length; i < iMax; i++) {
    var s = this.shaders[i];
    if (!s.enabled) {
      continue;
    }
    this.swap();
    this.inputBuffer.texture.use(gl.TEXTURE0);

    switch (s.outputMode) {
    case enums.post.output.REPLACE:
      if (s.outputDivisor !== 1)
      {
        postProcessDivisorBuffers[s.outputDivisor].use();
      }
      else
      {
        this.outputBuffer.use();
      }
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      break;
    case enums.post.output.ADD:
    case enums.post.output.BLEND:
      if (s.outputDivisor !== 1)
      {
        postProcessDivisorBuffers[s.outputDivisor].use();
      }
      else
      {
        this.bufferC.use();        
      }

      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      break;
    }

    if (s.onupdate !== null) {
      s.shader.use();
      s.onupdate(s.shader);
    }

    if (s.outputDivisor !== 1)
    {
      gl.viewport(0, 0, postProcessDivisorBuffers[s.outputDivisor].width, postProcessDivisorBuffers[s.outputDivisor].height);

      this.renderFSQuad(s.shader, postProcessDivisorQuads[s.outputDivisor]);

      if (s.outputMode === enums.post.output.REPLACE)
      {
        this.outputBuffer.use();

        postProcessDivisorBuffers[s.outputDivisor].texture.use(gl.TEXTURE0);

        gl.viewport(0, 0, this.width, this.height);

        this.renderFSQuad(this.copy_shader.shader, this.fsQuad);
      }
      else
      {
        gl.viewport(0, 0, this.width, this.height);        
      }
    }
    else
    {
      this.renderFSQuad(s.shader, this.fsQuad);      
    }

    switch (s.outputMode) {
    case enums.post.output.REPLACE:
      break;
    case enums.post.output.BLEND:
      this.swap();
      this.outputBuffer.use();

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      this.inputBuffer.texture.use(gl.TEXTURE0);

      if (s.outputDivisor !== 1)
      {
        postProcessDivisorBuffers[s.outputDivisor].texture.use(gl.TEXTURE0);
      }
      else
      {
        this.bufferC.texture.use(gl.TEXTURE0);
      } 

      this.renderFSQuad(this.copy_shader.shader, this.fsQuad);

      gl.disable(gl.BLEND);
      break;
    case enums.post.output.ADD:
      this.swap();
      this.outputBuffer.use();

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);

      if (s.outputDivisor !== 1)
      {
        postProcessDivisorBuffers[s.outputDivisor].texture.use(gl.TEXTURE0);
      }
      else
      {
        this.bufferC.texture.use(gl.TEXTURE0);
      } 

      this.renderFSQuad(this.copy_shader.shader, this.fsQuad);

      gl.disable(gl.BLEND);
      break;
    }

    this.end();
    c++;
  }

  if (c === 0) {
    this.captureBuffer.texture.use(gl.TEXTURE0);
  } else {
    this.outputBuffer.texture.use(gl.TEXTURE0);
  }

  if (this.accum && this.accumOpacity !== 1.0)
  {
    this.blur_shader.shader.use();
    this.blur_shader.shader.setFloat("opacity",this.accumOpacity);

    this.accumBuffer.use();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);

    this.renderFSQuad(this.blur_shader.shader, this.fsQuad);

    this.end();

    gl.disable(gl.BLEND);

    this.renderFSQuad(this.copy_shader.shader, this.fsQuad);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    
    this.blur_shader.shader.use();
    this.blur_shader.shader.setFloat("opacity",this.accumIntensity);
    
    this.accumBuffer.texture.use(gl.TEXTURE0);
    
    this.renderFSQuad(this.blur_shader.shader, this.fsQuad);
    
    gl.disable(gl.BLEND);
  }
  else
  {
    this.renderFSQuad(this.copy_shader.shader, this.fsQuad);    
  }

};




function cubicvr_loadCollada(meshUrl, prefix) {
  //  if (MeshPool[meshUrl] !== undef) return MeshPool[meshUrl];
  var obj = new Mesh();
  var scene = new Scene();
  var cl = util.getXML(meshUrl);
  var meshes = [];
  var tech;
  var sourceId;
  var materialRef, nameRef, nFace, meshName;

  var norm, vert, uv, computedLen;

  var i, iCount, iMax, iMod, mCount, mMax, k, kMax, cCount, cMax, sCount, sMax, pCount, pMax, j, jMax;

  //  console.log(cl);
  var cl_lib_asset = cl.getElementsByTagName("asset");

  var up_axis = 1; // Y
  if (cl_lib_asset.length) {
    var cl_up_axis = cl_lib_asset[0].getElementsByTagName("up_axis");
    if (cl_up_axis.length) {
      var axisval = util.collectTextNode(cl_up_axis[0]);

      switch (axisval) {
      case "X_UP":
        up_axis = 0;
        break;
      case "Y_UP":
        up_axis = 1;
        break;
      case "Z_UP":
        up_axis = 2;
        break;
      }
    }
  }
  // up_axis=1;
  var fixuaxis = function(v) {
    if (up_axis === 0) { // untested
      return [v[1], v[0], v[2]];
    } else if (up_axis === 1) {
      return v;
    } else if (up_axis === 2) {
      return [v[0], v[2], -v[1]];
    }
  };

  var fixscaleaxis = function(v) {
    if (up_axis === 0) { // untested
      return [v[1], v[0], v[2]];
    } else if (up_axis === 1) {
      return v;
    } else if (up_axis === 2) {
      return [v[0], v[2], v[1]];
    }
  };


  var fixraxis = function(v) {
    if (up_axis === 0) { // untested
      return [v[1], v[0], v[2]];
    } else if (up_axis === 1) {
      return v;
    } else if (up_axis === 2) {
      return [v[0], v[2], -v[1]];
    }
  };

  var fixukaxis = function(mot, chan, val) {
    // if (mot === enums.motion.POS && chan === enums.motion.Y && up_axis === enums.motion.Z) return -val;
    if (mot === enums.motion.POS && chan === enums.motion.Z && up_axis === enums.motion.Z) {
      return -val;
    }
    return val;
  };

  var fixuraxis = function(mot, chan, val) {
    if (mot === enums.motion.ROT && chan === enums.motion.Z && up_axis === enums.motion.Z) {
      return -val;
    }
    // if (mot === enums.motion.ROT && chan === enums.motion.X && up_axis === enums.motion.Z) return val;
    // if (mot === enums.motion.ROT && chan === enums.motion.Z && up_axis === enums.motion.Z) return -val;
    if (mot === enums.motion.ROT && chan === enums.motion.X && up_axis === enums.motion.Z) {
      return -val;
    }
    return val;
  };


  var cl_collada13_lib = cl.getElementsByTagName("library");
  var cl_collada13_libmap = [];
  
  if (cl_collada13_lib.length)
  {
    for (i = 0, iMax = cl_collada13_lib.length; i<iMax; i++)
    {
      cl_collada13_libmap[cl_collada13_lib[i].getAttribute("type")] = [cl_collada13_lib[i]];
    }
  }



  var cl_lib_images = cl.getElementsByTagName("library_images");

  if (!cl_lib_images.length && cl_collada13_lib.length)
  {
    cl_lib_images = cl_collada13_libmap["IMAGE"];
  }
  
  //  console.log(cl_lib_images);
  var imageRef = [];

  if (cl_lib_images.length) {
    var cl_images = cl.getElementsByTagName("image");

    if (cl_images.length) {
      for (var imgCount = 0, imgCountMax = cl_images.length; imgCount < imgCountMax; imgCount++) {
        var cl_img = cl_images[imgCount];
        var imageId = cl_img.getAttribute("id");
        var imageName = cl_img.getAttribute("name");
        var cl_imgsrc = cl_img.getElementsByTagName("init_from");

        if (cl_imgsrc.length) {
          var imageSource = util.collectTextNode(cl_imgsrc[0]);
          
          if (prefix !== undef && (imageSource.lastIndexOf("/")!==-1)) {
            imageSource = imageSource.substr(imageSource.lastIndexOf("/")+1);
          }
          if (prefix !== undef && (imageSource.lastIndexOf("\\")!==-1)) {
            imageSource = imageSource.substr(imageSource.lastIndexOf("\\")+1);
          }
          
          // console.log("Image reference: "+imageSource+" @"+imageId+":"+imageName);
          imageRef[imageId] = {
            source: imageSource,
            id: imageId,
            name: imageName
          };
        }
      }
    }
  }

  var cl_lib_effects = cl.getElementsByTagName("library_effects");

  var effectId;
  var effectsRef = [];
  var effectCount, effectMax;
  var tCount, tMax, inpCount, inpMax;
  var cl_params, cl_13inst, cl_inputs, cl_input, cl_inputmap, cl_samplers, cl_camera, cl_cameras, cl_scene;
  var ofs;


  if (cl_lib_effects.length) {
    var cl_effects = cl_lib_effects[0].getElementsByTagName("effect");

    for (effectCount = 0, effectMax = cl_effects.length; effectCount < effectMax; effectCount++) {
      var cl_effect = cl_effects[effectCount];

      effectId = cl_effect.getAttribute("id");

      var effect = {};

      effect.id = effectId;

      effect.surfaces = [];
      effect.samplers = [];

      cl_params = cl_effect.getElementsByTagName("newparam");

      var params = [];

      var cl_init;

      if (cl_params.length) {
        for (pCount = 0, pMax = cl_params.length; pCount < pMax; pCount++) {
          var cl_param = cl_params[pCount];

          var paramId = cl_param.getAttribute("sid");

          var cl_surfaces = cl_param.getElementsByTagName("surface");
          cl_samplers = cl_param.getElementsByTagName("sampler2D");

          if (cl_surfaces.length) {
            effect.surfaces[paramId] = {};

            cl_init = cl_surfaces[0].getElementsByTagName("init_from");

            if (cl_init.length) {
              var initFrom = util.collectTextNode(cl_init[0]);

              if (typeof(imageRef[initFrom]) === 'object') {
                effect.surfaces[paramId].texture = new Texture(prefix + "/" + imageRef[initFrom].source);
                effect.surfaces[paramId].source = prefix + "/" + imageRef[initFrom].source;
                //                console.log(prefix+"/"+imageRef[initFrom].source);
              }
            }
          } else if (cl_samplers.length) {
            effect.samplers[paramId] = {};

            cl_init = cl_samplers[0].getElementsByTagName("source");

            if (cl_init.length) {
              effect.samplers[paramId].source = util.collectTextNode(cl_init[0]);
            }

            cl_init = cl_samplers[0].getElementsByTagName("minfilter");

            if (cl_init.length) {
              effect.samplers[paramId].minfilter = util.collectTextNode(cl_init[0]);
            }

            cl_init = cl_samplers[0].getElementsByTagName("magfilter");

            if (cl_init.length) {
              effect.samplers[paramId].magfiter = util.collectTextNode(cl_init[0]);
            }
          }

        }
      }

      var cl_technique = cl_effect.getElementsByTagName("technique");

      var getColorNode = (function() {
        return function(n) {
          var el = n.getElementsByTagName("color");
          if (!el.length) {
            return false;
          }

          var cn = util.collectTextNode(el[0]);
          var ar = util.floatDelimArray(cn, " ");

          return ar;
        };
      }());

      var getFloatNode = (function() {
        return function(n) {
          var el = n.getElementsByTagName("float");
          if (!el.length) {
            return false;
          }

          var cn = parseFloat(util.collectTextNode(el[0]));

          return cn;
        };
      }());

      var getTextureNode = (function() {
        return function(n) {
          var el = n.getElementsByTagName("texture");
          if (!el.length) {
            return false;
          }

          var cn = el[0].getAttribute("texture");

          return cn;
        };
      }());

      effect.material = new Material(effectId);

      for (tCount = 0, tMax = cl_technique.length; tCount < tMax; tCount++) {
        //        if (cl_technique[tCount].getAttribute("sid") === 'common') {
        tech = cl_technique[tCount].getElementsByTagName("blinn");

        if (!tech.length) {
          tech = cl_technique[tCount].getElementsByTagName("phong");
        }
        if (!tech.length) {
          tech = cl_technique[tCount].getElementsByTagName("lambert");
        }

        if (tech.length) {
          for (var eCount = 0, eMax = tech[0].childNodes.length; eCount < eMax; eCount++) {
            var node = tech[0].childNodes[eCount];

            if (node.nodeType === 1) {
              var c = getColorNode(node);
              var f = getFloatNode(node);
              var t = getTextureNode(node);

              if (c !== false) {
                if (c.length > 3) {
                  c.pop();
                }
              }

              switch (node.tagName) {
              case "emission":
                if (c !== false) {
                  effect.material.ambient = c;
                }
                break;
              case "ambient":
                break;
              case "diffuse":
                if (c !== false) {
                  effect.material.color = c;
                }
                break;
              case "specular":
                if (c !== false) {
                  effect.material.specular = c;
                }
                break;
              case "shininess":
                if (f !== false) {
                  effect.material.shininess = f;
                }
                break;
              case "reflective":
                break;
              case "reflectivity":
                break;
              case "transparent":
                break;
                //                  case "transparency": if (f!==false) effect.material.opacity = 1.0-f; break;
              case "index_of_refraction":
                break;
              }

              if (t !== false) {
                var srcTex = effect.surfaces[effect.samplers[t].source].texture;
                // console.log(node.tagName+":"+effect.samplers[t].source,srcTex);
                switch (node.tagName) {
                case "emission":
                  effect.material.setTexture(srcTex, enums.texture.map.AMBIENT);
                  break;
                case "ambient":
                  effect.material.setTexture(srcTex, enums.texture.map.AMBIENT);
                  break;
                case "diffuse":
                  effect.material.setTexture(srcTex, enums.texture.map.COLOR);
                  break;
                case "specular":
                  effect.material.setTexture(srcTex, enums.texture.map.SPECULAR);
                  break;
                case "shininess":
                  break;
                case "reflective":
                  effect.material.setTexture(srcTex, enums.texture.map.REFLECT);
                  break;
                case "reflectivity":
                  break;
                case "transparent":
                  effect.material.setTexture(srcTex, enums.texture.map.ALPHA);
                  break;
                case "transparency":
                  break;
                case "index_of_refraction":
                  break;
                }
              }
            }
          }
        }

        effectsRef[effectId] = effect;
        //        console.log(effect,effectId);
      }
    }
  }

  var cl_lib_mat_inst = cl.getElementsByTagName("instance_material");

  var materialMap = [];

  if (cl_lib_mat_inst.length) {
    for (i = 0, iMax = cl_lib_mat_inst.length; i < iMax; i++) {
      var cl_mat_inst = cl_lib_mat_inst[i];

      var symbolId = cl_mat_inst.getAttribute("symbol");
      var targetId = cl_mat_inst.getAttribute("target").substr(1);

      materialMap[symbolId] = targetId;
    }
  }


  var cl_lib_materials = cl.getElementsByTagName("library_materials");

  if (!cl_lib_materials.length && cl_collada13_lib.length)
  {
    cl_lib_materials = cl_collada13_libmap["MATERIAL"];
  }


  var materialsRef = [];

  if (cl_lib_materials.length) {
    var cl_materials = cl.getElementsByTagName("material");

    for (mCount = 0, mMax = cl_materials.length; mCount < mMax; mCount++) {
      var cl_material = cl_materials[mCount];

      var materialId = cl_material.getAttribute("id");
      var materialName = cl_material.getAttribute("name");

      var cl_einst = cl_material.getElementsByTagName("instance_effect");

      if (cl_einst.length) {
        effectId = cl_einst[0].getAttribute("url").substr(1);
        //        console.log(effectId);
        materialsRef[materialId] = {
          id: materialId,
          name: materialName,
          mat: effectsRef[effectId].material
        };
      }
    }
  }

  var cl_lib_geo = cl.getElementsByTagName("library_geometries");

  if (!cl_lib_geo.length && cl_collada13_lib.length)
  {
    cl_lib_geo = cl_collada13_libmap["GEOMETRY"];
  }
 // console.log(cl_lib_geo);

  if (cl_lib_geo.length) {
    for (var geoCount = 0, geoMax = cl_lib_geo.length; geoCount < geoMax; geoCount++) {
      var cl_geo = cl_lib_geo[geoCount];

      var cl_geo_node = cl_geo.getElementsByTagName("geometry");

      if (cl_geo_node.length) {
        for (var meshCount = 0, meshMax = cl_geo_node.length; meshCount < meshMax; meshCount++) {
          var cl_geomesh = cl_geo_node[meshCount].getElementsByTagName("mesh");

          var meshId = cl_geo_node[meshCount].getAttribute("id");
          meshName = cl_geo_node[meshCount].getAttribute("name");

          var newObj = new Mesh(meshName);

          MeshPool[meshUrl + "@" + meshName] = newObj;

          // console.log("found "+meshUrl+"@"+meshName);
          if (cl_geomesh.length) {
            var cl_geosources = cl_geomesh[0].getElementsByTagName("source");

            var geoSources = [];

            for (var sourceCount = 0, sourceMax = cl_geosources.length; sourceCount < sourceMax; sourceCount++) {
              var cl_geosource = cl_geosources[sourceCount];

              sourceId = cl_geosource.getAttribute("id");
              var sourceName = cl_geosource.getAttribute("name");
              var cl_floatarray = cl_geosource.getElementsByTagName("float_array");

              if (cl_floatarray.length) {
                geoSources[sourceId] = {
                  id: sourceId,
                  name: sourceName,
                  data: util.floatDelimArray(util.collectTextNode(cl_floatarray[0]), " ")
                };
              }

              var cl_accessor = cl_geosource.getElementsByTagName("accessor");

              if (cl_accessor.length) {
                geoSources[sourceId].count = cl_accessor[0].getAttribute("count");
                geoSources[sourceId].stride = cl_accessor[0].getAttribute("stride");
                geoSources[sourceId].data = util.repackArray(geoSources[sourceId].data, geoSources[sourceId].stride, geoSources[sourceId].count);
              }
            }

            var geoVerticies = [];

            var cl_vertices = cl_geomesh[0].getElementsByTagName("vertices");

            var pointRef = null;
            var pointRefId = null;
            var triangleRef = null;
            var normalRef = null;
            var uvRef = null;

            if (cl_vertices.length) {
              pointRefId = cl_vertices[0].getAttribute("id");
              cl_inputs = cl_vertices[0].getElementsByTagName("input");

              if (cl_inputs.length) {
                for (inpCount = 0, inpMax = cl_inputs.length; inpCount < inpMax; inpCount++) {
                  cl_input = cl_inputs[inpCount];

                  if (cl_input.getAttribute("semantic") === "POSITION") {
                    pointRef = cl_input.getAttribute("source").substr(1);
                  }
                }
              }
            }

            var CL_VERTEX = 0,
              CL_NORMAL = 1,
              CL_TEXCOORD = 2,
              CL_OTHER = 3;


            var cl_triangles = cl_geomesh[0].getElementsByTagName("triangles");

            if (cl_triangles.length) {
              for (tCount = 0, tMax = cl_triangles.length; tCount < tMax; tCount++) {
                var cl_trianglesCount = parseInt(cl_triangles[tCount].getAttribute("count"), 10);
                cl_inputs = cl_triangles[tCount].getElementsByTagName("input");
                cl_inputmap = [];

                if (cl_inputs.length) {
                  for (inpCount = 0, inpMax = cl_inputs.length; inpCount < inpMax; inpCount++) {
                    cl_input = cl_inputs[inpCount];

                    ofs = parseInt(cl_input.getAttribute("offset"), 10);
                    nameRef = cl_input.getAttribute("source").substr(1);

                    if (cl_input.getAttribute("semantic") === "VERTEX") {
                      if (nameRef === pointRefId) {
                        nameRef = triangleRef = pointRef;

                      } else {
                        triangleRef = nameRef;
                      }
                      cl_inputmap[ofs] = CL_VERTEX;
                    } else if (cl_input.getAttribute("semantic") === "NORMAL") {
                      normalRef = nameRef;
                      cl_inputmap[ofs] = CL_NORMAL;
                    } else if (cl_input.getAttribute("semantic") === "TEXCOORD") {
                      uvRef = nameRef;
                      cl_inputmap[ofs] = CL_TEXCOORD;
                    } else {
                      cl_inputmap[ofs] = CL_OTHER;
                    }
                  }
                }

                materialRef = cl_triangles[tCount].getAttribute("material");

                // console.log("Material: "+materialRef);
                //              console.log(materialsRef[materialMap[materialRef]].mat);
                if (materialRef === null) {
                  newObj.setFaceMaterial(0);
                } else {
                  if (materialMap[materialRef] === undef) {
                    if (window.console) { console.log("missing material ["+materialRef+"]@"+meshName+"?"); }
                    newObj.setFaceMaterial(0);
                  } else {
                    newObj.setFaceMaterial(materialsRef[materialMap[materialRef]].mat);
                  }
                }


                var cl_triangle_source = cl_triangles[tCount].getElementsByTagName("p");

                var triangleData = [];

                if (cl_triangle_source.length) {
                  triangleData = util.intDelimArray(util.collectTextNode(cl_triangle_source[0]), " ");
                }

                if (triangleData.length) {
                  computedLen = ((triangleData.length) / cl_inputmap.length) / 3;

                  if (computedLen !== cl_trianglesCount) {
                    //                console.log("triangle data doesn't add up, skipping object load: "+computedLen+" !== "+cl_trianglesCount);
                  } else {
                    if (newObj.points.length === 0) {
                      newObj.points = geoSources[pointRef].data;
                    }

                    for (i = 0, iMax = triangleData.length, iMod = cl_inputmap.length; i < iMax; i += iMod * 3) {
                      norm = [];
                      vert = [];
                      uv = [];

                      for (j = 0; j < iMod * 3; j++) {
                        var jMod = j % iMod;

                        if (cl_inputmap[jMod] === CL_VERTEX) {
                          vert.push(triangleData[i + j]);
                        } else if (cl_inputmap[jMod] === CL_NORMAL) {
                          norm.push(triangleData[i + j]);
                        } else if (cl_inputmap[jMod] === CL_TEXCOORD) {
                          uv.push(triangleData[i + j]);
                        }
                      }

                      if (vert.length) {
                        // if (up_axis !== 1)
                        // {
                        //   vert.reverse();
                        // }
                        nFace = newObj.addFace(vert);

                        if (norm.length === 3) {
                          newObj.faces[nFace].point_normals = [fixuaxis(geoSources[normalRef].data[norm[0]]), fixuaxis(geoSources[normalRef].data[norm[1]]), fixuaxis(geoSources[normalRef].data[norm[2]])];
                        }

                        if (uv.length === 3) {
                          newObj.faces[nFace].uvs[0] = geoSources[uvRef].data[uv[0]];
                          newObj.faces[nFace].uvs[1] = geoSources[uvRef].data[uv[1]];
                          newObj.faces[nFace].uvs[2] = geoSources[uvRef].data[uv[2]];
                        }
                      }

                      //                     if (up_axis===2) {newObj.faces[nFace].flip();}
                      // console.log(norm);
                      // console.log(vert);
                      // console.log(uv);
                    }

                    // newObj.compile();
                    // return newObj;
                  }
                }
              }
            }


            var cl_polylist = cl_geomesh[0].getElementsByTagName("polylist");
            if (!cl_polylist.length) {
              cl_polylist = cl_geomesh[0].getElementsByTagName("polygons"); // try polygons                
            }

            if (cl_polylist.length) {
              for (tCount = 0, tMax = cl_polylist.length; tCount < tMax; tCount++) {
                var cl_polylistCount = parseInt(cl_polylist[tCount].getAttribute("count"), 10);
                cl_inputs = cl_polylist[tCount].getElementsByTagName("input");
                cl_inputmap = [];

                if (cl_inputs.length) {
                  for (inpCount = 0, inpMax = cl_inputs.length; inpCount < inpMax; inpCount++) {
                    cl_input = cl_inputs[inpCount];

                    var cl_ofs = cl_input.getAttribute("offset");
                    
                    if (cl_ofs === null)
                    {
                      cl_ofs = cl_input.getAttribute("idx");
                    }
                    
                    ofs = parseInt(cl_ofs, 10);
                    nameRef = cl_input.getAttribute("source").substr(1);

                    if (cl_input.getAttribute("semantic") === "VERTEX") {
                      if (nameRef === pointRefId) {
                        nameRef = triangleRef = pointRef;

                      } else {
                        triangleRef = nameRef;
                      }
                      cl_inputmap[ofs] = CL_VERTEX;
                    } else if (cl_input.getAttribute("semantic") === "NORMAL") {
                      normalRef = nameRef;
                      cl_inputmap[ofs] = CL_NORMAL;
                    } else if (cl_input.getAttribute("semantic") === "TEXCOORD") {
                      uvRef = nameRef;
                      cl_inputmap[ofs] = CL_TEXCOORD;
                    } else {
                      cl_inputmap[ofs] = CL_OTHER;
                    }
                  }
                }


                var cl_vcount = cl_polylist[tCount].getElementsByTagName("vcount");
                var vcount = [];

                if (cl_vcount.length) {
                  vcount = util.intDelimArray(util.collectTextNode(cl_vcount[0]), " ");
                }

                materialRef = cl_polylist[tCount].getAttribute("material");

                // console.log("Material: "+materialRef);
                //              console.log(materialsRef[materialMap[materialRef]].mat);
                if (materialRef === undef) {
                  newObj.setFaceMaterial(0);
                } else {
                  newObj.setFaceMaterial(materialsRef[materialMap[materialRef]].mat);
                }

                var cl_poly_source = cl_polylist[tCount].getElementsByTagName("p");

                var mapLen = cl_inputmap.length;

                var polyData = [];

                if ((cl_poly_source.length > 1) && !vcount.length) // blender 2.49 style
                {
                  var pText = "";
                  for (pCount = 0, pMax = cl_poly_source.length; pCount < pMax; pCount++) {
                    var tmp = util.intDelimArray(util.collectTextNode(cl_poly_source[pCount]), " ");

                    vcount[pCount] = parseInt(tmp.length / mapLen, 10);

                    polyData.splice(polyData.length, 0, tmp);
                  }
                }
                else {
                  if (cl_poly_source.length) {
                    polyData = util.intDelimArray(util.collectTextNode(cl_poly_source[0]), " ");
                  }
                }

                if (polyData.length) {
                  computedLen = vcount.length;

                  if (computedLen !== cl_polylistCount) {
                    log("poly vcount data doesn't add up, skipping object load: " + computedLen + " !== " + cl_polylistCount);
                  } else {
                    if (newObj.points.length === 0) {
                      newObj.points = geoSources[pointRef].data;
                    }

                    ofs = 0;

                    for (i = 0, iMax = vcount.length; i < iMax; i++) {
                      norm = [];
                      vert = [];
                      uv = [];

                      for (j = 0, jMax = vcount[i] * mapLen; j < jMax; j++) {
                        if (cl_inputmap[j % mapLen] === CL_VERTEX) {
                          vert.push(polyData[ofs]);
                          ofs++;
                        } else if (cl_inputmap[j % mapLen] === CL_NORMAL) {
                          norm.push(polyData[ofs]);
                          ofs++;
                        } else if (cl_inputmap[j % mapLen] === CL_TEXCOORD) {
                          uv.push(polyData[ofs]);
                          ofs++;
                        }
                      }


                      if (vert.length) {
                        // if (up_axis !== 1)
                        // {
                        //   vert.reverse();
                        // }
                        nFace = newObj.addFace(vert);

                        if (norm.length) {
                          for (k = 0, kMax = norm.length; k < kMax; k++) {
                            newObj.faces[nFace].point_normals[k] = fixuaxis(geoSources[normalRef].data[norm[k]]);
                          }
                        }

                        if (uv.length) {
                          for (k = 0, kMax = uv.length; k < kMax; k++) {
                            newObj.faces[nFace].uvs[k] = geoSources[uvRef].data[uv[k]];
                          }
                        }
                      }

                      //                     if (up_axis===2) {newObj.faces[nFace].flip();}
                      // console.log(norm);
                      // console.log(vert);
                      // console.log(uv);
                    }

                    // newObj.compile();
                    // return newObj;
                  }
                }
              }
            }

            if (up_axis !== 1) {
              for (i = 0, iMax = newObj.points.length; i < iMax; i++) {
                // console.log(newObj.points[i]);
                newObj.points[i] = fixuaxis(newObj.points[i]);
                // console.log(newObj.points[i],":");
              }
            }

            // newObj.calcNormals();
            newObj.triangulateQuads();
            newObj.compile();
            meshes[meshId] = newObj;
            // console.log(newObj);
            // return newObj;
          }
        }
      }

    }
  }


  var cl_lib_cameras = cl.getElementsByTagName("library_cameras");


  if (!cl_lib_cameras.length && cl_collada13_lib.length)
  {
    cl_lib_cameras = cl_collada13_libmap["CAMERA"];
  }


  var camerasRef = [];
  var camerasBoundRef = [];

  if (cl_lib_cameras.length) {
    cl_cameras = cl.getElementsByTagName("camera");

    for (cCount = 0, cMax = cl_cameras.length; cCount < cMax; cCount++) {
      cl_camera = cl_cameras[cCount];

      var cameraId = cl_camera.getAttribute("id");
      var cameraName = cl_camera.getAttribute("name");

//      var cl_perspective = cl_camera.getElementsByTagName("perspective");

      // if (cl_perspective.length) {
      //   var perspective = cl_perspective[0];

        var cl_yfov = cl_camera.getElementsByTagName("yfov");
        var cl_znear = cl_camera.getElementsByTagName("znear");
        var cl_zfar = cl_camera.getElementsByTagName("zfar");
        
        var yfov;
        var znear;
        var zfar;
        
        if (!cl_yfov.length && !cl_znear.length && !cl_zfar.length) {
          cl_params = cl_camera.getElementsByTagName("param");
          
          for (i = 0, iMax = cl_params.length; i < iMax; i++) {
            var txt = util.collectTextNode(cl_params[i]);
            switch (cl_params[i].getAttribute("name"))
            {
              case "YFOV": yfov = parseFloat(txt); break;
              case "ZNEAR": znear = parseFloat(txt); break;
              case "ZFAR": zfar = parseFloat(txt); break;
            }
          }
        }
        else
        {
          yfov = cl_yfov.length ? parseFloat(util.collectTextNode(cl_yfov[0])) : 60;
          znear = cl_znear.length ? parseFloat(util.collectTextNode(cl_znear[0])) : 0.1;
          zfar = cl_zfar.length ? parseFloat(util.collectTextNode(cl_zfar[0])) : 1000.0;          
        }

        var newCam = new Camera(512, 512, parseFloat(yfov), parseFloat(znear), parseFloat(zfar));
        newCam.targeted = false;
        newCam.setClip(znear, zfar);

        camerasRef[cameraId] = newCam;
      // }

      //      console.log(cl_perspective);
    }
  }


  var getFirstChildByTagName = function(scene_node,tagName) {
    for (var i = 0, iMax = scene_node.childNodes.length; i < iMax; i++) {
      if (scene_node.childNodes[i].tagName === tagName) {
        return scene_node.childNodes[i];
      }
    }    

    return null;
  };

  var getChildrenByTagName = function(scene_node,tagName) {
    var ret = [];
    
    for (var i = 0, iMax = scene_node.childNodes.length; i < iMax; i++) {
      if (scene_node.childNodes[i].tagName === tagName) {
        ret.push(scene_node.childNodes[i]);
      }
    }    
    
    return ret;
  };

  var quaternionFilterZYYZ = function(rot,ofs) {
    var r = rot;
    var temp_q = new Quaternion();
    
    if (ofs !== undef) {
      r = vec3.add(rot, ofs);
    }
        
    temp_q.fromEuler(r[0],r[2],-r[1]);

    return temp_q.toEuler();
  };


  var cl_getInitalTransform = function(scene_node) {
    var retObj = {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    };


    var translate = getFirstChildByTagName(scene_node,"translate");
    var rotate = getChildrenByTagName(scene_node,"rotate");
    var scale = getFirstChildByTagName(scene_node,"scale");
    
    if (translate !== null) {
      retObj.position = fixuaxis(util.floatDelimArray(util.collectTextNode(translate), " "));
    }


    if (rotate.length) {
      for (var r = 0, rMax = rotate.length; r < rMax; r++) {
        var cl_rot = rotate[r];

        var rType = cl_rot.getAttribute("sid");

        var rVal = util.floatDelimArray(util.collectTextNode(cl_rot), " ");

        switch (rType) {
        case "rotateX":
        case "rotationX":
          retObj.rotation[0] = rVal[3];
          break;
        case "rotateY":
        case "rotationY":
          retObj.rotation[1] = rVal[3];
          break;
        case "rotateZ":
        case "rotationZ":
          retObj.rotation[2] = rVal[3];
        }
      }
    }

    if (scale!==null) {
      retObj.scale = fixscaleaxis(util.floatDelimArray(util.collectTextNode(scale), " "));
    }

    // var cl_matrix = scene_node.getElementsByTagName("matrix");
    // 
    // if (cl_matrix.length)
    // {
    //   console.log(util.collectTextNode(cl_matrix[0]));
    // }

    return retObj;
  };

  var cl_lib_scenes = cl.getElementsByTagName("library_visual_scenes");

  if (!cl_lib_scenes.length && cl_collada13_lib.length)
  {
    cl_lib_scenes = ["13"];
  }

  var scenesRef = [];

  if (cl_lib_scenes.length) {
    var cl_scenes = null;
    
    if (cl_lib_scenes[0]==="13"){
      cl_scenes = cl.getElementsByTagName("scene");      
    } else {
      cl_scenes = cl_lib_scenes[0].getElementsByTagName("visual_scene");
    }
    
    
    for (var sceneCount = 0, sceneMax = cl_scenes.length; sceneCount < sceneMax; sceneCount++) {
      cl_scene = cl_scenes[sceneCount];

      var sceneId = cl_scene.getAttribute("id");
      var sceneName = cl_scene.getAttribute("name");

      // console.log(sceneId,sceneName);
      var newScene = new Scene(sceneName);

      var cl_nodes = cl_scene.getElementsByTagName("node");

      if (cl_nodes.length) {
        for (var nodeCount = 0, nodeMax = cl_nodes.length; nodeCount < nodeMax; nodeCount++) {
          var cl_node = cl_nodes[nodeCount];

          var cl_geom = getFirstChildByTagName(cl_nodes[nodeCount],"instance_geometry");
          var cl_light = getFirstChildByTagName(cl_nodes[nodeCount],"instance_light");
          cl_camera = getFirstChildByTagName(cl_nodes[nodeCount],"instance_camera");
          cl_13inst = getFirstChildByTagName(cl_nodes[nodeCount],"instance");

          if (cl_13inst !== null)
          {            
            var instance_name = cl_13inst.getAttribute("url").substr(1);
            if (meshes[instance_name] !== undef)
            {
              cl_geom = cl_13inst;
            }

            if (camerasRef[instance_name] !== undef)
            {
              cl_camera = cl_13inst;
            }
          }

          var nodeId = cl_node.getAttribute("id");
          var nodeName = cl_node.getAttribute("name");

          var it = cl_getInitalTransform(cl_node);

          if (up_axis === 2) {
            it.rotation = quaternionFilterZYYZ(it.rotation,(cl_camera!==null)?[-90,0,0]:undef);
          }

          var newSceneObject;

          if (cl_geom !== null) {
            meshName = cl_geom.getAttribute("url").substr(1);
            // console.log(nodeId,nodeName);
            newSceneObject = new SceneObject(meshes[meshName], (nodeName !== null) ? nodeName : nodeId);

            newSceneObject.position = it.position;
            newSceneObject.rotation = it.rotation;
            newSceneObject.scale = it.scale;

            newScene.bindSceneObject(newSceneObject);
            if (cl_node.parentNode.tagName === 'node')
            {
              var parentNodeId = cl_node.parentNode.getAttribute("id");
              var parentNodeName = cl_node.parentNode.getAttribute("name");
              var parentNode = newScene.getSceneObject(parentNodeId);
              
              if (parentNode !== null)
              {         
                parentNode.bindChild(newSceneObject);
              }
            }
          } else if (cl_camera !== null) {
            var cam_instance = cl_camera;

            var camRefId = cam_instance.getAttribute("url").substr(1);

            newScene.camera = camerasRef[camRefId];
            camerasBoundRef[nodeId] = newScene.camera;

            newScene.camera.position = it.position;
            newScene.camera.rotation = it.rotation;
            
            newScene.camera.scale = it.scale;
          } else if (cl_light !== null) {
            // ... todo
          } else {
            newSceneObject = new SceneObject(null, (nodeName !== null) ? nodeName : nodeId);

            newSceneObject.position = it.position;
            newSceneObject.rotation = it.rotation;
            newSceneObject.scale = it.scale;

            newScene.bindSceneObject(newSceneObject);
          }

        }
      }

      scenesRef[sceneId] = newScene;
    }
  }

  var cl_lib_scene = cl.getElementsByTagName("scene");

  var sceneRef = null;

  if (cl_lib_scene.length) {
    cl_scene = cl_lib_scene[0].getElementsByTagName("instance_visual_scene");

    if (cl_scene.length) {
      var sceneUrl = cl_scene[0].getAttribute("url").substr(1);

      sceneRef = scenesRef[sceneUrl];
    } else {
      for (i in scenesRef) {
        if (scenesRef.hasOwnProperty(i)) {
          sceneRef =  scenesRef[i];
        }
      }
    }
  }

  var cl_lib_anim = cl.getElementsByTagName("library_animations");

  if (!cl_lib_anim.length && cl_collada13_lib.length)
  {
    cl_lib_anim = cl_collada13_libmap["ANIMATION"];
  }

  var animRef = [],
    animId;
  if (cl_lib_anim.length) {
    var cl_anim_sources = cl_lib_anim[0].getElementsByTagName("animation");

    if (cl_anim_sources.length) {
      for (var aCount = 0, aMax = cl_anim_sources.length; aCount < aMax; aCount++) {
        var cl_anim = cl_anim_sources[aCount];

        animId = cl_anim.getAttribute("id");
        var animName = cl_anim.getAttribute("name");

        animRef[animId] = {};
        animRef[animId].sources = [];

        var cl_sources = cl_anim.getElementsByTagName("source");

        if (cl_sources.length) {
          for (sCount = 0, sMax = cl_sources.length; sCount < sMax; sCount++) {
            var cl_source = cl_sources[sCount];

            sourceId = cl_source.getAttribute("id");

            var name_arrays = cl_source.getElementsByTagName("name_array");
            if (name_arrays.length === 0) {
              name_arrays = cl_source.getElementsByTagName("Name_array");
            }
            var float_arrays = cl_source.getElementsByTagName("float_array");
            var tech_common = cl_source.getElementsByTagName("technique_common");

            var name_array = null;
            var float_array = null;
            var data = null;

            if (name_arrays.length) {
              name_array = util.textDelimArray(util.collectTextNode(name_arrays[0]), " ");
            } else if (float_arrays.length) {
              float_array = util.floatDelimArray(util.collectTextNode(float_arrays[0]), " ");
            }

            var acCount = 0;
            var acSource = "";
            var acStride = 1;

            if (tech_common.length) {
              tech = tech_common[0];
              var acc = tech.getElementsByTagName("accessor")[0];

              acCount = parseInt(acc.getAttribute("count"), 10);
              acSource = acc.getAttribute("source").substr(1);
              var aStride = acc.getAttribute("stride");

              if (aStride) {
                acStride = parseInt(aStride, 10);
              }
            }

            animRef[animId].sources[sourceId] = {
              data: name_array ? name_array : float_array,
              count: acCount,
              source: acSource,
              stride: acStride
            };

            if (acStride !== 1) {
              animRef[animId].sources[sourceId].data = util.repackArray(animRef[animId].sources[sourceId].data, acStride, acCount);
            }
          }
        }

        // console.log(animId,animName,cl_anim_sources[aCount]);
        cl_samplers = cl_anim.getElementsByTagName("sampler");

        if (cl_samplers.length) {
          animRef[animId].samplers = [];

          for (sCount = 0, sMax = cl_samplers.length; sCount < sMax; sCount++) {
            var cl_sampler = cl_samplers[sCount];

            var samplerId = cl_sampler.getAttribute("id");

            cl_inputs = cl_sampler.getElementsByTagName("input");

            if (cl_inputs.length) {
              var inputs = [];

              for (iCount = 0, iMax = cl_inputs.length; iCount < iMax; iCount++) {
                cl_input = cl_inputs[iCount];

                var semanticName = cl_input.getAttribute("semantic");

                inputs[semanticName] = cl_input.getAttribute("source").substr(1);
                //                console.log(semanticName,inputs[semanticName]);
              }

              animRef[animId].samplers[samplerId] = inputs;
            }
          }
        }

        var cl_channels = cl_anim.getElementsByTagName("channel");


        if (cl_channels.length) {
          animRef[animId].channels = [];

          for (cCount = 0, cMax = cl_channels.length; cCount < cMax; cCount++) {
            var channel = cl_channels[cCount];

            var channelSource = channel.getAttribute("source").substr(1);
            var channelTarget = channel.getAttribute("target");

            var channelSplitA = channelTarget.split("/");
            var channelTargetName = channelSplitA[0];
            var channelSplitB = channelSplitA[1].split(".");
            var channelParam = channelSplitB[0];
            var channelType = channelSplitB[1];

            animRef[animId].channels.push({
              source: channelSource,
              target: channelTarget,
              targetName: channelTargetName,
              paramName: channelParam,
              typeName: channelType
            });
          }
        }
      }
    }

    for (animId in animRef) {
      if (animRef.hasOwnProperty(animId)) {
        var anim = animRef[animId];

        if (anim.channels.length) {
          for (cCount = 0, cMax = anim.channels.length; cCount < cMax; cCount++) {
            var chan = anim.channels[cCount];
            var sampler = anim.samplers[chan.source];
            var samplerInput = anim.sources[sampler["INPUT"]];
            var samplerOutput = anim.sources[sampler["OUTPUT"]];
            var samplerInterp = anim.sources[sampler["INTERPOLATION"]];
            var samplerInTangent = anim.sources[sampler["IN_TANGENT"]];
            var samplerOutTangent = anim.sources[sampler["OUT_TANGENT"]];
            var hasInTangent = (sampler["IN_TANGENT"]!==undef);
            var hasOutTangent = (sampler["OUT_TANGENT"]!==undef);
            var mtn = null;

            var targetSceneObject = sceneRef.getSceneObject(chan.targetName);
            var targetCamera = camerasBoundRef[chan.targetName];


            if (targetSceneObject) {
              if (targetSceneObject.motion === null) {
                targetSceneObject.motion = new Motion();
              }
              mtn = targetSceneObject.motion;
            } else if (targetCamera) {
              if (targetCamera.motion === null) {
                targetCamera.motion = new Motion();
              }

              mtn = targetCamera.motion;
            }

            if (mtn === null) {
              continue;
            }

            var controlTarget = enums.motion.POS;
            var motionTarget = enums.motion.X;

            if (up_axis === 2) {
              mtn.yzflip = true;
            }

            switch (chan.paramName) {
            case "rotateX":
            case "rotationX":
              controlTarget = enums.motion.ROT;
              motionTarget = enums.motion.X;
              break;
            case "rotateY":
            case "rotationY":
              controlTarget = enums.motion.ROT;
              motionTarget = enums.motion.Y;
              break;
            case "rotateZ":
            case "rotationZ":
              controlTarget = enums.motion.ROT;
              motionTarget = enums.motion.Z;
              break;
            case "location":
              controlTarget = enums.motion.POS;
              if (chan.typeName === "X") {
                motionTarget = enums.motion.X;
              }
              if (chan.typeName === "Y") {
                motionTarget = enums.motion.Y;
              }
              if (chan.typeName === "Z") {
                motionTarget = enums.motion.Z;
              }
              break;
            case "translate":
              controlTarget = enums.motion.POS;
              if (chan.typeName === "X") {
                motionTarget = enums.motion.X;
              }
              if (chan.typeName === "Y") {
                motionTarget = enums.motion.Y;
              }
              if (chan.typeName === "Z") {
                motionTarget = enums.motion.Z;
              }
              break;
            case "LENS":
              controlTarget = enums.motion.LENS;
              motionTarget = 4;
            break;
            case "FOV":
              controlTarget = 10;
              motionTarget = 10;
              continue; // todo: fix FOV input
            break;
            }


            // if (up_axis === 2 && motionTarget === enums.motion.Z) motionTarget = enums.motion.Y;
            // else if (up_axis === 2 && motionTarget === enums.motion.Y) motionTarget = enums.motion.Z;
            // 
            var ival;
            for (mCount = 0, mMax = samplerInput.data.length; mCount < mMax; mCount++) {
              k = null;

              if (typeof(samplerOutput.data[mCount]) === 'object') {
                for (i = 0, iMax = samplerOutput.data[mCount].length; i < iMax; i++) {
                  ival = i;

                  if (up_axis === 2 && i === 2) {
                    ival = 1;
                  } else if (up_axis === 2 && i === 1) {
                    ival = 2;
                  }

                  k = mtn.setKey(controlTarget, ival, samplerInput.data[mCount], fixukaxis(controlTarget, ival, samplerOutput.data[mCount][i]));

                  if (samplerInterp) {
                    switch (samplerInterp.data[mCount][i]) {
                    case "LINEAR":
                      k.shape = enums.envelope.shape.LINE;
                      break;
                    case "BEZIER":
                      if (!(hasInTangent||hasOutTangent))
                      {
                        // k.shape = enums.envelope.shape.TCB;
                        // k.continutity = 1.0;                      
                        
                        k.shape = enums.envelope.shape.LINEAR;
                      }
                      else
                      {
                        k.shape = enums.envelope.shape.BEZI;
                        // todo:
                      }
                      break;
                    }
                  }
                }
              } else {
                ival = motionTarget;
                ofs = 0;

                if (targetCamera) {
                  // if (up_axis === 2 && i === 2) ival = 1;
                  // else if (up_axis === 2 && i === 1) ival = 2;    
                  if (controlTarget === enums.motion.ROT)            
                  {
                    if (up_axis === 2 && ival === 0) {
                      ofs = -90;
                    }
                  }
                  // if (up_axis===2 && ival === 2) ofs = 180;
                }

                if (controlTarget === enums.motion.ROT) {
                  k = mtn.setKey(controlTarget, ival, samplerInput.data[mCount], samplerOutput.data[mCount] + ofs);
                } else {
                  if (up_axis === 2 && motionTarget === 2) {
                    ival = 1;
                  } else if (up_axis === 2 && motionTarget === 1) {
                    ival = 2;
                  }

                  k = mtn.setKey(controlTarget, ival, samplerInput.data[mCount], fixukaxis(controlTarget, ival, samplerOutput.data[mCount]));
                }

                if (samplerInterp) {
                  switch (samplerInterp.data[mCount]) {
                  case "LINEAR":
                    k.shape = enums.envelope.shape.LINE;
                    break;
                  case "BEZIER":
                    if (!(hasInTangent||hasOutTangent))
                    {
                      k.shape = enums.envelope.shape.LINEAR;
                      k.continutity = 1.0;          
                    }
                    else
                    {
                      k.shape = enums.envelope.shape.BEZ2;

                      var itx = samplerInTangent.data[mCount][0], ity;
                      var otx = samplerOutTangent.data[mCount][0], oty;
                      
                      if (controlTarget === enums.motion.ROT) {                        
                        ity = samplerInTangent.data[mCount][1];
                        oty = samplerOutTangent.data[mCount][1];
                        
//                         if (up_axis === 2 && motionTarget === 2) {
//                           oty = -oty;
//                           ity = -ity;
//                         } else if (up_axis === 2 && motionTarget === 1) {
// //                          ival = 2;
//                         }
                        
                       k.value = k.value/10;
                       mtn.rscale = 10;

                        k.param[0] = itx-k.time;
                        k.param[1] = ity-k.value;
                        k.param[2] = otx-k.time;
                        k.param[3] = oty-k.value;

                        // console.log(k.param);
                        // console.log(ity,oty,k.value);
                      }
                      else
                      {
                        ity = fixukaxis(controlTarget, ival, samplerInTangent.data[mCount][1]);
                        oty = fixukaxis(controlTarget, ival, samplerOutTangent.data[mCount][1]);

                        k.param[0] = itx-k.time;
                        k.param[1] = ity-k.value;
                        k.param[2] = otx-k.time;
                        k.param[3] = oty-k.value;
                      }
                    
                    }
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return sceneRef;
}

function GML(srcUrl) {
  this.strokes = [];
  this.bounds = [1, 1, 1];
  this.origin = [0, 0, 0];
  this.upvector = [0, 1, 0];
  this.viewvector = [0, 0, 1];
  this.manual_pos = 0;

  if (srcUrl === undef) {
    return;
  }

  var gml = util.getXML(srcUrl);

  var gml_header = gml.getElementsByTagName("header");

  if (!gml_header.length) {
    return null;
  }

  var header = gml_header[0];

  var gml_environment = gml.getElementsByTagName("environment");


  if (!gml_environment.length) {
    return null;
  }

  this.name = null;

  var gml_name = header.getElementsByTagName("name");

  if (gml_name.length) {
    this.name = util.collectTextNode(gml_name[0]);
  }

  var gml_screenbounds = gml_environment[0].getElementsByTagName("screenBounds");

  if (gml_screenbounds.length) {
    this.bounds = [
      parseFloat(util.collectTextNode(gml_screenbounds[0].getElementsByTagName("x")[0])),
      parseFloat(util.collectTextNode(gml_screenbounds[0].getElementsByTagName("y")[0])),
      parseFloat(util.collectTextNode(gml_screenbounds[0].getElementsByTagName("z")[0]))
      ];
  }

  var gml_origin = gml_environment[0].getElementsByTagName("origin");

  if (gml_origin.length) {
    this.origin = [
      parseFloat(util.collectTextNode(gml_origin[0].getElementsByTagName("x")[0])),
      parseFloat(util.collectTextNode(gml_origin[0].getElementsByTagName("y")[0])),
      parseFloat(util.collectTextNode(gml_origin[0].getElementsByTagName("z")[0]))
      ];
  }

  var gml_upvector = gml_environment[0].getElementsByTagName("up");

  if (gml_upvector.length) {
    this.upvector = [
      parseFloat(util.collectTextNode(gml_upvector[0].getElementsByTagName("x")[0])),
      parseFloat(util.collectTextNode(gml_upvector[0].getElementsByTagName("y")[0])),
      parseFloat(util.collectTextNode(gml_upvector[0].getElementsByTagName("z")[0]))
      ];
  }

  var gml_drawings = gml.getElementsByTagName("drawing");

  var drawings = [];

  for (var dCount = 0, dMax = gml_drawings.length; dCount < dMax; dCount++) {
    var drawing = gml_drawings[dCount];
    var gml_strokes = drawing.getElementsByTagName("stroke");

    var xm = 0,
      ym = 0,
      zm = 0,
      tm = 0;

    for (var sCount = 0, sMax = gml_strokes.length; sCount < sMax; sCount++) {
      var gml_stroke = gml_strokes[sCount];
      var gml_points = gml_stroke.getElementsByTagName("pt");

      var points = [];

      for (var pCount = 0, pMax = gml_points.length; pCount < pMax; pCount++) {
        var gml_point = gml_points[pCount];

        var px = parseFloat(util.collectTextNode(gml_point.getElementsByTagName("x")[0]));
        var py = parseFloat(util.collectTextNode(gml_point.getElementsByTagName("y")[0]));
        var pz = parseFloat(util.collectTextNode(gml_point.getElementsByTagName("z")[0]));
        var pt = parseFloat(util.collectTextNode(gml_point.getElementsByTagName("time")[0]));

        if (this.upvector[0] === 1) {
          points.push([(py !== py) ? 0 : py, (px !== px) ? 0 : -px, (pz !== pz) ? 0 : pz, pt]);
        } else if (this.upvector[1] === 1) {
          points.push([(px !== px) ? 0 : px, (py !== py) ? 0 : py, (pz !== pz) ? 0 : pz, pt]);
        } else if (this.upvector[2] === 1) {
          points.push([(px !== px) ? 0 : px, (pz !== pz) ? 0 : -pz, (py !== py) ? 0 : py, pt]);
        }

        if (xm < px) {
          xm = px;
        }
        if (ym < py) {
          ym = py;
        }
        if (zm < pz) {
          zm = pz;
        }
        if (tm < pt) {
          tm = pt;
        }
      }

      if (zm > tm) { // fix swapped Z/Time
        for (var i = 0, iMax = points.length; i < iMax; i++) {
          var t = points[i][3];
          points[i][3] = points[i][2];
          points[i][2] = t / this.bounds[2];
        }
      }

      this.strokes.push(points);
    }
  }
}

GML.prototype.addStroke = function(points, tstep) {
  var pts = [];

  if (tstep === undef) {
    tstep = 0.1;
  }

  for (var i = 0, iMax = points.length; i < iMax; i++) {
    var ta = [points[i][0], points[i][1], points[i][2]];
    this.manual_pos += tstep;
    ta.push(this.manual_pos);
    pts.push(ta);
  }

  this.strokes.push(pts);
};


GML.prototype.recenter = function() {
  var min = [0, 0, 0];
  var max = [this.strokes[0][0][0], this.strokes[0][0][1], this.strokes[0][0][2]];

  var i, iMax, s, sMax;

  for (s = 0, sMax = this.strokes.length; s < sMax; s++) {
    for (i = 0, iMax = this.strokes[s].length; i < iMax; i++) {
      if (min[0] > this.strokes[s][i][0]) {
        min[0] = this.strokes[s][i][0];
      }
      if (min[1] > this.strokes[s][i][1]) {
        min[1] = this.strokes[s][i][1];
      }
      if (min[2] > this.strokes[s][i][2]) {
        min[2] = this.strokes[s][i][2];
      }

      if (max[0] < this.strokes[s][i][0]) {
        max[0] = this.strokes[s][i][0];
      }
      if (max[1] < this.strokes[s][i][1]) {
        max[1] = this.strokes[s][i][1];
      }
      if (max[2] < this.strokes[s][i][2]) {
        max[2] = this.strokes[s][i][2];
      }
    }
  }

  var center = vec3.multiply(vec3.subtract(max, min), 0.5);

  for (s = 0, sMax = this.strokes.length; s < sMax; s++) {
    for (i = 0, iMax = this.strokes[s].length; i < iMax; i++) {
      this.strokes[s][i][0] = this.strokes[s][i][0] - center[0];
      this.strokes[s][i][1] = this.strokes[s][i][1] - (this.upvector[1] ? center[1] : (-center[1]));
      this.strokes[s][i][2] = this.strokes[s][i][2] - center[2];
    }
  }
};

GML.prototype.generateObject = function(seg_mod, extrude_depth) {
  if (seg_mod === undef) {
    seg_mod = 0;
  }
  if (extrude_depth === undef) {
    extrude_depth = 0;
  }

  // temporary defaults
  var divs = 6;
  var divsper = 0.02;
  var pwidth = 0.015;
  var extrude = extrude_depth !== 0;

  var segCount = 0;
  var faceSegment = 0;

  var obj = new Mesh(this.name);

  var lx, ly, lz, lt;

  var i, iMax, pCount;

  for (var sCount = 0, sMax = this.strokes.length; sCount < sMax; sCount++) {
    var strokeEnvX = new Envelope();
    var strokeEnvY = new Envelope();
    var strokeEnvZ = new Envelope();

    var pMax = this.strokes[sCount].length;

    var d = 0;
    var len_set = [];
    var time_set = [];
    var start_time = 0;

    for (pCount = 0; pCount < pMax; pCount++) {
      var pt = this.strokes[sCount][pCount];

      var k1 = strokeEnvX.addKey(pt[3], pt[0]);
      var k2 = strokeEnvY.addKey(pt[3], pt[1]);
      var k3 = strokeEnvZ.addKey(pt[3], pt[2]);

      k1.tension = 0.5;
      k2.tension = 0.5;
      k3.tension = 0.5;

      if (pCount !== 0) {
        var dx = pt[0] - lx;
        var dy = pt[1] - ly;
        var dz = pt[2] - lz;
        var dt = pt[3] - lt;
        var dlen = Math.sqrt(dx * dx + dy * dy + dz * dz);

        d += dlen;

        len_set.push(dlen);
        time_set.push(dt);
      } else {
        start_time = pt[3];
      }

      lx = pt[0];
      ly = pt[1];
      lz = pt[2];
      lt = pt[3];
    }

    var dpos = start_time;
    var ptofs = obj.points.length;

    for (pCount = 0; pCount < len_set.length; pCount++) {
      var segLen = len_set[pCount];
      var segTime = time_set[pCount];
      var segNum = Math.ceil((segLen / divsper) * divs);

      for (var t = dpos, tMax = dpos + segTime, tInc = (segTime / segNum); t < (tMax - tInc); t += tInc) {
        if (t === dpos) {
          lx = strokeEnvX.evaluate(t);
          ly = strokeEnvY.evaluate(t);
          lz = strokeEnvZ.evaluate(t);
        }

        var px, py, pz;

        px = strokeEnvX.evaluate(t + tInc);
        py = strokeEnvY.evaluate(t + tInc);
        pz = strokeEnvZ.evaluate(t + tInc);

        var pdx = (px - lx),
          pdy = py - ly,
          pdz = pz - lz;
        var pd = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
        var a;

        a = vec3.multiply(
        vec3.normalize(
        vec3.cross(this.viewvector, vec3.normalize([pdx, pdy, pdz]))), pwidth / 2.0);

        obj.addPoint([lx - a[0], -(ly - a[1]), (lz - a[2]) + (extrude ? (extrude_depth / 2.0) : 0)]);
        obj.addPoint([lx + a[0], -(ly + a[1]), (lz + a[2]) + (extrude ? (extrude_depth / 2.0) : 0)]);

        lx = px;
        ly = py;
        lz = pz;
      }

      dpos += segTime;
    }

    var ptlen = obj.points.length;

    if (extrude) {
      for (i = ptofs, iMax = ptlen; i < iMax; i++) {
        obj.addPoint([obj.points[i][0], obj.points[i][1], obj.points[i][2] - (extrude ? (extrude_depth / 2.0) : 0)]);
      }
    }

    for (i = 0, iMax = ptlen - ptofs; i <= iMax - 4; i += 2) {
      if (segCount % seg_mod === 0) {
        faceSegment++;
      }

      obj.setSegment(faceSegment);

      var arFace = [ptofs + i, ptofs + i + 1, ptofs + i + 3, ptofs + i + 2];
      var ftest = vec3.dot(this.viewvector, triangle.normal(arFace[0], arFace[1], arFace[2]));

      var faceNum = obj.addFace(arFace);
      if (ftest < 0) {
        this.faces[faceNum].flip();
      }

      if (extrude) {
        var arFace2 = [arFace[3] + ptlen - ptofs, arFace[2] + ptlen - ptofs, arFace[1] + ptlen - ptofs, arFace[0] + ptlen - ptofs];
        faceNum = obj.addFace(arFace2);

        arFace2 = [ptofs + i, ptofs + i + 2, ptofs + i + 2 + ptlen - ptofs, ptofs + i + ptlen - ptofs];
        faceNum = obj.addFace(arFace2);

        arFace2 = [ptofs + i + 1 + ptlen - ptofs, ptofs + i + 3 + ptlen - ptofs, ptofs + i + 3, ptofs + i + 1];
        faceNum = obj.addFace(arFace2);

        if (i === 0) {
          arFace2 = [ptofs + i + ptlen - ptofs, ptofs + i + 1 + ptlen - ptofs, ptofs + i + 1, ptofs + i];
          faceNum = obj.addFace(arFace2);
        }
        if (i === iMax - 4) {
          arFace2 = [ptofs + i + 2, ptofs + i + 3, ptofs + i + 3 + ptlen - ptofs, ptofs + i + 2 + ptlen - ptofs];
          faceNum = obj.addFace(arFace2);
        }
      }

      segCount++;
    }
  }


  obj.calcFaceNormals();

  obj.triangulateQuads();
  obj.calcNormals();
  obj.compile();

  return obj;
};


/* Particle System */

function Particle(pos, start_time, life_time, velocity, accel) {
  this.startpos = new Float32Array(pos);
  this.pos = new Float32Array(pos);
  this.velocity = new Float32Array((velocity !== undef) ? velocity : [0, 0, 0]);
  this.accel = new Float32Array((accel !== undef) ? accel : [0, 0, 0]);
  this.start_time = (start_time !== undef) ? start_time : 0;
  this.life_time = (life_time !== undef) ? life_time : 0;
  this.color = null;
  this.nextParticle = null;
}


function ParticleSystem(maxPts, hasColor, pTex, vWidth, vHeight, alpha, alphaCut) {
  var gl = GLCore.gl;

  if (!maxPts) {
    return;
  }

  this.particles = null;
  this.last_particle = null;
  this.pTex = (pTex !== undef) ? pTex : null;
  this.vWidth = vWidth;
  this.vHeight = vHeight;
  this.alpha = (alpha !== undef) ? alpha : false;
  this.alphaCut = (alphaCut !== undef) ? alphaCut : 0;

  this.pfunc = function(p, time) {
    var tdelta = time - p.start_time;

    if (tdelta < 0) {
      return 0;
    }
    if (tdelta > p.life_time && p.life_time) {
      return -1;
    }

    p.pos[0] = p.startpos[0] + (tdelta * p.velocity[0]) + (tdelta * tdelta * p.accel[0]);
    p.pos[1] = p.startpos[1] + (tdelta * p.velocity[1]) + (tdelta * tdelta * p.accel[1]);
    p.pos[2] = p.startpos[2] + (tdelta * p.velocity[2]) + (tdelta * tdelta * p.accel[2]);

    if (this.pgov !== null) {
      this.pgov(p, time);
    }

    return 1;
  };

  this.pgov = null;

  if (hasColor === undef) {
    this.hasColor = false;
  } else {
    this.hasColor = hasColor;
  }

  //    gl.enable(gl.VERTEX_PROGRAM_POINT_SIZE);
  var hasTex = (this.pTex !== null);

  this.vs = [
    "#ifdef GL_ES",
    "precision highp float;",
    "#endif",
    "attribute vec3 aVertexPosition;",
    this.hasColor ? "attribute vec3 aColor;" : "",
    "uniform mat4 uMVMatrix;",
    "uniform mat4 uPMatrix;",
    "varying vec4 color;",
    "varying vec2 screenPos;",
    hasTex ? "varying float pSize;" : "",
    "void main(void) {",
      "vec4 position = uPMatrix * uMVMatrix * vec4(aVertexPosition,1.0);",
      hasTex ? "screenPos=vec2(position.x/position.w,position.y/position.w);" : "",
      "gl_Position = position;",
      this.hasColor ? "color = vec4(aColor.r,aColor.g,aColor.b,1.0);" : "color = vec4(1.0,1.0,1.0,1.0);",
      hasTex ? "pSize=200.0/position.z;" : "float pSize=200.0/position.z;",
      "gl_PointSize = pSize;",
    "}"].join("\n");

  this.fs = [
    "#ifdef GL_ES",
    "precision highp float;",
    "#endif",

    hasTex ? "uniform sampler2D pMap;" : "",


    "varying vec4 color;",
    hasTex ? "varying vec2 screenPos;" : "",
    hasTex ? "uniform vec3 screenDim;" : "",
    hasTex ? "varying float pSize;" : "",

    "void main(void) {",
      "vec4 c = color;",
      hasTex ? "vec2 screen=vec2((gl_FragCoord.x/screenDim.x-0.5)*2.0,(gl_FragCoord.y/screenDim.y-0.5)*2.0);" : "",
      hasTex ? "vec2 pointCoord=vec2( ((screen.x-screenPos.x)/(pSize/screenDim.x))/2.0+0.5,((screen.y-screenPos.y)/(pSize/screenDim.y))/2.0+0.5);" : "",
      hasTex ? "vec4 tc = texture2D(pMap,pointCoord); gl_FragColor = vec4(c.rgb*tc.rgb,1.0);" : "gl_FragColor = c;",
    "}"].join("\n");

  this.maxPoints = maxPts;
  this.numParticles = 0;
  this.arPoints = new Float32Array(maxPts * 3);
  this.glPoints = null;

  if (hasColor) {
    this.arColor = new Float32Array(maxPts * 3);
    this.glColor = null;
  }

  this.shader_particle = new Shader(this.vs, this.fs);
  this.shader_particle.use();
  this.shader_particle.addVertexArray("aVertexPosition");

  if (this.hasColor) {
    this.shader_particle.addVertexArray("aColor");
  }

  this.shader_particle.addMatrix("uMVMatrix");
  this.shader_particle.addMatrix("uPMatrix");

  if (this.pTex !== null) {
    this.shader_particle.addInt("pMap", 0);
    this.shader_particle.addVector("screenDim");
    this.shader_particle.setVector("screenDim", [vWidth, vHeight, 0]);
  }

  this.genBuffer();
}


ParticleSystem.prototype.resizeView = function(vWidth, vHeight) {
  this.vWidth = vWidth;
  this.vHeight = vHeight;

  if (this.pTex !== null) {
    this.shader_particle.addVector("screenDim");
    this.shader_particle.setVector("screenDim", [vWidth, vHeight, 0]);
  }
};


ParticleSystem.prototype.addParticle = function(p) {
  if (this.last_particle === null) {
    this.particles = p;
    this.last_particle = p;
  } else {
    this.last_particle.nextParticle = p;
    this.last_particle = p;
  }
};

ParticleSystem.prototype.genBuffer = function() {
  var gl = GLCore.gl;

  this.glPoints = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
  gl.bufferData(gl.ARRAY_BUFFER, this.arPoints, gl.DYNAMIC_DRAW);

  if (this.hasColor) {
    this.glColor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
    gl.bufferData(gl.ARRAY_BUFFER, this.arColor, gl.DYNAMIC_DRAW);
  }
};

ParticleSystem.prototype.updatePoints = function() {
  var gl = GLCore.gl;

  // buffer update
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
  gl.bufferData(gl.ARRAY_BUFFER, this.arPoints, gl.DYNAMIC_DRAW);
  // end buffer update
};

ParticleSystem.prototype.updateColors = function() {
  var gl = GLCore.gl;

  if (!this.hasColor) {
    return;
  }
  // buffer update
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
  gl.bufferData(gl.ARRAY_BUFFER, this.arColor, gl.DYNAMIC_DRAW);
  // end buffer update
};

ParticleSystem.prototype.draw = function(modelViewMat, projectionMat, time) {
  var gl = GLCore.gl;

  this.shader_particle.init(true);

  this.shader_particle.use();

  if (this.pTex !== null) {
    this.pTex.use(gl.TEXTURE0);
  }

  this.shader_particle.setMatrix("uMVMatrix", modelViewMat);
  this.shader_particle.setMatrix("uPMatrix", projectionMat);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
  gl.vertexAttribPointer(this.shader_particle.uniforms["aVertexPosition"], 3, gl.FLOAT, false, 0, 0);

  if (this.hasColor) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
    gl.vertexAttribPointer(this.shader_particle.uniforms["aColor"], 3, gl.FLOAT, false, 0, 0);
  }

  if (time === undef) {
    time = 0;
  }

  if (this.particles === null) {
    return;
  }

  var p = this.particles;
  var lp = null;


  this.numParticles = 0;

  var c = 0;

  while (p !== null) {
    var ofs = this.numParticles * 3;
    var pf = this.pfunc(p, time);

    if (pf === 1) {
      this.arPoints[ofs] = p.pos[0];
      this.arPoints[ofs + 1] = p.pos[1];
      this.arPoints[ofs + 2] = p.pos[2];

      if (p.color !== null) {
        this.arColor[ofs] = p.color[0];
        this.arColor[ofs + 1] = p.color[1];
        this.arColor[ofs + 2] = p.color[2];
      }

      this.numParticles++;
      c++;
      if (this.numParticles === this.maxPoints) {
        break;
      }
    } else if (pf === -1) // particle death
    {
      if (lp !== null) {
        lp.nextParticle = p.nextParticle;
      }
    }
    else if (pf === 0) {
      c++;
    }

    lp = p;
    p = p.nextParticle;
  }

  if (!c) {
    this.particles = null;
    this.last_particle = null;
  }

  this.updatePoints();
  if (this.hasColor) {
    this.updateColors();
  }

  if (this.alpha) {
    gl.enable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(0);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
  }

  gl.drawArrays(gl.POINTS, 0, this.numParticles);

  if (this.alpha) {
    // gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(1);
    gl.blendFunc(gl.ONE, gl.ONE);
  }
};

/* SkyBox */

function SkyBox(input_texture,mapping) {
  var texture = input_texture;
  if (mapping !== undef) {
    this.mapping = mapping;
  } else {
    this.mapping = [[1/3, 0.5, 2/3, 1],      //top
                    [0, 0.5, 1/3, 1],        //bottom
                    [0, 0, 1/3, 0.5],        //left
                    [2/3, 0, 1, 0.5],        //right
                    [2/3, 0.5, 1, 1],        //front
                    [1/3, 0, 2/3, 0.5]];     //back
  } //if

  if (typeof(texture) === "string") {
    texture = new Texture(input_texture);
  } //if

  var mat = new Material("skybox");
  var obj = new Mesh();
  obj.sky_mapping = this.mapping;
  cubicvr_boxObject(obj, 1, mat);
  obj.calcNormals();
  var mat_map = new UVMapper();
  mat_map.projection_mode = enums.uv.projection.SKY;
  mat_map.scale = [1, 1, 1];
  mat_map.apply(obj, mat);
  obj.triangulateQuads();
  obj.compile();
  mat.setTexture(texture);
  this.scene_object = new SceneObject(obj);
} //cubicvr_SkyBox::Constructor
var onmessage = function(e) {
  var message = e.data.message;
  if (message === "start") {
    switch (e.data.data) {
    case "octree":
      var octree = new CubicVR_OcTreeWorker();
      global_worker_store.listener = octree;
      setInterval(CubicVR_OctreeWorker_mkInterval(global_worker_store), 50);
      break;
    } //switch
  } else if (message === "data") {
    if (global_worker_store.listener !== null) {
      global_worker_store.listener.onmessage(e);
    } //if
  } //if
}; //onmessage
// Extend CubicVR module by adding public methods and classes
var extend = {
  enums: enums,
  vec2: vec2,
  vec3: vec3,
  mat4: mat4,
  util: util,
  IdentityMatrix: cubicvr_identity,
  GLCore: GLCore,
  Transform: Transform,
  Light: Light,
  Texture: Texture,
  PJSTexture: PJSTexture,
  UVMapper: UVMapper,
  Scene: Scene,
  SceneObject: SceneObject,
  Face: Face,
  Material: Material,
  Materials: Materials,
  Textures: Textures,
  Images: Images,
  Shader: Shader,
  Landscape: Landscape,
  Camera: Camera,
  GML: GML,
  SkyBox: SkyBox,
  Envelope: Envelope,
  Motion: Motion,
  RenderBuffer: RenderBuffer,
  PostProcessFX: PostProcessFX,
  PostProcessChain: PostProcessChain,
  PostProcessShader: PostProcessShader,
  Particle: Particle,
  ParticleSystem: ParticleSystem,
  OcTree: OcTree,
  AutoCamera: AutoCamera,
  Mesh: Mesh,
  genPlaneObject: cubicvr_planeObject,
  genBoxObject: cubicvr_boxObject,
  genLatheObject: cubicvr_latheObject,
  renderObject: cubicvr_renderObject,
  globalAmbient: [0.1, 0.1, 0.1],
  setGlobalAmbient: function(c) {
    CubicVR.globalAmbient = c;
  },
  loadMesh: cubicvr_loadMesh,
  loadCollada: cubicvr_loadCollada,
  setGlobalDepthAlpha: GLCore.setDepthAlpha
};

for (var ext in extend) {
  if (extend.hasOwnProperty(ext)) {
    this.CubicVR[ext] = extend[ext];
  }
}

Materials.push(new Material("(null)"));
}());

