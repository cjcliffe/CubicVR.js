/*
  Javascript port of CubicVR 3D engine for WebGL
  by Charles J. Cliffe
  http://www.cubicvr.org/

  May be used under the terms of LGPL v3.0 or greater.
*/

/*globals alert: false */

var CubicVR = null;
var CubicVR_GLCore = {};
var CubicVR_Materials = [];
var CubicVR_Material_ref = [];
var CubicVR_Textures = [];
var CubicVR_Textures_obj = [];
var CubicVR_Texture_ref = [];
var CubicVR_Images = [];
var CubicVR_ShaderPool = [];
var CubicVR_MeshPool = [];

var CubicVR_CoreShader_vs = null;
var CubicVR_CoreShader_fs = null;



var M_PI = 3.1415926535897932384626433832795028841968;
var M_TWO_PI = 2.0 * M_PI;
var M_HALF_PI = M_PI / 2.0;

// Light Types
var LIGHT_TYPE_NULL = 0;
var LIGHT_TYPE_POINT = 1;
var LIGHT_TYPE_DIRECTIONAL = 2;
var LIGHT_TYPE_SPOT = 3;
var LIGHT_TYPE_AREA = 4;
var LIGHT_TYPE_MAX = 5;

// Texture Types
var TEXTURE_MAP_COLOR = 0;
var TEXTURE_MAP_ENVSPHERE = 1;
var TEXTURE_MAP_NORMAL = 2;
var TEXTURE_MAP_BUMP = 3;
var TEXTURE_MAP_REFLECT = 4;
var TEXTURE_MAP_SPECULAR = 5;
var TEXTURE_MAP_AMBIENT = 6;
var TEXTURE_MAP_ALPHA = 7;

// Particles
var PARTICLE_BUCKET_SIZE = 20;
var PARTICLE_EMITTER_TYPE_DETERMINISTIC = 0;
var PARTICLE_EMITTER_TYPE_NONDETERMINISTIC = 1;
var PARTICLE_EMITTER_MAX_PARTICLES = 200;

// Shader Map Inputs (binary hash index)
var SHADER_COLOR_MAP = 1;
var SHADER_SPECULAR_MAP = 2;
var SHADER_NORMAL_MAP = 4;
var SHADER_BUMP_MAP = 8;
var SHADER_REFLECT_MAP = 16;
var SHADER_ENVSPHERE_MAP = 32;
var SHADER_AMBIENT_MAP = 64;
var SHADER_ALPHA = 128;
var SHADER_ALPHA_MAP = 256;


/* Uniform types */
var UNIFORM_TYPE_MATRIX = 0;
var UNIFORM_TYPE_VECTOR = 1;
var UNIFORM_TYPE_FLOAT = 2;
var UNIFORM_TYPE_ARRAY_VERTEX = 3;
var UNIFORM_TYPE_ARRAY_UV = 4;
var UNIFORM_TYPE_ARRAY_FLOAT = 5;
var UNIFORM_TYPE_INT = 6;



/* UV Projection enums */
var UV_PROJECTION_UV = 0;
var UV_PROJECTION_PLANAR = 1;
var UV_PROJECTION_CYLINDRICAL = 2;
var UV_PROJECTION_SPHERICAL = 3;
var UV_PROJECTION_CUBIC = 4;
var UV_PROJECTION_SKY = 5;

/* UV Axis enums */
var UV_AXIS_X = 0;
var UV_AXIS_Y = 1;
var UV_AXIS_Z = 2;


// Envelopes

var MOTION_POS = 0;
var MOTION_ROT = 1;
var MOTION_SCL = 2;
var MOTION_FOV = 3;

var MOTION_X = 0;
var MOTION_Y = 1;
var MOTION_Z = 2;
var MOTION_V = 3;


var ENV_SHAPE_TCB = 0;
var ENV_SHAPE_HERM = 1;
var ENV_SHAPE_BEZI = 2;
var ENV_SHAPE_LINE = 3;
var ENV_SHAPE_STEP = 4;
var ENV_SHAPE_BEZ2 = 5;

var ENV_BEH_RESET = 0;
var ENV_BEH_CONSTANT = 1;
var ENV_BEH_REPEAT = 2;
var ENV_BEH_OSCILLATE = 3;
var ENV_BEH_OFFSET = 4;
var ENV_BEH_LINEAR = 5;




var cubicvr_identity = [1.0, 0.0, 0.0, 0.0,
      0.0, 1.0, 0.0, 0.0,
      0.0, 0.0, 1.0, 0.0,
      0.0, 0.0, 0.0, 1.0];

var cubicvr_getScriptContents = function(id) {
  var shaderScript = document.getElementById(id);

  if (!shaderScript) {
    return null;
  }

  var str = "";

  if (shaderScript.src !== "" || typeof(shaderScript.attributes['srcUrl']) !== "undefined") {
    var srcUrl = (shaderScript.src !== '') ? shaderScript.src : (shaderScript.attributes['srcUrl'].value);

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
};


/* Core Init, single context only at the moment */
CubicVR_GLCore.init = function(gl_in, vs_in, fs_in) {
  var gl = gl_in;

  CubicVR_GLCore.gl = gl_in;
  CubicVR_GLCore.CoreShader_vs = cubicvr_getScriptContents(vs_in);
  CubicVR_GLCore.CoreShader_fs = cubicvr_getScriptContents(fs_in);

  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.frontFace(gl.CCW);

  for (var i = LIGHT_TYPE_NULL; i < LIGHT_TYPE_MAX; i++) {
    CubicVR_ShaderPool[i] = [];
  }
};


/* Base functions */
var cubicvr_xyz = function(x, y, z) {
  return [x ? x : 0, y ? y : 0, z ? z : 0];
};
var cubicvr_rgb = function(r, g, b) {
  return [r ? r : 0, g ? g : 0, b ? b : 0];
};
var cubicvr_rgba = function(r, g, b, a) {
  return [r ? r : 0, g ? g : 0, b ? b : 0, a ? a : 0];
};

var cubicvr_calcNormal = function(pt1, pt2, pt3) {
  var v1 = [pt1[0] - pt2[0], pt1[1] - pt2[1], pt1[2] - pt2[2]];

  var v2 = [pt2[0] - pt3[0], pt2[1] - pt3[1], pt2[2] - pt3[2]];

  return [v1[1] * v2[2] - v1[2] * v2[1], v1[2] * v2[0] - v1[0] * v2[2], v1[0] * v2[1] - v1[1] * v2[0]];
};

var cubicvr_normalize = function(pt) {
  var d = Math.sqrt((pt[0] * pt[0]) + (pt[1] * pt[1]) + (pt[2] * pt[2]));
  if (d === 0) { return [0, 0, 0]; }
  return [pt[0] / d, pt[1] / d, pt[2] / d];
};

var cubicvr_length = function(pt) {
  return Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1] + pt[2] * pt[2]);
};

var cubicvr_dp = function(v1, v2) {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
};

var cubicvr_angle = function(v1, v2) {
  var a = Math.acos((v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]) * Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2])));

  return a;
};

var cubicvr_crossProduct = function(vectA, vectB) {
  return [
  vectA[1] * vectB[2] - vectB[1] * vectA[2], vectA[2] * vectB[0] - vectB[2] * vectA[0], vectA[0] * vectB[1] - vectB[0] * vectA[1]];
};

var cubicvr_vertex_mul_const = function(vectA, constB) {
  return [vectA[0] * constB, vectA[1] * constB, vectA[2] * constB];
};

var cubicvr_vertex_add = function(vectA, vectB) {
  return [vectA[0] + vectB[0], vectA[1] + vectB[1], vectA[2] + vectB[2]];
};

var cubicvr_vertex_sub = function(vectA, vectB) {
  return [vectA[0] - vectB[0], vectA[1] - vectB[1], vectA[2] - vectB[2]];
};

var cubicvr_vtx_eq = function(a, b) {
  var epsilon = 0.00000001;

  if ((typeof(a) === 'undefined') && (typeof(b) === 'undefined')) { return true; }
  if ((typeof(a) === 'undefined') || (typeof(b) === 'undefined')) { return false; }

  return (Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon && Math.abs(a[2] - b[2]) < epsilon);
};

var cubicvr_uv_eq = function(a, b) {
  var epsilon = 0.00000001;

  if ((typeof(a) === 'undefined') && (typeof(b) === 'undefined')) { return true; }
  if ((typeof(a) === 'undefined') || (typeof(b) === 'undefined')) { return false; }

  return (Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon);
};

function cubicvr_moveViewRelative(position, target, xdelta, zdelta, alt_source) {
  var ang = Math.atan2(zdelta, xdelta);
  var cam_ang = Math.atan2(target[2] - position[2], target[0] - position[0]);
  var mag = Math.sqrt(xdelta * xdelta + zdelta * zdelta);

  var move_ang = cam_ang + ang + M_HALF_PI;

  if (typeof(alt_source) === 'object') {
    return [alt_source[0] + mag * Math.cos(move_ang), alt_source[1], alt_source[2] + mag * Math.sin(move_ang)];
  }

  return [position[0] + mag * Math.cos(move_ang), position[1], position[2] + mag * Math.sin(move_ang)];
}


function cubicvr_trackTarget(position, target, trackingSpeed, safeDistance) {
  var camv = cubicvr_vertex_sub(target, position);
  var dist = camv;
  var fdist = cubicvr_length(dist);
  var motionv = camv;

  motionv = cubicvr_normalize(motionv);
  motionv = cubicvr_vertex_mul_const(motionv, trackingSpeed * (1.0 / (1.0 / (fdist - safeDistance))));

  var ret_pos;

  if (fdist > safeDistance) {
    ret_pos = cubicvr_vertex_add(position, motionv);
  } else if (fdist < safeDistance) {
    motionv = camv;
    motionv = cubicvr_normalize(motionv);
    motionv = cubicvr_vertex_mul_const(motionv, trackingSpeed * (1.0 / (1.0 / (Math.abs(fdist - safeDistance)))));
    ret_pos = cubicvr_vertex_sub(position, motionv);
  } else {
    ret_pos = [position[0], position[1] + motionv[2], position[2]];
  }

  return ret_pos;
}


var cubicvr_getXML = function(srcUrl) {
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





/* Transform Controller */
var cubicvr_transform = function(init_mat) {
  return this.clearStack(init_mat);
};

cubicvr_transform.prototype.setIdentity = function() {
  this.m_stack[this.c_stack] = this.getIdentity();
  if (this.valid === this.c_stack && this.c_stack) { this.valid--; }
  return this;
};


cubicvr_transform.prototype.getIdentity = function() {
  return [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
};

cubicvr_transform.prototype.invalidate = function() {
  this.valid = 0;
  this.result = null;
  return this;
};

cubicvr_transform.prototype.getResult = function() {
  if (!this.c_stack) { return this.m_stack[0]; }

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
          this.m_cache[i] = this.multiply4_4by4_4(this.m_cache[i - 1], this.m_stack[i]);
        }
        this.valid++;
      }
    }

    this.result = this.m_cache[this.valid - 1];
  }
  return this.result;
};

cubicvr_transform.prototype.pushMatrix = function(m) {
  this.c_stack++;
  this.m_stack.push(m ? m : this.getIdentity());
  return this;
};

cubicvr_transform.prototype.popMatrix = function() {
  if (this.c_stack === 0) { return; }
  this.c_stack--;
  return this;
};

cubicvr_transform.prototype.clearStack = function(init_mat) {
  this.m_stack = [];
  this.m_cache = [];
  this.c_stack = 0;
  this.valid = 0;
  this.result = null;

  if (typeof(init_mat) !== 'undefined') {
    this.m_stack[0] = init_mat;
  } else {
    this.setIdentity();
  }

  return this;
};

cubicvr_transform.prototype.multiply4_4by4_4 = function(m1, m2) {
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
};

cubicvr_transform.prototype.m_mat = cubicvr_transform.prototype.multiply4_4by4_4;


cubicvr_transform.prototype.multiply1_4by4_4 = function(m1, m2) {
  var mOut = [];

  mOut[0] = m2[0] * m1[0] + m2[4] * m1[1] + m2[8] * m1[2] + m2[12] * m1[3];
  mOut[1] = m2[1] * m1[0] + m2[5] * m1[1] + m2[9] * m1[2] + m2[13] * m1[3];
  mOut[2] = m2[2] * m1[0] + m2[6] * m1[1] + m2[10] * m1[2] + m2[14] * m1[3];
  mOut[3] = m2[3] * m1[0] + m2[7] * m1[1] + m2[11] * m1[2] + m2[15] * m1[3];

  return mOut;
};

cubicvr_transform.prototype.m_vector = cubicvr_transform.prototype.multiply1_4by4_4;


cubicvr_transform.prototype.m_point = cubicvr_transform.prototype.multiply1_3by4_4 = function(m1, m2) {
  var mOut = [];

  mOut[0] = m2[0] * m1[0] + m2[4] * m1[1] + m2[8] * m1[2] + m2[12];
  mOut[1] = m2[1] * m1[0] + m2[5] * m1[1] + m2[9] * m1[2] + m2[13];
  mOut[2] = m2[2] * m1[0] + m2[6] * m1[1] + m2[10] * m1[2] + m2[14];

  return mOut;
};


cubicvr_transform.prototype.translate = function(x, y, z) {
  if (typeof(x) === 'object') {
    return this.translate(x[0], x[1], x[2]);
  }

  var m = this.getIdentity();

  m[12] = x;
  m[13] = y;
  m[14] = z;

  this.m_stack[this.c_stack] = this.multiply4_4by4_4(this.m_stack[this.c_stack], m);
  if (this.valid === this.c_stack && this.c_stack) { this.valid--; }

  return this;
};


cubicvr_transform.prototype.scale = function(x, y, z) {
  if (typeof(x) === 'object') {
    return this.scale(x[0], x[1], x[2]);
  }


  var m = this.getIdentity();

  m[0] = x;
  m[5] = y;
  m[10] = z;

  this.m_stack[this.c_stack] = this.multiply4_4by4_4(this.m_stack[this.c_stack], m);
  if (this.valid === this.c_stack && this.c_stack) { this.valid--; }

  return this;
};


cubicvr_transform.prototype.rotate = function(ang, x, y, z) {
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

    this.m_stack[this.c_stack] = this.multiply4_4by4_4(this.m_stack[this.c_stack], Z_ROT);
  }

  if (y) {
    var Y_ROT = this.getIdentity();

    Y_ROT[0] = cAng * y;
    Y_ROT[8] = -sAng * y;
    Y_ROT[2] = sAng * y;
    Y_ROT[10] = cAng * y;

    this.m_stack[this.c_stack] = this.multiply4_4by4_4(this.m_stack[this.c_stack], Y_ROT);
  }


  if (x) {
    var X_ROT = this.getIdentity();

    X_ROT[5] = cAng * x;
    X_ROT[9] = sAng * x;
    X_ROT[6] = -sAng * x;
    X_ROT[10] = cAng * x;

    this.m_stack[this.c_stack] = this.multiply4_4by4_4(this.m_stack[this.c_stack], X_ROT);
  }

  if (this.valid === this.c_stack && this.c_stack) { this.valid--; }

  return this;
};

/* Projection / Modelview matrix manipulation */

var cubicvr_perspective = function(fovy, aspect, near, far) {
  var yFac = Math.tan(fovy * M_PI / 360.0);
  var xFac = yFac * aspect;

  return [
  1.0 / xFac, 0, 0, 0, 0, 1.0 / yFac, 0, 0, 0, 0, -(far + near) / (far - near), -1, 0, 0, -(2.0 * far * near) / (far - near), 0];
};


var cubicvr_lookat = function(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ) {
  var view_vec = cubicvr_normalize([lookAtX - eyeX, lookAtY - eyeY, lookAtZ - eyeZ]);
  var up_vec = cubicvr_normalize([upX, upY, upZ]);

  var s = cubicvr_crossProduct(view_vec, up_vec);
  var u = cubicvr_crossProduct(s, view_vec);

  var mat = [
    s[0], u[0], -view_vec[0], 0,
    s[1], u[1], -view_vec[1], 0,
    s[2], u[2], -view_vec[2], 0,
    0, 0, 0, 1
    ];

  var trans = new cubicvr_transform();
  trans.translate(-eyeX, -eyeY, -eyeZ);
  trans.pushMatrix(mat);

  mat = trans.getResult();

  return mat;
};

/* Quaternions */

cubicvr_Quaternion = function()
{
	if (arguments.length==1) { this.x = arguments[0][0]; this.x = arguments[0][1]; this.x = arguments[0][2]; this.x = arguments[0][3]; }
	if (arguments.length==4) { this.x = arguments[0]; this.y = arguments[0]; this.z = arguments[0]; this.w = arguments[0]; }
} 

cubicvr_Quaternion.prototype.length = function()
{
	return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w);
}

cubicvr_Quaternion.prototype.normalize = function()
{
	var n=Math.sqrt(this.length());
	this.x /= n;
	this.y /= n;
	this.z /= n;
	this.w /= n;
}

cubicvr_Quaternion.prototype.fromEuler = function(bank,heading,pitch)	// x,y,z
{
  var c1 = Math.cos((M_PI/180.0)*heading/2.0);
  var s1 = Math.sin((M_PI/180.0)*heading/2.0);
  var c2 = Math.cos((M_PI/180.0)*pitch/2.0);
  var s2 = Math.sin((M_PI/180.0)*pitch/2.0);
  var c3 = Math.cos((M_PI/180.0)*bank/2.0);
  var s3 = Math.sin((M_PI/180.0)*bank/2.0);
  var c1c2 = c1*c2;
  var s1s2 = s1*s2;

  this.w =c1c2*c3 - s1s2*s3;
	this.x =c1c2*s3 + s1s2*c3;
	this.y =s1*c2*c3 + c1*s2*s3;
	this.z =c1*s2*c3 - s1*c2*s3;
}


cubicvr_Quaternion.prototype.toEuler = function()
{
 	var sqw = this.w*this.w; 
	var sqx = this.x*this.x; 
	var sqy = this.y*this.y; 
	var sqz = this.z*this.z;
	
	var x = (180/M_PI)*((Math.atan2(2.0 * (this.y*this.z + this.x*this.w),(-sqx - sqy + sqz + sqw))));
	var y = (180/M_PI)*((Math.asin(-2.0 * (this.x*this.z - this.y*this.w))));
	var z = (180/M_PI)*((Math.atan2(2.0 * (this.x*this.y + this.z*this.w),(sqx - sqy - sqz + sqw))));

	return [x,y,z];
}

cubicvr_Quaternion.prototype.multiply = function(q1,q2)
{	
  var selfSet = false;

	if (typeof(q2)==='undefined')
	{
		q2 = q1;
		q1 = this;
	}
	
	var x = q1.x*q2.w + q1.w*q2.x + q1.y*q2.z - q1.z*q2.y;
	var y = q1.y*q2.w + q1.w*q2.y + q1.z*q2.x - q1.x*q2.z;
	var z = q1.z*q2.w + q1.w*q2.z + q1.x*q2.y - q1.y*q2.x;
	var w = q1.w*q2.w - q1.x*q2.x - q1.y*q2.y - q1.z*q2.z;
	
	if (selfSet) { this.x = x; this.y = y; this.z = z; this.w = w; } else { return new cubicvr_Quaternion(x,y,z,w); }
}


/* Faces */
var cubicvr_face = function() {
  this.points = [];
  this.point_normals = [];
  this.uvs = [];
  this.normal = [0, 0, 0];
  this.material = 0;
  this.segment = 0;
};

cubicvr_face.prototype.setUV = function(uvs, point_num) {
  if (typeof(this.uvs) === 'undefined') { this.uvs = []; }

  if (typeof(point_num) !== 'undefined') {
    this.uvs[point_num] = uvs;
  } else {
    if (uvs.length !== 2) { 
      this.uvs = uvs;
    } else { 
      this.uvs.push(uvs);
    }
  }
};

cubicvr_face.prototype.flip = function() {
  for (var i = 0, iMax = this.point_normals.length; i < iMax; i++) {
    this.point_normals[i] = [this.point_normals[i][0], this.point_normals[i][1], this.point_normals[i][2]];
  }

  this.points.reverse();
  this.point_normals.reverse();
  this.uvs.reverse();
  this.normal = [-this.normal[0], -this.normal[1], -this.normal[2]];
};

var cubicvr_object = function(objName) {
  this.points = []; // point list
  this.faces = []; // faces with point references
  this.currentFace = -1; // start with no faces
  this.currentMaterial = 0; // null material
  this.currentSegment = 0; // default segment
  this.compiled = null; // VBO data
  this.bb = null;
  this.name = objName ? objName : null;
};

cubicvr_object.prototype.showAllSegments = function() {
  for (var i in this.segment_state) {
    if (this.segment_state.hasOwnProperty(i)) { 
      this.segment_state[i] = true;
    }
  }
};

cubicvr_object.prototype.hideAllSegments = function() {
  for (var i in this.segment_state) {
    if (this.segment_state.hasOwnProperty(i)) { 
      this.segment_state[i] = false;
    }
  }
};

cubicvr_object.prototype.setSegment = function(i, val) {
  if (typeof(val) !== 'undefined') {
    this.segment_state[i] = val;
  } else {
    this.currentSegment = i;
  }
};

cubicvr_object.prototype.addPoint = function(p) {
  if (p.length !== 3 || typeof(p[0]) === 'object') {
    for (var i = 0, iMax = p.length; i < iMax; i++) {
      this.points.push(p[i]);
    }
  } else {
    this.points.push(p);
  }

  return this.points.length - 1;
};

cubicvr_object.prototype.setFaceMaterial = function(mat) {
  this.currentMaterial = (typeof(mat) === 'object') ? mat.material_id : mat;
};

cubicvr_object.prototype.addFace = function(p_list, face_num, face_mat, face_seg) {
  if (typeof(p_list[0]) !== 'number') {
    for (var i = 0, iMax = p_list.length; i < iMax; i++) {
      if (!p_list.hasOwnProperty(i)) { continue; }

      this.addFace(p_list[i]);
    }

    return;
  }

  if (typeof(face_num) === 'undefined') {
    this.currentFace = this.faces.length;
    this.faces.push(new cubicvr_face());
  } else {
    if (typeof(this.faces[face_num]) === 'undefined') {
      this.faces[face_num] = new cubicvr_face();
    }

    this.currentFace = face_num;
  }

  if (typeof(p_list) === 'object') {
    this.faces[this.currentFace].points = p_list;
  }

  if (typeof(face_mat) !== 'undefined') {
    this.faces[this.currentFace].material = (typeof(face_mat) === 'object') ? face_mat.material_id : face_mat;
  } else {
    this.faces[this.currentFace].material = this.currentMaterial;
  }

  if (typeof(face_seg) !== 'undefined') {
    this.faces[this.currentFace].segment = face_seg;
  } else {
    this.faces[this.currentFace].segment = this.currentSegment;
  }


  return this.currentFace;
};


cubicvr_object.prototype.triangulateQuads = function() {
  for (var i = 0, iMax = this.faces.length; i < iMax; i++) {
    if (this.faces[i].points.length === 4) {
      var p = this.faces.length;

      this.addFace([this.faces[i].points[2], this.faces[i].points[3], this.faces[i].points[0]], this.faces.length, this.faces[i].material, this.faces[i].segment);
      this.faces[i].points.pop();
      this.faces[p].normal = this.faces[i].normal;

      if (typeof(this.faces[i].uvs) !== 'undefined') {
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


cubicvr_object.prototype.booleanAdd = function(objAdd, transform) {
  var pofs = this.points.length;
  var fofs = this.faces.length;

  var i, j, iMax, jMax;

  if (typeof(transform) !== 'undefined') {
    var m = transform.getResult();
    for (i = 0, iMax = objAdd.points.length; i < iMax; i++) {
      this.addPoint(transform.multiply1_3by4_4(objAdd.points[i], m));
    }
  } else {
    for (i = 0, iMax = objAdd.points.length; i < iMax; i++) {
      this.addPoint([objAdd.points[i][0], objAdd.points[i][1], objAdd.points[i][2]]);
    }
  }

  for (i = 0, iMax = objAdd.faces.length; i < iMax; i++) {
    var newFace = Array();

    for (j = 0, jMax = objAdd.faces[i].points.length; j < jMax; j++) {
      newFace.push(objAdd.faces[i].points[j] + pofs);
    }

    var nFaceNum = this.addFace(newFace);

    this.faces[nFaceNum].segment = objAdd.faces[i].segment;

    for (j = 0, jMax = objAdd.faces[i].uvs.length; j < jMax; j++) {
      this.faces[nFaceNum].uvs[j] = [objAdd.faces[i].uvs[j][0], objAdd.faces[i].uvs[j][1]];
    }

    for (j = 0, jMax = objAdd.faces[i].point_normals.length; j < jMax; j++) {
      this.faces[nFaceNum].point_normals[j] = [objAdd.faces[i].point_normals[j][0], objAdd.faces[i].point_normals[j][1], objAdd.faces[i].point_normals[j][2]];
    }
  }
};

cubicvr_object.prototype.calcFaceNormals = function() {
  for (var i = 0, iMax = this.faces.length; i < iMax; i++) {
    if (this.faces[i].points.length < 3) {
      this.faces[i].normal = [0, 0, 0];
      continue;
    }

    this.faces[i].normal = cubicvr_normalize(cubicvr_calcNormal(this.points[this.faces[i].points[0]], this.points[this.faces[i].points[1]], this.points[this.faces[i].points[2]]));
  }
};


cubicvr_object.prototype.getMaterial = function(m_name) {
  for (var i in this.compiled.elements) {
    if (this.compiled.elements.hasOwnProperty(i)) { 
      if (CubicVR_Materials[i].name === m_name) {
        return CubicVR_Materials[i];
      }
    }
  }

  return null;
};


cubicvr_object.prototype.calcNormals = function() {
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

      //      if (typeof(point_smoothRef[idx]) === 'undefined') point_smoothRef[idx] = [];
      point_smoothRef[idx].push([i, j]);
    }
  }


  // step through smoothing references and compute normals
  for (i = 0, iMax = this.points.length; i < iMax; i++) {
    //    if(!point_smoothRef.hasOwnProperty(i)) { continue; }
    //    if (typeof(point_smoothRef[i]) === 'undefined') { continue; }
    var numPts = point_smoothRef[i].length;

    for (j = 0; j < numPts; j++) {
      var ptCount = 1;
      var faceNum = point_smoothRef[i][j][0];
      var pointNum = point_smoothRef[i][j][1];
      var max_smooth = CubicVR_Materials[this.faces[faceNum].material].max_smooth;
      var thisFace = this.faces[faceNum];

      // set point to it's face's normal
      var tmpNorm = new Array(3);

      tmpNorm[0] = thisFace.normal[0];
      tmpNorm[1] = thisFace.normal[1];
      tmpNorm[2] = thisFace.normal[2];

      // step through all other faces which share this point
      if (max_smooth !== 0) {
        for (k = 0; k < numPts; k++) {
          if (j === k) { continue; }
          var faceRefNum = point_smoothRef[i][k][0];
          var thisFaceRef = this.faces[faceRefNum];

          var ang = cubicvr_angle(thisFaceRef.normal, thisFace.normal);

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

      this.faces[faceNum].point_normals[pointNum] = cubicvr_normalize(tmpNorm);
    }
  }
};

cubicvr_object.prototype.compile = function() {
  this.compiled = {};

  this.bb = [];

  var compileRef = [];

  var i, j, k, x, y, iMax, kMax, yMax;

  for (i = 0, iMax = this.faces.length; i < iMax; i++) {
    if (this.faces[i].points.length === 3) {
      var matId = this.faces[i].material;
      var segId = this.faces[i].segment;

      if (typeof(compileRef[matId]) === 'undefined') { compileRef[matId] = []; }
      if (typeof(compileRef[matId][segId]) === 'undefined') { compileRef[matId][segId] = []; }

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

  var pVisitor = Array();

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

              if (typeof(vtxRef[ptNum]) !== 'undefined') {
                for (y = 0, yMax = vtxRef[ptNum].length; y < yMax; y++) {
                  // face / point
                  var oFace = vtxRef[ptNum][y][0]; // faceNum
                  var oPoint = vtxRef[ptNum][y][1]; // pointNum
                  var oIndex = vtxRef[ptNum][y][2]; // index
                  foundPt = oIndex;

                  if (hasNorm) {
                    foundPt = (cubicvr_vtx_eq(
                    this.faces[oFace].point_normals[oPoint], this.faces[faceNum].point_normals[x])) ? foundPt : -1;
                  }

                  if (hasUV) {
                    foundPt = (cubicvr_uv_eq(
                    this.faces[oFace].uvs[oPoint], this.faces[faceNum].uvs[x])) ? foundPt : -1;
                  }
                }
              }

              if (foundPt !== -1) {
                if (typeof(this.compiled.elements) === 'undefined') { this.compiled.elements = []; }
                if (typeof(this.compiled.elements[i]) === 'undefined') { this.compiled.elements[i] = []; }
                if (typeof(this.compiled.elements[i][j]) === 'undefined') { this.compiled.elements[i][j] = []; }
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
                  if (this.points[ptNum][0] < this.bb[0][0]) { this.bb[0][0] = this.points[ptNum][0]; }
                  if (this.points[ptNum][1] < this.bb[0][1]) { this.bb[0][1] = this.points[ptNum][1]; }
                  if (this.points[ptNum][2] < this.bb[0][2]) { this.bb[0][2] = this.points[ptNum][2]; }

                  if (this.points[ptNum][0] > this.bb[1][0]) { this.bb[1][0] = this.points[ptNum][0]; }
                  if (this.points[ptNum][1] > this.bb[1][1]) { this.bb[1][1] = this.points[ptNum][1]; }
                  if (this.points[ptNum][2] > this.bb[1][2]) { this.bb[1][2] = this.points[ptNum][2]; }
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

                if (typeof(this.compiled.elements) === 'undefined') { this.compiled.elements = []; }
                if (typeof(this.compiled.elements[i]) === 'undefined') { this.compiled.elements[i] = []; }
                if (typeof(this.compiled.elements[i][j]) === 'undefined') { this.compiled.elements[i][j] = []; }

                this.compiled.elements[i][j].push(idxCount);

                if (typeof(vtxRef[ptNum]) === 'undefined') { vtxRef[ptNum] = []; }

                vtxRef[ptNum].push([faceNum, x, idxCount]);
                idxCount++;
              }
            }
          }
        }
      }
    }
  }

  this.compiled.gl_points = CubicVR_GLCore.gl.createBuffer();
  CubicVR_GLCore.gl.bindBuffer(CubicVR_GLCore.gl.ARRAY_BUFFER, this.compiled.gl_points);
  CubicVR_GLCore.gl.bufferData(CubicVR_GLCore.gl.ARRAY_BUFFER, new Float32Array(this.compiled.vbo_points), CubicVR_GLCore.gl.STATIC_DRAW);

  if (hasNorm) {
    this.compiled.gl_normals = CubicVR_GLCore.gl.createBuffer();
    CubicVR_GLCore.gl.bindBuffer(CubicVR_GLCore.gl.ARRAY_BUFFER, this.compiled.gl_normals);
    CubicVR_GLCore.gl.bufferData(CubicVR_GLCore.gl.ARRAY_BUFFER, new Float32Array(this.compiled.vbo_normals), CubicVR_GLCore.gl.STATIC_DRAW);
  }

  if (hasUV) {
    this.compiled.gl_uvs = CubicVR_GLCore.gl.createBuffer();
    CubicVR_GLCore.gl.bindBuffer(CubicVR_GLCore.gl.ARRAY_BUFFER, this.compiled.gl_uvs);
    CubicVR_GLCore.gl.bufferData(CubicVR_GLCore.gl.ARRAY_BUFFER, new Float32Array(this.compiled.vbo_uvs), CubicVR_GLCore.gl.STATIC_DRAW);
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

  this.compiled.gl_elements = CubicVR_GLCore.gl.createBuffer();
  CubicVR_GLCore.gl.bindBuffer(CubicVR_GLCore.gl.ELEMENT_ARRAY_BUFFER, this.compiled.gl_elements);
  CubicVR_GLCore.gl.bufferData(CubicVR_GLCore.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(gl_elements), CubicVR_GLCore.gl.STATIC_DRAW);

  // dump temporary buffers
  this.compiled.vbo_normals = null;
  this.compiled.vbo_points = null;
  this.compiled.vbo_uvs = null;

  CubicVR_GLCore.gl.bindBuffer(CubicVR_GLCore.gl.ELEMENT_ARRAY_BUFFER, null);
};



var cubicvr_uvmapper = function() {
  this.rotation = [0, 0, 0];
  this.scale = [1, 1, 1];
  this.center = [0, 0, 0];
  this.projection_mode = UV_PROJECTION_PLANAR;
  this.projection_axis = UV_AXIS_X;
  this.wrap_w_count = 1;
  this.wrap_h_count = 1;
};

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


cubicvr_uvmapper.prototype.apply = function(obj, mat_num, seg_num) {
  var u, v, s, t, lat, lon;

  var trans = new cubicvr_transform();
  var transformed = false;
  var t_result = null;

  if (this.center[0] || this.center[1] || this.center[2]) {
    trans.translate(-this.center[0], -this.center[1], -this.center[2]);
    transformed = true;
  }

  if (this.rotation[0] || this.rotation[1] || this.rotation[2]) {
    if (this.rotation[0]) { trans.rotate(this.rotation[2], 0, 0, 1); }
    if (this.rotation[1]) { trans.rotate(this.rotation[1], 0, 1, 0); }
    if (this.rotation[2]) { trans.rotate(this.rotation[0], 1, 0, 0); }
    transformed = true;
  }

  if (transformed) { t_result = trans.getResult(); }

  if (typeof(mat_num) === 'object') { mat_num = mat_num.material_id; }

  for (var i = 0, iMax = obj.faces.length; i < iMax; i++) {
    if (obj.faces[i].material !== mat_num) { continue; }
    if (typeof(seg_num) !== 'undefined') {
      if (obj.faces[i].segment !== seg_num) { continue; }
    }

    var nx, ny, nz;

    if (this.projection_mode === UV_PROJECTION_CUBIC || this.projection_mode === UV_PROJECTION_SKY) {
      nx = Math.abs(obj.faces[i].normal[0]);
      ny = Math.abs(obj.faces[i].normal[1]);
      nz = Math.abs(obj.faces[i].normal[2]);
    }

    for (var j = 0, jMax = obj.faces[i].points.length; j < jMax; j++) {
      var uvpoint = obj.points[obj.faces[i].points[j]];

      if (transformed) { uvpoint = trans.m_point(uvpoint, t_result); }

      /* calculate the uv for the points referenced by this face's pointref vector */
      switch (this.projection_mode) {
      case UV_PROJECTION_SKY:
        /* see UV_PROJECTION_CUBIC for normalization reasoning */
        if (nx >= ny && nx >= nz) {
          s = uvpoint[2] / (this.scale[2]) + this.scale[2] / 2;
          t = uvpoint[1] / (this.scale[1]) + this.scale[1] / 2;
          t = t / 3 + 1 / 3;
          s /= 4;
          if (obj.faces[i].normal[0] < 0) { 
            s *= -1; 
          } else { 
            s += 1 / 4;
          }
        } //if
        if (ny >= nx && ny >= nz) {
          t = uvpoint[0] / (this.scale[0]) + this.scale[0] / 2;
          s = -uvpoint[2] / (this.scale[2]) + this.scale[2] / 2;
          s = s / 4 + 3 / 4;
          t /= 3;
          if (obj.faces[i].normal[1] > 0) { 
            t += 2 / 3;
          } else { 
            t = (-t) - 2 / 3;
          }
        } //if
        if (nz >= nx && nz >= ny) {
          s = uvpoint[0] / (this.scale[0]) + this.scale[0] / 2;
          t = uvpoint[1] / (this.scale[1]) + this.scale[1] / 2;
          t = t / 3 + 1 / 3;
          s /= 4;
          if (obj.faces[i].normal[2] > 0) { s = -s - 1 / 4; }
        } //if
        obj.faces[i].setUV([s, t], j);
        break;

      case UV_PROJECTION_CUBIC:
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

      case UV_PROJECTION_PLANAR:
        s = ((this.projection_axis === UV_AXIS_X) ? uvpoint[2] / this.scale[2] + 0.5 : -uvpoint[0] / this.scale[0] + 0.5);
        t = ((this.projection_axis === UV_AXIS_Y) ? uvpoint[2] / this.scale[2] + 0.5 : uvpoint[1] / this.scale[1] + 0.5);

        obj.faces[i].setUV([s, t], j);
        break;

      case UV_PROJECTION_CYLINDRICAL:
        // Cylindrical is a little more tricky, we map based on the degree around the center point
        switch (this.projection_axis) {
        case UV_AXIS_X:
          // xyz_to_h takes the point and returns a value representing the 'unwrapped' height position of this point
          lon = xyz_to_h(uvpoint[2], uvpoint[0], -uvpoint[1]);
          t = -uvpoint[0] / this.scale[0] + 0.5;
          break;

        case UV_AXIS_Y:
          lon = xyz_to_h(-uvpoint[0], uvpoint[1], uvpoint[2]);
          t = -uvpoint[1] / this.scale[1] + 0.5;
          break;

        case UV_AXIS_Z:
          lon = xyz_to_h(-uvpoint[0], uvpoint[2], -uvpoint[1]);
          t = -uvpoint[2] / this.scale[2] + 0.5;
          break;
        }

        // convert it from radian space to texture space 0 to 1 * wrap, TWO_PI = 360 degrees
        lon = 1.0 - lon / (M_TWO_PI);

        if (this.wrap_w_count !== 1.0) { lon = lon * this.wrap_w_count; }

        u = lon;
        v = t;

        obj.faces[i].setUV([u, v], j);
        break;

      case UV_PROJECTION_SPHERICAL:
        var latlon;

        // spherical is similar to cylindrical except we also unwrap the 'width'
        switch (this.projection_axis) {
        case UV_AXIS_X:
          // xyz to hp takes the point value and 'unwraps' the latitude and longitude that projects to that point
          latlon = xyz_to_hp(uvpoint[2], uvpoint[0], -uvpoint[1]);
          break;
        case UV_AXIS_Y:
          latlon = xyz_to_hp(uvpoint[0], -uvpoint[1], uvpoint[2]);
          break;
        case UV_AXIS_Z:
          latlon = xyz_to_hp(-uvpoint[0], uvpoint[2], -uvpoint[1]);
          break;
        }

        // convert longitude and latitude to texture space coordinates, multiply by wrap height and width
        lon = 1.0 - latlon[0] / M_TWO_PI;
        lat = 0.5 - latlon[1] / M_PI;

        if (this.wrap_w_count !== 1.0) { lon = lon * this.wrap_w_count; }
        if (this.wrap_h_count !== 1.0) { lat = lat * this.wrap_h_count; }

        u = lon;
        v = lat;

        obj.faces[i].setUV([u, v], j);
        break;

        // case UV_PROJECTION_UV:
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


/* Lights */

var cubicvr_light = function(light_type) {
  if (typeof(light_type) === 'undefined') { light_type = LIGHT_TYPE_POINT; }

  this.light_type = light_type;
  this.diffuse = [1, 1, 1];
  this.specular = [0.1, 0.1, 0.1];
  this.intensity = 1.0;
  this.position = [0, 0, 0];
  this.direction = [0, 0, 0];
  this.distance = 10;
};

cubicvr_light.prototype.setDirection = function(x, y, z) {
  if (typeof(x) === 'object') {
    this.setDirection(x[0], x[1], x[2]);
    return;
  }


  this.direction = cubicvr_normalize([x, y, z]);
};

cubicvr_light.prototype.setRotation = function(x, y, z) {
  if (typeof(x) === 'object') {
    this.setRotation(x[0], x[1], x[2]);
    return;
  }

  var t = new cubicvr_transform();
  t.rotate([-x, -y, -z]);
  t.pushMatrix();

  this.direction = cubicvr_normalize(t.multiply1_3by4_4([1, 0, 0], t.getResult()));
};


cubicvr_light.prototype.setupShader = function(lShader) {
  lShader.setVector("lDiff", this.diffuse);
  lShader.setVector("lSpec", this.specular);
  lShader.setFloat("lInt", this.intensity);
  lShader.setFloat("lDist", this.distance);
  lShader.setVector("lPos", this.position);
  lShader.setVector("lDir", this.direction);
  lShader.setVector("lAmb", CubicVR.globalAmbient);
};

/* Shaders */
var cubicvr_shader = function(vs_id, fs_id) {
  var vertexShader;
  var fragmentShader;

  this.uniforms = [];
  this.uniform_type = [];
  this.uniform_typelist = [];

  if (vs_id.indexOf("\n") !== -1) {
    vertexShader = cubicvr_compileShader(CubicVR_GLCore.gl, vs_id, "x-shader/x-vertex");
  } else {
    vertexShader = cubicvr_getShader(CubicVR_GLCore.gl, vs_id);
  }

  if (fs_id.indexOf("\n") !== -1) {
    fragmentShader = cubicvr_compileShader(CubicVR_GLCore.gl, fs_id, "x-shader/x-fragment");
  } else {
    fragmentShader = cubicvr_getShader(CubicVR_GLCore.gl, fs_id);
  }


  this.shader = CubicVR_GLCore.gl.createProgram();
  CubicVR_GLCore.gl.attachShader(this.shader, vertexShader);
  CubicVR_GLCore.gl.attachShader(this.shader, fragmentShader);
  CubicVR_GLCore.gl.linkProgram(this.shader);

  if (!CubicVR_GLCore.gl.getProgramParameter(this.shader, CubicVR_GLCore.gl.LINK_STATUS)) {
    alert("Could not initialise shader vert(" + vs_id + "), frag(" + fs_id + ")");
    return;
  }
};

cubicvr_shader.prototype.addMatrix = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = CubicVR_GLCore.gl.getUniformLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = UNIFORM_TYPE_MATRIX;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

cubicvr_shader.prototype.addVector = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = CubicVR_GLCore.gl.getUniformLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = UNIFORM_TYPE_VECTOR;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

cubicvr_shader.prototype.addFloat = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = CubicVR_GLCore.gl.getUniformLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = UNIFORM_TYPE_FLOAT;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};


cubicvr_shader.prototype.addVertexArray = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = CubicVR_GLCore.gl.getAttribLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = UNIFORM_TYPE_ARRAY_VERTEX;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

cubicvr_shader.prototype.addUVArray = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = CubicVR_GLCore.gl.getAttribLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = UNIFORM_TYPE_ARRAY_UV;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

cubicvr_shader.prototype.addFloatArray = function(uniform_id) {
  this.use();
  this.uniforms[uniform_id] = CubicVR_GLCore.gl.getAttribLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = UNIFORM_TYPE_ARRAY_FLOAT;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);
};

cubicvr_shader.prototype.addInt = function(uniform_id, default_val) {
  this.use();
  this.uniforms[uniform_id] = CubicVR_GLCore.gl.getUniformLocation(this.shader, uniform_id);
  this.uniform_type[uniform_id] = UNIFORM_TYPE_INT;
  this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

  if (typeof(default_val) !== 'undefined') {
    this.setInt(uniform_id, default_val);
  }
};



cubicvr_shader.prototype.use = function() {
  CubicVR_GLCore.gl.useProgram(this.shader);
};

cubicvr_shader.prototype.init = function(istate) {
  if (typeof(istate) === 'undefined') { istate = true; }

  for (var i = 0, imax = this.uniform_typelist.length; i < imax; i++) {
    //    if(!this.uniforms.hasOwnProperty(i)) { continue; }
    switch (this.uniform_typelist[i][1]) {
      // case UNIFORM_TYPE_MATRIX:
      //
      // break;
      // case UNIFORM_TYPE_VECTOR:
      //
      // break;
      // case UNIFORM_TYPE_FLOAT:
      //
      // break;
    case UNIFORM_TYPE_ARRAY_VERTEX:
    case UNIFORM_TYPE_ARRAY_UV:
    case UNIFORM_TYPE_ARRAY_FLOAT:
      if (istate) {
        CubicVR_GLCore.gl.enableVertexAttribArray(this.uniform_typelist[i][0]);
      } else { 
        CubicVR_GLCore.gl.disableVertexAttribArray(this.uniform_typelist[i][0]);
      }
      break;
    }
  }
};

cubicvr_shader.prototype.setMatrix = function(uniform_id, mat) {
  var u = this.uniforms[uniform_id];
  if (u === null) { return; }
  CubicVR_GLCore.gl.uniformMatrix4fv(u, false, new Float32Array(mat));
};

cubicvr_shader.prototype.setInt = function(uniform_id, val) {
  var u = this.uniforms[uniform_id];
  if (u === null) { return; }
  CubicVR_GLCore.gl.uniform1i(u, val);
};

cubicvr_shader.prototype.setFloat = function(uniform_id, val) {
  var u = this.uniforms[uniform_id];
  if (u === null) { return; }
  CubicVR_GLCore.gl.uniform1f(u, val);
};

cubicvr_shader.prototype.setVector = function(uniform_id, val) {
  var u = this.uniforms[uniform_id];
  if (u === null) { return; }
  CubicVR_GLCore.gl.uniform3fv(u, val);
};


cubicvr_shader.prototype.setArray = function(uniform_id, buf) {
  switch (this.uniform_type[uniform_id]) {
  case UNIFORM_TYPE_ARRAY_VERTEX:
    CubicVR_GLCore.gl.bindBuffer(CubicVR_GLCore.gl.ARRAY_BUFFER, buf);
    CubicVR_GLCore.gl.vertexAttribPointer(this.uniforms[uniform_id], 3, CubicVR_GLCore.gl.FLOAT, false, 0, 0);
    break;
  case UNIFORM_TYPE_ARRAY_UV:
    CubicVR_GLCore.gl.bindBuffer(CubicVR_GLCore.gl.ARRAY_BUFFER, buf);
    CubicVR_GLCore.gl.vertexAttribPointer(this.uniforms[uniform_id], 2, CubicVR_GLCore.gl.FLOAT, false, 0, 0);
    break;
  case UNIFORM_TYPE_ARRAY_FLOAT:
    CubicVR_GLCore.gl.bindBuffer(CubicVR_GLCore.gl.ARRAY_BUFFER, buf);
    CubicVR_GLCore.gl.vertexAttribPointer(this.uniforms[uniform_id], 1, CubicVR_GLCore.gl.FLOAT, false, 0, 0);
    break;
  }

};


/* Materials */

var cubicvr_material = function(mat_name) {
  if (typeof(mat_name) !== 'undefined') {
    CubicVR_Material_ref[mat_name] = this;
  }

  this.material_id = CubicVR_Materials.length;
  CubicVR_Materials.push(this);

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

cubicvr_material.prototype.setTexture = function(tex, tex_type) {
  if (typeof(tex_type) === 'undefined') { tex_type = 0; }

  this.textures[tex_type] = tex;
};

var cubicvr_floatDelimArray = function(float_str, delim) {
  var fa = float_str.split(delim ? delim : ",");
  for (var i = 0, imax = fa.length; i < imax; i++) {
    fa[i] = parseFloat(fa[i]);
  }
  return fa;
};

var cubicvr_intDelimArray = function(float_str, delim) {
  var fa = float_str.split(delim ? delim : ",");
  for (var i = 0, imax = fa.length; i < imax; i++) {
    fa[i] = parseInt(fa[i], 10);
  }
  return fa;
};

var cubicvr_textDelimArray = function(text_str, delim) {
  var fa = text_str.split(delim ? delim : ",");
  for (var i = 0, imax = fa.length; i < imax; i++) {
    fa[i] = fa[i];
  }
  return fa;
};


cubicvr_material.prototype.calcShaderMask = function() {
  var shader_mask = 0;

  shader_mask = shader_mask + ((typeof(this.textures[TEXTURE_MAP_COLOR]) === 'object') ? SHADER_COLOR_MAP : 0);
  shader_mask = shader_mask + ((typeof(this.textures[TEXTURE_MAP_SPECULAR]) === 'object') ? SHADER_SPECULAR_MAP : 0);
  shader_mask = shader_mask + ((typeof(this.textures[TEXTURE_MAP_NORMAL]) === 'object') ? SHADER_NORMAL_MAP : 0);
  shader_mask = shader_mask + ((typeof(this.textures[TEXTURE_MAP_BUMP]) === 'object') ? SHADER_BUMP_MAP : 0);
  shader_mask = shader_mask + ((typeof(this.textures[TEXTURE_MAP_REFLECT]) === 'object') ? SHADER_REFLECT_MAP : 0);
  shader_mask = shader_mask + ((typeof(this.textures[TEXTURE_MAP_ENVSPHERE]) === 'object') ? SHADER_ENVSPHERE_MAP : 0);
  shader_mask = shader_mask + ((typeof(this.textures[TEXTURE_MAP_AMBIENT]) === 'object') ? SHADER_AMBIENT_MAP : 0);
  shader_mask = shader_mask + ((typeof(this.textures[TEXTURE_MAP_ALPHA]) === 'object') ? SHADER_ALPHA_MAP : 0);
  shader_mask = shader_mask + ((this.opacity !== 1.0) ? SHADER_ALPHA : 0);

  return shader_mask;
};


cubicvr_material.prototype.getShaderHeader = function(light_type) {
  return "#define hasColorMap " + ((typeof(this.textures[TEXTURE_MAP_COLOR]) === 'object') ? 1 : 0) + "\n#define hasSpecularMap " + ((typeof(this.textures[TEXTURE_MAP_SPECULAR]) === 'object') ? 1 : 0) + "\n#define hasNormalMap " + ((typeof(this.textures[TEXTURE_MAP_NORMAL]) === 'object') ? 1 : 0) + "\n#define hasBumpMap " + ((typeof(this.textures[TEXTURE_MAP_BUMP]) === 'object') ? 1 : 0) + "\n#define hasReflectMap " + ((typeof(this.textures[TEXTURE_MAP_REFLECT]) === 'object') ? 1 : 0) + "\n#define hasEnvSphereMap " + ((typeof(this.textures[TEXTURE_MAP_ENVSPHERE]) === 'object') ? 1 : 0) + "\n#define hasAmbientMap " + ((typeof(this.textures[TEXTURE_MAP_AMBIENT]) === 'object') ? 1 : 0) + "\n#define hasAlphaMap " + ((typeof(this.textures[TEXTURE_MAP_ALPHA]) === 'object') ? 1 : 0) + "\n#define hasAlpha " + ((this.opacity !== 1.0) ? 1 : 0) +
    "\n#define lightPoint " + ((light_type === LIGHT_TYPE_POINT) ? 1 : 0) + "\n#define lightDirectional " + ((light_type === LIGHT_TYPE_DIRECTIONAL) ? 1 : 0) + "\n#define lightSpot " + ((light_type === LIGHT_TYPE_SPOT) ? 1 : 0) + "\n#define lightArea " + ((light_type === LIGHT_TYPE_AREA) ? 1 : 0) +
    "\n\n";
};


cubicvr_material.prototype.bindObject = function(obj_in, light_type) {
  var gl = CubicVR_GLCore.gl;

  if (typeof(light_type) === 'undefined') { light_type = 0; }


  gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_points);
  gl.vertexAttribPointer(this.shader[light_type].uniforms["aVertexPosition"], 3, gl.FLOAT, false, 0, 0);

  if (this.textures.length !== 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_uvs);
    gl.vertexAttribPointer(this.shader[light_type].uniforms["aTextureCoord"], 2, gl.FLOAT, false, 0, 0);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_normals);
  gl.vertexAttribPointer(this.shader[light_type].uniforms["aNormal"], 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj_in.compiled.gl_elements);
};

cubicvr_material.prototype.use = function(light_type) {
  if (this.customShader !== null) {
    this.customShader.use();
    return;
  }

  if (typeof(light_type) === 'undefined') { light_type = 0; }

  var m;

  if (typeof(this.shader[light_type]) === 'undefined') {
    var smask = this.calcShaderMask(light_type);

    if (typeof(CubicVR_ShaderPool[light_type][smask]) === 'undefined') {
      var hdr = this.getShaderHeader(light_type);
      var vs = hdr + CubicVR_GLCore.CoreShader_vs;
      var fs = hdr + CubicVR_GLCore.CoreShader_fs;

      CubicVR_ShaderPool[light_type][smask] = new cubicvr_shader(vs, fs);

      m = 0;

      if (typeof(this.textures[TEXTURE_MAP_COLOR]) === 'object') { CubicVR_ShaderPool[light_type][smask].addInt("colorMap", m++); }
      if (typeof(this.textures[TEXTURE_MAP_ENVSPHERE]) === 'object') { CubicVR_ShaderPool[light_type][smask].addInt("envSphereMap", m++); }
      if (typeof(this.textures[TEXTURE_MAP_NORMAL]) === 'object') { CubicVR_ShaderPool[light_type][smask].addInt("normalMap", m++); }
      if (typeof(this.textures[TEXTURE_MAP_BUMP]) === 'object') { CubicVR_ShaderPool[light_type][smask].addInt("bumpMap", m++); }
      if (typeof(this.textures[TEXTURE_MAP_REFLECT]) === 'object') { CubicVR_ShaderPool[light_type][smask].addInt("reflectMap", m++); }
      if (typeof(this.textures[TEXTURE_MAP_SPECULAR]) === 'object') { CubicVR_ShaderPool[light_type][smask].addInt("specularMap", m++); }
      if (typeof(this.textures[TEXTURE_MAP_AMBIENT]) === 'object') { CubicVR_ShaderPool[light_type][smask].addInt("ambientMap", m++); }
      if (typeof(this.textures[TEXTURE_MAP_ALPHA]) === 'object') { CubicVR_ShaderPool[light_type][smask].addInt("alphaMap", m++); }

      CubicVR_ShaderPool[light_type][smask].addMatrix("uMVMatrix");
      CubicVR_ShaderPool[light_type][smask].addMatrix("uPMatrix");
      CubicVR_ShaderPool[light_type][smask].addMatrix("uOMatrix");

      CubicVR_ShaderPool[light_type][smask].addVertexArray("aVertexPosition");
      CubicVR_ShaderPool[light_type][smask].addVertexArray("aNormal");

      if (light_type) {
        CubicVR_ShaderPool[light_type][smask].addVector("lDiff");
        CubicVR_ShaderPool[light_type][smask].addVector("lSpec");
        CubicVR_ShaderPool[light_type][smask].addFloat("lInt");
        CubicVR_ShaderPool[light_type][smask].addFloat("lDist");
        CubicVR_ShaderPool[light_type][smask].addVector("lPos");
        CubicVR_ShaderPool[light_type][smask].addVector("lDir");
        CubicVR_ShaderPool[light_type][smask].addVector("lAmb");
      }

      CubicVR_ShaderPool[light_type][smask].addVector("mDiff");
      CubicVR_ShaderPool[light_type][smask].addVector("mColor");
      CubicVR_ShaderPool[light_type][smask].addVector("mAmb");
      CubicVR_ShaderPool[light_type][smask].addVector("mSpec");
      CubicVR_ShaderPool[light_type][smask].addFloat("mShine");
      CubicVR_ShaderPool[light_type][smask].addFloat("mAlpha");

      switch (light_type) {
      case LIGHT_TYPE_NULL:
        break; // do nothing
      case LIGHT_TYPE_POINT:
        break;
      case LIGHT_TYPE_DIRECTIONAL:
        break;
      case LIGHT_TYPE_SPOT:
        break;
      case LIGHT_TYPE_AREA:
        break;
      }

      if (this.textures.length !== 0) {
        CubicVR_ShaderPool[light_type][smask].addUVArray("aTextureCoord");
      }

      //      CubicVR_ShaderPool[light_type][smask].init();
    }

    this.shader[light_type] = CubicVR_ShaderPool[light_type][smask];
  }

  this.shader[light_type].use();

  var tex_list = [CubicVR_GLCore.gl.TEXTURE0, CubicVR_GLCore.gl.TEXTURE1, CubicVR_GLCore.gl.TEXTURE2, CubicVR_GLCore.gl.TEXTURE3, CubicVR_GLCore.gl.TEXTURE4, CubicVR_GLCore.gl.TEXTURE5, CubicVR_GLCore.gl.TEXTURE6, CubicVR_GLCore.gl.TEXTURE7];

  m = 0;

  if (typeof(this.textures[TEXTURE_MAP_COLOR]) === 'object') { this.textures[TEXTURE_MAP_COLOR].use(tex_list[m++]); }
  if (typeof(this.textures[TEXTURE_MAP_ENVSPHERE]) === 'object') { this.textures[TEXTURE_MAP_ENVSPHERE].use(tex_list[m++]); }
  if (typeof(this.textures[TEXTURE_MAP_NORMAL]) === 'object') { this.textures[TEXTURE_MAP_NORMAL].use(tex_list[m++]); }
  if (typeof(this.textures[TEXTURE_MAP_BUMP]) === 'object') { this.textures[TEXTURE_MAP_BUMP].use(tex_list[m++]); }
  if (typeof(this.textures[TEXTURE_MAP_REFLECT]) === 'object') { this.textures[TEXTURE_MAP_REFLECT].use(tex_list[m++]); }
  if (typeof(this.textures[TEXTURE_MAP_SPECULAR]) === 'object') { this.textures[TEXTURE_MAP_SPECULAR].use(tex_list[m++]); }
  if (typeof(this.textures[TEXTURE_MAP_AMBIENT]) === 'object') { this.textures[TEXTURE_MAP_AMBIENT].use(tex_list[m++]); }
  if (typeof(this.textures[TEXTURE_MAP_ALPHA]) === 'object') { this.textures[TEXTURE_MAP_ALPHA].use(tex_list[m++]); }

  this.shader[light_type].setVector("mColor", this.color);
  this.shader[light_type].setVector("mDiff", this.diffuse);
  this.shader[light_type].setVector("mAmb", this.ambient);
  this.shader[light_type].setVector("mSpec", this.specular);
  this.shader[light_type].setFloat("mShine", this.shininess);

  if (this.opacity !== 1.0) { this.shader[light_type].setFloat("mAlpha", this.opacity); }
};




/* Textures */

var cubicvr_texture = function(img_path) {
  var gl = CubicVR_GLCore.gl;

  this.tex_id = CubicVR_Textures.length;
  CubicVR_Textures[this.tex_id] = gl.createTexture();
  CubicVR_Textures_obj[this.tex_id] = this;

  if (img_path) {
    CubicVR_Images[this.tex_id] = new Image();
    CubicVR_Texture_ref[img_path] = this.tex_id;
  }

  gl.bindTexture(gl.TEXTURE_2D, CubicVR_Textures[this.tex_id]);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  if (img_path) {
    var texId = this.tex_id;
    CubicVR_Images[this.tex_id].onload = function() {
      gl.bindTexture(gl.TEXTURE_2D, CubicVR_Textures[texId]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      //      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, CubicVR_Images[texId]);
      //      gl.texImage2D(gl.TEXTURE_2D, 0, CubicVR_Images[texId], true);
      //      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, null);
    };

    CubicVR_Images[this.tex_id].src = img_path;
  }

  this.active_unit = -1;
};


cubicvr_texture.prototype.use = function(tex_unit) {
  CubicVR_GLCore.gl.activeTexture(tex_unit);
  CubicVR_GLCore.gl.bindTexture(CubicVR_GLCore.gl.TEXTURE_2D, CubicVR_Textures[this.tex_id]);
  this.active_unit = tex_unit;
};

cubicvr_texture.prototype.clear = function() {
  if (this.active_unit !== -1) {
    CubicVR_GLCore.gl.activeTexture(this.active_unit);
    CubicVR_GLCore.gl.bindTexture(CubicVR_GLCore.gl.TEXTURE_2D, null);
    this.active_unit = -1;
  }
};



/* Render functions */


function cubicvr_renderObject(obj_in, mv_matrix, p_matrix, o_matrix, lighting) {
  var ofs = 0;
  var gl = CubicVR.core.gl;
  var numLights = (typeof(lighting) === 'undefined') ? 0 : lighting.length;

  gl.depthFunc(gl.LEQUAL);

  if (typeof(o_matrix) === 'undefined') { o_matrix = cubicvr_identity; }

  for (var ic = 0, icLen = obj_in.compiled.elements_ref.length; ic < icLen; ic++) {
    var i = obj_in.compiled.elements_ref[ic][0][0];

    var mat = CubicVR_Materials[i];

    var len = 0;
    var drawn = false;

    if (mat.opacity !== 1.0) {
      gl.enable(gl.BLEND);
      gl.depthMask(0);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.depthMask(1);
      gl.disable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);

    }

    for (var jc = 0, jcLen = obj_in.compiled.elements_ref[ic].length; jc < jcLen; jc++) {
      var j = obj_in.compiled.elements_ref[ic][jc][1];

      drawn = false;

      var this_len = obj_in.compiled.elements_ref[ic][jc][2];

      len += this_len;

      if (obj_in.segment_state[j]) {
        // ...
      } else if (len > this_len) {
        ofs += this_len * 2;
        len -= this_len;

        // start lighting loop
        // start inner
        if (!numLights) {
          mat.use(0);

          mat.shader[0].init(true);

          mat.shader[0].setMatrix("uMVMatrix", mv_matrix);
          mat.shader[0].setMatrix("uPMatrix", p_matrix);
          mat.shader[0].setMatrix("uOMatrix", o_matrix);

          mat.bindObject(obj_in, 0);

          gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);

          mat.shader[0].init(false);

        } else {
          var mshader;
          var last_ltype = 0;

          for (var lcount = 0; lcount < numLights; lcount++) {
            var l = lighting[lcount];

            if (lcount) {
              gl.enable(gl.BLEND);
              gl.blendFunc(gl.ONE, gl.ONE);
              gl.depthFunc(gl.EQUAL);
            }

            if (last_ltype !== l.light_type) {
              if (lcount) { mat.shader[last_ltype].init(false); }

              mat.use(l.light_type);

              mshader = mat.shader[l.light_type];
              mshader.init(true);

              mshader.setMatrix("uMVMatrix", mv_matrix);
              mshader.setMatrix("uPMatrix", p_matrix);
              mshader.setMatrix("uOMatrix", o_matrix);

              mat.bindObject(obj_in, l.light_type);
            }

            l.setupShader(mshader);

            gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);

            if (last_ltype !== l.light_type) {
              mshader.init(false);
            }
            
            last_ltype = l.light_type;
          }
        }

        if (lcount > 1) { mat.shader[last_ltype].init(false); }
        if (lcount !== 0) {
          gl.depthFunc(gl.LEQUAL);
        }
        // end inner

        ofs += len * 2; // Note: unsigned short = 2 bytes
        len = 0;
        drawn = true;
      } else {
        ofs += len * 2;
        len = 0;
      }
    }

    if (!drawn && obj_in.segment_state[j]) {
      // this is an exact copy/paste of above
      // start inner
      if (!numLights) {
        mat.use(0);

        mat.shader[0].init(true);

        mat.shader[0].setMatrix("uMVMatrix", mv_matrix);
        mat.shader[0].setMatrix("uPMatrix", p_matrix);
        mat.shader[0].setMatrix("uOMatrix", o_matrix);

        mat.bindObject(obj_in, 0);

        gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);
        mat.shader[0].init(false);
      } else {
        var mshader;
        var last_ltype = 0;

        for (var lcount = 0; lcount < numLights; lcount++) {
          var l = lighting[lcount];

          if (lcount) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE);
            gl.depthFunc(gl.EQUAL);
          }

          if (last_ltype !== l.light_type) {
            if (lcount) { mat.shader[last_ltype].init(false); }

            mat.use(l.light_type);

            mshader = mat.shader[l.light_type];
            mshader.init(true);

            mshader.setMatrix("uMVMatrix", mv_matrix);
            mshader.setMatrix("uPMatrix", p_matrix);
            mshader.setMatrix("uOMatrix", o_matrix);

            mat.bindObject(obj_in, l.light_type);
          }

          l.setupShader(mshader);

          gl.drawElements(gl.TRIANGLES, len, gl.UNSIGNED_SHORT, ofs);

        if (last_ltype !== l.light_type) {
          mshader.init(false);
        }
        last_ltype = l.light_type;

        }
      }

      if (lcount > 1) { mat.shader[last_ltype].init(false); }
      if (lcount !== 0) {
        gl.depthFunc(gl.LEQUAL);
      }
      // end inner

      ofs += len * 2;
    }

  }

  gl.depthMask(1);
  CubicVR_GLCore.gl.bindBuffer(CubicVR_GLCore.gl.ELEMENT_ARRAY_BUFFER, null);
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
    if (sliceNum === lathe_divisions) { break; }

    right = [Math.cos(i), 0, Math.sin(i)];

    for (j = 0, jMax = pointList.length; j < jMax; j++) {
      pos = cubicvr_vertex_add(cubicvr_vertex_mul_const(right, pointList[j][0]), cubicvr_vertex_mul_const(up, pointList[j][1]));

      if (typeof(slices[sliceNum]) === 'undefined') { slices[sliceNum] = []; }

      slices[sliceNum].push(pos);
    }

    sliceNum++;
  }

  var transformed = (typeof(transform) !== 'undefined');

  for (j = 0; j < lathe_divisions; j++) {
    for (k = 0, kMax = pointList.length; k < kMax; k++) {
      if (transformed) {
        obj_in.addPoint(transform.multiply1_3by4_4(slices[j][k], transform.getResult()));
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

      if (cubicvr_vtx_eq(obj_in.points[pofs + pt], obj_in.points[pofs + pt_r])) {
        obj_in.addFace([pofs + pt + 1, pofs + pt_r + 1, pofs + pt_r]);
      } else if (cubicvr_vtx_eq(obj_in.points[pofs + pt + 1], obj_in.points[pofs + pt_r + 1])) {
        obj_in.addFace([pofs + pt, pofs + pt + 1, pofs + pt_r]);
      } else {
        obj_in.addFace([pofs + pt, pofs + pt + 1, pofs + pt_r + 1, pofs + pt_r]);
      }
    }
  }
}

function cubicvr_boxObject(boxObj, box_size, box_mat, transform) {
  var half_box = box_size / 2.0;
  var pofs = boxObj.points.length;

  boxObj.setFaceMaterial(box_mat);

  if (typeof(transform) !== 'undefined') {
    var m = transform.getResult();
    boxObj.addPoint([
      transform.multiply1_3by4_4([half_box, -half_box, half_box], m),
      transform.multiply1_3by4_4([half_box, half_box, half_box], m),
      transform.multiply1_3by4_4([-half_box, half_box, half_box], m),
      transform.multiply1_3by4_4([-half_box, -half_box, half_box], m),
      transform.multiply1_3by4_4([half_box, -half_box, -half_box], m),
      transform.multiply1_3by4_4([half_box, half_box, -half_box], m),
      transform.multiply1_3by4_4([-half_box, half_box, -half_box], m),
      transform.multiply1_3by4_4([-half_box, -half_box, -half_box], m)
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



var cubicvr_landscape = function(size_in, divisions_in_w, divisions_in_h, matRef_in) {
  this.doTransform = function() {};
  this.tMatrix = cubicvr_identity;

  this.parent = null;
  this.position = [0, 0, 0];
  this.scale = [1, 1, 1];
  this.size = size_in;
  this.divisions_w = divisions_in_w;
  this.divisions_h = divisions_in_h;
  this.matRef = matRef_in;

  this.obj = new cubicvr_object();

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
};


cubicvr_landscape.prototype.getFaceAt = function(x, y, z) {
  var ofs_w = (this.size_w / 2.0) - ((this.size_w / (this.divisions_w)) / 2.0);
  var ofs_h = (this.size_h / 2.0) - ((this.size_h / (this.divisions_h)) / 2.0);

  var i = parseInt(Math.floor(((x + ofs_w) / this.size_w) * (this.divisions_w)), 10);
  var j = parseInt(Math.floor(((z + ofs_h) / this.size_h) * (this.divisions_h)), 10);

  if (i < 0) { return -1; }
  if (i >= this.divisions_w - 1) { return -1; }
  if (j < 0) { return -1; }
  if (j >= this.divisions_h - 1) { return -1; }

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

cubicvr_landscape.prototype.getHeightValue = function(x, y, z) {

  if (typeof(x) === 'object') {
    return this.getHeightValue(x[0], x[1], x[2]);
  }

  var tmpFace;
  var tmpPoint;

  var faceNum = this.getFaceAt(x, y, z);

  if (faceNum === -1) { return 0; }

  tmpFace = this.obj.faces[faceNum];
  tmpPoint = this.obj.points[this.obj.faces[faceNum].points[0]];

  var tmpNorm = cubicvr_calcNormal(this.obj.points[this.obj.faces[faceNum].points[0]], this.obj.points[this.obj.faces[faceNum].points[1]], this.obj.points[this.obj.faces[faceNum].points[2]]);

  var na = tmpNorm[0];
  var nb = tmpNorm[1];
  var nc = tmpNorm[2];

  var d = -(na * tmpPoint[0]) - (nb * tmpPoint[1]) - (nc * tmpPoint[2]);

  return (((na * x) + (nc * z) + d) / (-nb)); // add height ofs here
};


cubicvr_landscape.prototype.orient = function(x, z, width, length, heading, center) {
  if (typeof(center) === 'undefined') { center = 0; }

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
var cubicvr_sceneObject = function(obj, name) {
  this.drawn_this_frame = false;

  this.culled = true;
  this.was_culled = true;

  this.position = [0, 0, 0];
  this.rotation = [0, 0, 0];
  this.scale = [1, 1, 1];

  this.lposition = [0, 0, 0];
  this.lrotation = [0, 0, 0];
  this.lscale = [0, 0, 0];

  this.trans = new cubicvr_transform();

  this.tMatrix = this.trans.getResult();

  this.dirty = true;

  this.motion = null;

  this.obj = (typeof(obj) !== 'undefined') ? obj : null;
  this.name = (typeof(name) !== 'undefined') ? name : null;
  this.aabb = [];
  this.children = null;
  this.parent = null;

  this.id = -1;

  this.octree_leaves = [];
  this.octree_common_root = null;
  this.octree_aabb = [[0,0,0],[0,0,0]];
  this.ignore_octree = false;
  this.visible = true;
};


cubicvr_sceneObject.prototype.doTransform = function(mat) {
  if (!cubicvr_vtx_eq(this.lposition, this.position) || !cubicvr_vtx_eq(this.lrotation, this.rotation) || !cubicvr_vtx_eq(this.lscale, this.scale) || (typeof(mat) !== 'undefined')) {

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

    if ((typeof(mat) !== 'undefined')) { this.trans.pushMatrix(mat); }

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

cubicvr_sceneObject.prototype.adjust_octree = function () {
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
  if (  this.octree_leaves.length > 0 &&
        (px0 < tx0 || py0 < ty0 || pz0 < tz0 ||
        px1 > tx1 || py1 > ty1 || pz1 > tz1)) {
    for (var i = 0; i < this.octree_leaves.length; ++i) {
      this.octree_leaves[i].remove(this);
    } //for
    var common_root = this.octree_common_root;
    this.octree_common_root = null;
    if (common_root !== null) {

      while (true) {
        if (!common_root.contains_point(aabb[0]) || !common_root.contains_point(aabb[1])) {
          if (typeof(common_root._root) !== "undefined" && common_root._root !== null) {
            common_root = common_root._root;
          }
          else {
            break;
          } //if
        }
        else {
          break;
        } //if
      } //while
  
      this.octree_aabb = [[0,0,0], [0,0,0]];
      common_root.insert(this);
    } //if
  } //if
}; //cubicvr_sceneObject::adjust_octree

cubicvr_sceneObject.prototype.bindChild = function(childSceneObj) {
  if (this.children === null) { this.children = []; }

  childSceneObj.parent = this;
  this.children.push(childSceneObj);
};


cubicvr_sceneObject.prototype.control = function(controllerId, motionId, value) {
  switch(controllerId) {
    case MOTION_POS: this.position[motionId] = value; break;
    case MOTION_SCL: this.scale[motionId] = value; break;
    case MOTION_ROT: this.rotation[motionId] = value; break;
  }
};

cubicvr_sceneObject.prototype.getAABB = function() {
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
    var obj_bounds = cubicvr_vertex_sub(aabbMax, aabbMin);

    p[0] = [obj_aabb[0], obj_aabb[1], obj_aabb[2]];
    p[1] = [obj_aabb[0], obj_aabb[1], obj_aabb[2] + obj_bounds[2]];
    p[2] = [obj_aabb[0] + obj_bounds[0], obj_aabb[1], obj_aabb[2]];
    p[3] = [obj_aabb[0] + obj_bounds[0], obj_aabb[1], obj_aabb[2] + obj_bounds[2]];
    p[4] = [obj_aabb[0], obj_aabb[1] + obj_bounds[1], obj_aabb[2]];
    p[5] = [obj_aabb[0], obj_aabb[1] + obj_bounds[1], obj_aabb[2] + obj_bounds[2]];
    p[6] = [obj_aabb[0] + obj_bounds[0], obj_aabb[1] + obj_bounds[1], obj_aabb[2]];
    p[7] = [obj_aabb[0] + obj_bounds[0], obj_aabb[1] + obj_bounds[1], obj_aabb[2] + obj_bounds[2]];

    var aabbTest;

    aabbTest = this.trans.multiply1_3by4_4(p[0], this.tMatrix);

    aabbMin = [aabbTest[0], aabbTest[1], aabbTest[2]];
    aabbMax = [aabbTest[0], aabbTest[1], aabbTest[2]];

    for (var i = 1; i < 8; ++i) {
      aabbTest = this.trans.multiply1_3by4_4(p[i], this.tMatrix);

      if (aabbMin[0] > aabbTest[0]) { aabbMin[0] = aabbTest[0]; }
      if (aabbMin[1] > aabbTest[1]) { aabbMin[1] = aabbTest[1]; }
      if (aabbMin[2] > aabbTest[2]) { aabbMin[2] = aabbTest[2]; }

      if (aabbMax[0] < aabbTest[0]) { aabbMax[0] = aabbTest[0]; }
      if (aabbMax[1] < aabbTest[1]) { aabbMax[1] = aabbTest[1]; }
      if (aabbMax[2] < aabbTest[2]) { aabbMax[2] = aabbTest[2]; }
    }

    this.aabb[0] = aabbMin;
    this.aabb[1] = aabbMax;

    this.dirty = false;
  }

  return this.aabb;
};


var cubicvr_camera = function(width, height, fov, nearclip, farclip) {
  this.frustum = new Frustum();

  this.position = [0, 0, 0];
  this.rotation = [0, 0, 0];
  this.target = [0, 0, 0];
  this.fov = (typeof(fov) !== 'undefined') ? fov : 60.0;
  this.nearclip = (typeof(nearclip) !== 'undefined') ? nearclip : 0.1;
  this.farclip = (typeof(farclip) !== 'undefined') ? farclip : 400.0;
  this.targeted = true;
  this.targetSceneObject = null;
  this.motion = null;
  this.transform = new cubicvr_transform();
  
  this.setDimensions((typeof(width) !== 'undefined') ? width : 512, (typeof(height) !== 'undefined') ? height : 512);

  this.mvMatrix = cubicvr_identity;
  this.pMatrix = null;
  this.calcProjection();
};

cubicvr_camera.prototype.control = function(controllerId, motionId, value) {
  switch(controllerId) {
    case MOTION_ROT: this.rotation[motionId] = value; break;
    case MOTION_POS: this.position[motionId] = value; break;
    case MOTION_FOV: this.setFOV(value); break;
  }
};


cubicvr_camera.prototype.makeFrustum = function(left, right, bottom, top, zNear, zFar)
{
    var A = (right+left)/(right-left);
    var B = (top+bottom)/(top-bottom);
    var C = -(zFar+zNear)/(zFar-zNear);
    var D = -2.0*zFar*zNear/(zFar-zNear);

   return [2.0*zNear/(right-left),0.0,0.0,0.0,
    0.0,2.0*zNear/(top-bottom),0.0,0.0,
    A,B,C,-1.0,
    0.0,0.0,D,0.0];
}


cubicvr_camera.prototype.setTargeted = function(targeted) {
  this.targeted = targeted;
};

cubicvr_camera.prototype.calcProjection = function() {
  this.pMatrix = cubicvr_perspective(this.fov, this.aspect, this.nearclip, this.farclip);
  if (!this.targeted)
  {
    this.transform.clearStack();
//this.transform.translate(cubicvr_vertex_sub([0,0,0],this.position)).pushMatrix().rotate(cubicvr_vertex_sub([0,0,0],this.rotation)).getResult();
    this.transform.translate(-this.position[0],-this.position[1],-this.position[2]);
    this.transform.pushMatrix();
    this.transform.rotate(-this.rotation[2],0,0,1);
    this.transform.rotate(-this.rotation[1],0,1,0);
    this.transform.rotate(-this.rotation[0],1,0,0);
    this.transform.pushMatrix();
    this.mvMatrix = this.transform.getResult();

  // console.log(this.rotation);
    
  }
  this.frustum.extract(this, this.mvMatrix, this.pMatrix);
};


cubicvr_camera.prototype.setClip = function(nearclip, farclip) {
  this.nearclip = nearclip;
  this.farclip = farclip;
  this.calcProjection();
};


cubicvr_camera.prototype.setDimensions = function(width, height) {
  this.width = width;
  this.height = height;

  this.aspect = width / height;
  this.calcProjection();
};


cubicvr_camera.prototype.setFOV = function(fov) {
  this.fov = fov;
  this.calcProjection();
};


cubicvr_camera.prototype.lookat = function(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ) {
  this.mvMatrix = cubicvr_lookat(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ);
  this.frustum.extract(this, this.mvMatrix, this.pMatrix);
};


cubicvr_camera.prototype.getRayTo = function(x, y) {
  var rayFrom = this.position;
  var rayForward = cubicvr_vertex_mul_const(cubicvr_normalize(cubicvr_vertex_sub(this.target, this.position)), this.farclip);

  var rightOffset = [0, 0, 0];
  var vertical = [0, 1, 0];

  var hor;

  hor = cubicvr_normalize(cubicvr_crossProduct(rayForward, vertical));

  vertical = cubicvr_normalize(cubicvr_crossProduct(hor, rayForward));

  var tanfov = Math.tan(0.5 * (fov * (M_PI / 180.0)));

  var aspect = this.width / this.height;

  hor = cubicvr_vertex_mul_const(hor, 2.0 * farclip * tanfov);
  vertical = cubicvr_vertex_mul_const(vertical, 2.0 * farclip * tanfov);

  if (cubicvr_length(hor) < cubicvr_length(vertical)) {
    hor = cubicvr_vertex_mul_const(hor, aspect);
  } else {
    vertical = cubicvr_vertex_mul_const(vertical, 1.0 / aspect);
  }

  var rayToCenter = cubicvr_vertex_add(rayFrom, rayForward);
  var dHor = cubicvr_vertex_mul_constant(hor, 1.0 / width);
  var dVert = cubicvr_vertex_mul_constant(vertical, 1.0 / height);


  var rayTo = cubicvr_vertex_add(rayToCenter, cubicvr_vertex_add(cubicvr_vertex_mul_const(hor, -0.5), cubicvr_vertex_mul_const(vertical, 0.5)));
  rayTo = cubicvr_vertex_add(rayTo, cubicvr_vertex_mul_const(dHor, x));
  rayTo = cubicvr_vertex_add(rayTo, cubicvr_vertex_mul_const(dVert, -y));

  return rayTo;
};

var cubicvr_scene = function(width, height, fov, nearclip, farclip, octree) {
  this.frames = 0;

  this.sceneObjects = [];
  this.sceneObjectsByName = [];
  this.sceneObjectsById = [];
  this.lights = [];
  this.pickables = [];
  this.octree = octree;
  this.skybox = null;
  this.camera = new cubicvr_camera(width, height, fov, nearclip, farclip);
  this._workers = null;
  this._parallelized = false;
};

cubicvr_scene.prototype.parallelize = function()
{
  this._parallelized = true;
  this._workers = [];
  if (this.octree !== undefined)
  {
    this._workers["octree"] = new CubicVR_Worker("octree");
    this._workers["octree"].start();
    this.octree = new OcTreeWorkerProxy(this._workers["octree"], this.camera, this.octree, this);
    this.camera.frustum = new FrustumWorkerProxy(this._workers["octree"], this.camera);
  } //if
}; //cubicvr_scene.parallelize

cubicvr_scene.prototype.setSkyBox = function(skybox) {
  this.skybox = skybox;
  //this.bindSceneObject(skybox.scene_object, null, false);
};

cubicvr_scene.prototype.getSceneObject = function(name) {
  return this.sceneObjectsByName[name];
};

cubicvr_scene.prototype.bindSceneObject = function(sceneObj, pickable, use_octree) {
  this.sceneObjects.push(sceneObj);
  if (typeof(pickable) !== 'undefined') {
    if (pickable) {
      this.pickables.push(sceneObj);
    }
  }

  if (sceneObj.name !== null) {
    this.sceneObjectsByName[sceneObj.name] = sceneObj;
  }

  if (typeof(this.octree) !== 'undefined' && (typeof(use_octree) === 'undefined' || use_octree === "true")) {
    if (sceneObj.id < 0) {
      sceneObj.id = scene_object_uuid;
      ++scene_object_uuid;
    } //if
    this.sceneObjectsById[sceneObj.id] = sceneObj;
    sceneObj.octree_aabb = [[0,0,0],[0,0,0]];
    this.octree.insert(sceneObj);
  }
};

cubicvr_scene.prototype.bindLight = function(lightObj) {
  this.lights.push(lightObj);
};

cubicvr_scene.prototype.bindCamera = function(cameraObj) {
  this.camera = cameraObj;
};


cubicvr_scene.prototype.evaluate = function(index) {
  for (var i = 0, iMax = this.sceneObjects.length; i < iMax; i++) {
    if (this.sceneObjects[i].motion === null) { continue; }
    this.sceneObjects[i].motion.apply(index, this.sceneObjects[i]);
  }

  if (this.camera.motion !== null) {
    this.camera.motion.apply(index, this.camera);


    if (this.camera.targetSceneObject !== null) {
      this.camera.target = this.camera.targetSceneObject.position;
    }
  }
};

cubicvr_scene.prototype.renderSceneObjectChildren = function(sceneObj) {
  var gl = CubicVR_GLCore.gl;
  var sflip = false;

  for (var i in sceneObj.children) {
    if (sceneObj.children.hasOwnProperty(i)) { 
      sceneObj.children[i].doTransform(sceneObj.tMatrix);

      if (sceneObj.children[i].scale[0] < 0) { sflip = !sflip; }
      if (sceneObj.children[i].scale[1] < 0) { sflip = !sflip; }
      if (sceneObj.children[i].scale[2] < 0) { sflip = !sflip; }

      if (sflip) { gl.cullFace(gl.FRONT); }

      cubicvr_renderObject(sceneObj.children[i].obj, this.camera.mvMatrix, this.camera.pMatrix, sceneObj.children[i].tMatrix, this.lights);

      if (sflip) { gl.cullFace(gl.BACK); }

      if (sceneObj.children[i].children !== null) {
        this.renderSceneObjectChildren(sceneObj.children[i]);
      }
    }
  }
};

cubicvr_scene.prototype.render = function() {
  ++this.frames;

  var gl = CubicVR_GLCore.gl;

  if (this.camera.targeted) {
    this.camera.lookat(this.camera.position[0], this.camera.position[1], this.camera.position[2], this.camera.target[0], this.camera.target[1], this.camera.target[2], 0, 1, 0);
  }
  else
  {
    this.camera.calcProjection();
  }
  
  
  

  var use_octree = typeof(this.octree) !== 'undefined';
  if (use_octree) {
    this.octree.reset_node_visibility();
    if (this.frames % 10 == 0) this.octree.cleanup();
    var frustum_hits = this.octree.get_frustum_hits(this.camera);
  } //if

  var sflip = false;
  var objects_rendered = 0;

  for (var i = 0, iMax = this.sceneObjects.length; i < iMax; i++) {

    var scene_object = this.sceneObjects[i];
    if (scene_object.obj === null) { continue; }
    if (scene_object.parent !== null) { continue; }

    scene_object.doTransform();
    if (scene_object.dirty) scene_object.adjust_octree();

    if (scene_object.visible === false || (use_octree && (scene_object.ignore_octree || scene_object.drawn_this_frame === true || scene_object.culled === true))) { continue; }

    ++objects_rendered;
    scene_object.drawn_this_frame = true;

    if (scene_object.scale[0] < 0) sflip = !sflip;
    if (scene_object.scale[1] < 0) sflip = !sflip;
    if (scene_object.scale[2] < 0) sflip = !sflip;

    if (sflip) { gl.cullFace(gl.FRONT); }

    cubicvr_renderObject(scene_object.obj, this.camera.mvMatrix, this.camera.pMatrix, scene_object.tMatrix, this.lights);

    if (sflip) { gl.cullFace(gl.BACK); }

    sflip = false;

    if (scene_object.children !== null) {
      this.renderSceneObjectChildren(scene_object);
    }
  }
  this.objects_rendered = objects_rendered;

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

/// find point on line A->B closest to point pointTest
var cubicvr_get_closest_to = function(ptA, ptB, ptTest) {
  var S, T, U;

  S = cubicvr_vertex_sub(ptB, ptA);
  T = cubicvr_vertex_sub(ptTest, ptA);
  U = cubicvr_vertex_add(cubicvr_vertex_mul_const(S, cubicvr_dp(S, T) / cubicvr_dp(S, S)), ptA);

  return U;
};


cubicvr_scene.prototype.bbRayTest = function(pos, ray, axisMatch) {
  var pt1, pt2;
  var selList = [];

  if (ray.length === 2) { ray = this.camera.getRayTo(ray[0], ray[1]); }

  pt1 = pos;
  pt2 = cubicvr_vtx_add(pos, ray);

  var i = 0;

  for (var obj_i in this.pickables) {
    if (this.pickables.hasOwnProperty(obj_i)) { 
      var obj = this.pickables[obj_i];

      var bb1, bb2;

      bb1 = obj.aabb[0];
      bb2 = obj.aabb[1];

      var center = cubicvr_vertex_mul_const(cubicvr_vtx_add(bb1, bb2), 0.5);

      var testPt = cubicvr_get_closest_to(pt1, pt2, center);

      var testDist = cubicvr_length(cubicvr_vtx_sub(testPt, center));

      if (((testPt[0] >= bb1[0] && testPt[0] <= bb2[0]) ? 1 : 0) + ((testPt[1] >= bb1[1] && testPt[1] <= bb2[1]) ? 1 : 0) + ((testPt[2] >= bb1[2] && testPt[2] <= bb2[2]) ? 1 : 0) >= axisMatch) {
        selList[testDist] = obj;
      }
    }
  }

  return selList;
};

var cubicvr_collectTextNode = function(tn) {
  if (!tn) { return ""; }

  var s = "";
  for (var i = 0; i < tn.childNodes.length; i++) {
    s += tn.childNodes[i].nodeValue;
  }
  return s;
};

function cubicvr_loadMesh(meshUrl, prefix) {
  if (typeof(CubicVR_MeshPool[meshUrl]) !== "undefined") { return CubicVR_MeshPool[meshUrl]; }

  var i, j, p, iMax, jMax, pMax;

  var obj = new CubicVR.object();
  var mesh = CubicVR.getXML(meshUrl);
  var pts_elem = mesh.getElementsByTagName("points");

  var pts_str = cubicvr_collectTextNode(pts_elem[0]);
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
  var mappers = Array();


  for (i = 0, iMax = material_elem.length; i < iMax; i++) {
    var melem = material_elem[i];

    var matName = (melem.getElementsByTagName("name").length) ? (melem.getElementsByTagName("name")[0].firstChild.nodeValue) : null;
    var mat = new CubicVR.material(matName);

    if (melem.getElementsByTagName("alpha").length) { mat.opacity = parseFloat(melem.getElementsByTagName("alpha")[0].firstChild.nodeValue); }
    if (melem.getElementsByTagName("shininess").length) { mat.shininess = (parseFloat(melem.getElementsByTagName("shininess")[0].firstChild.nodeValue) / 100.0); }
    if (melem.getElementsByTagName("max_smooth").length) { mat.max_smooth = parseFloat(melem.getElementsByTagName("max_smooth")[0].firstChild.nodeValue); }

    if (melem.getElementsByTagName("color").length) { mat.color = cubicvr_floatDelimArray(melem.getElementsByTagName("color")[0].firstChild.nodeValue); }
    if (melem.getElementsByTagName("ambient").length) { mat.ambient = cubicvr_floatDelimArray(melem.getElementsByTagName("ambient")[0].firstChild.nodeValue); }
    if (melem.getElementsByTagName("diffuse").length) { mat.diffuse = cubicvr_floatDelimArray(melem.getElementsByTagName("diffuse")[0].firstChild.nodeValue); }
    if (melem.getElementsByTagName("specular").length) { mat.specular = cubicvr_floatDelimArray(melem.getElementsByTagName("specular")[0].firstChild.nodeValue); }
    if (melem.getElementsByTagName("texture").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture")[0].firstChild.nodeValue;
      tex = (typeof(CubicVR_Texture_ref[texName]) !== 'undefined') ? CubicVR_Textures_obj[CubicVR_Texture_ref[texName]] : (new CubicVR.texture(texName));
      mat.setTexture(tex, TEXTURE_MAP_COLOR);
    }

    if (melem.getElementsByTagName("texture_luminosity").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_luminosity")[0].firstChild.nodeValue;
      tex = (typeof(CubicVR_Texture_ref[texName]) !== 'undefined') ? CubicVR_Textures_obj[CubicVR_Texture_ref[texName]] : (new CubicVR.texture(texName));
      mat.setTexture(tex, TEXTURE_MAP_AMBIENT);
    }

    if (melem.getElementsByTagName("texture_normal").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_normal")[0].firstChild.nodeValue;
      tex = (typeof(CubicVR_Texture_ref[texName]) !== 'undefined') ? CubicVR_Textures_obj[CubicVR_Texture_ref[texName]] : (new CubicVR.texture(texName));
      mat.setTexture(tex, TEXTURE_MAP_NORMAL);
    }

    if (melem.getElementsByTagName("texture_specular").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_specular")[0].firstChild.nodeValue;
      tex = (typeof(CubicVR_Texture_ref[texName]) !== 'undefined') ? CubicVR_Textures_obj[CubicVR_Texture_ref[texName]] : (new CubicVR.texture(texName));
      mat.setTexture(tex, TEXTURE_MAP_SPECULAR);
    }

    if (melem.getElementsByTagName("texture_bump").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_bump")[0].firstChild.nodeValue;
      tex = (typeof(CubicVR_Texture_ref[texName]) !== 'undefined') ? CubicVR_Textures_obj[CubicVR_Texture_ref[texName]] : (new CubicVR.texture(texName));
      mat.setTexture(tex, TEXTURE_MAP_BUMP);
    }

    if (melem.getElementsByTagName("texture_envsphere").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_envsphere")[0].firstChild.nodeValue;
      tex = (typeof(CubicVR_Texture_ref[texName]) !== 'undefined') ? CubicVR_Textures_obj[CubicVR_Texture_ref[texName]] : (new CubicVR.texture(texName));
      mat.setTexture(tex, TEXTURE_MAP_ENVSPHERE);
    }

    if (melem.getElementsByTagName("texture_alpha").length) {
      texName = (prefix ? prefix : "") + melem.getElementsByTagName("texture_alpha")[0].firstChild.nodeValue;
      tex = (typeof(CubicVR_Texture_ref[texName]) !== 'undefined') ? CubicVR_Textures_obj[CubicVR_Texture_ref[texName]] : (new CubicVR.texture(texName));
      mat.setTexture(tex, TEXTURE_MAP_ALPHA);
    }

    var uvSet = null;

    if (melem.getElementsByTagName("uvmapper").length) {
      var uvm = new CubicVR.uvmapper();
      var uvelem = melem.getElementsByTagName("uvmapper")[0];
      var uvmType = "";

      if (uvelem.getElementsByTagName("type").length) {
        uvmType = melem.getElementsByTagName("type")[0].firstChild.nodeValue;

        switch (uvmType) {
        case "uv":
          break;
        case "planar":
          uvm.projection_mode = UV_PROJECTION_PLANAR;
          break;
        case "cylindrical":
          uvm.projection_mode = UV_PROJECTION_CYLINDRICAL;
          break;
        case "spherical":
          uvm.projection_mode = UV_PROJECTION_SPHERICAL;
          break;
        case "cubic":
          uvm.projection_mode = UV_PROJECTION_CUBIC;
          break;
        }
      }

      if (uvmType === "uv") {
        if (uvelem.getElementsByTagName("uv").length) {
          var uvText = cubicvr_collectTextNode(melem.getElementsByTagName("uv")[0]);

          uvSet = uvText.split(" ");

          for (j = 0, jMax = uvSet.length; j < jMax; j++) {
            uvSet[j] = cubicvr_floatDelimArray(uvSet[j]);
          }
        }
      }

      if (uvelem.getElementsByTagName("axis").length) {
        var uvmAxis = melem.getElementsByTagName("axis")[0].firstChild.nodeValue;

        switch (uvmAxis) {
        case "x":
          uvm.projection_axis = UV_AXIS_X;
          break;
        case "y":
          uvm.projection_axis = UV_AXIS_Y;
          break;
        case "z":
          uvm.projection_axis = UV_AXIS_Z;
          break;
        }

      }

      if (melem.getElementsByTagName("center").length) { uvm.center = cubicvr_floatDelimArray(melem.getElementsByTagName("center")[0].firstChild.nodeValue); }
      if (melem.getElementsByTagName("rotation").length) { uvm.rotation = cubicvr_floatDelimArray(melem.getElementsByTagName("rotation")[0].firstChild.nodeValue); }
      if (melem.getElementsByTagName("scale").length) { uvm.scale = cubicvr_floatDelimArray(melem.getElementsByTagName("scale")[0].firstChild.nodeValue); }

      if (uvmType !== "" && uvmType !== "uv") { mappers.push([uvm, mat]); }
    }


    var seglist = null;
    var triangles = null;

    if (melem.getElementsByTagName("segments").length) { seglist = cubicvr_intDelimArray(cubicvr_collectTextNode(melem.getElementsByTagName("segments")[0]), " "); }
    if (melem.getElementsByTagName("triangles").length) { triangles = cubicvr_intDelimArray(cubicvr_collectTextNode(melem.getElementsByTagName("triangles")[0]), " "); }


    if (seglist === null) { seglist = [0, parseInt((triangles.length) / 3, 10)]; }

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

  CubicVR_MeshPool[meshUrl] = obj;

  return obj;
}




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
  v = bezier(x0, x1, x2, x3, t);
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




var cubicvr_env_outgoing = function(key0, key1) {
  var a, b, d, t, out;

  switch (key0.shape) {
  case ENV_SHAPE_TCB:
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

  case ENV_SHAPE_LINE:
    d = key1.value - key0.value;
    if (key0.prev) {
      t = (key1.time - key0.time) / (key1.time - (key0.prev).time);
      out = t * (key0.value - (key0.prev).value + d);
    } else { 
      out = d;
    }
    break;

  case ENV_SHAPE_BEZI:
  case ENV_SHAPE_HERM:
    out = key0.param[1];
    if (key0.prev) { out *= (key1.time - key0.time) / (key1.time - (key0.prev).time); }
    break;

  case ENV_SHAPE_BEZ2:
    out = key0.param[3] * (key1.time - key0.time);
    if (fabs(key0.param[2]) > 1e-5) { 
      out /= key0.param[2];
    } else { 
      out *= 1e5;
    }
    break;

  default:
  case ENV_SHAPE_STEP:
    out = 0.0;
    break;
  }

  return out;
};



var cubicvr_env_incoming = function(key0, key1) {
  var a, b, d, t, inval;

  switch (key1.shape) {
  case ENV_SHAPE_LINE:
    d = key1.value - key0.value;
    if (key1.next) {
      t = (key1.time - key0.time) / ((key1.next).time - key0.time);
      inval = t * ((key1.next).value - key1.value + d);
    } else { 
      inval = d;
    }
    break;

  case ENV_SHAPE_TCB:
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

  case ENV_SHAPE_BEZI:
  case ENV_SHAPE_HERM:
    inval = key1.param[0];
    if (key1.next) { inval *= (key1.time - key0.time) / ((key1.next).time - key0.time); }
    break;

  case ENV_SHAPE_BEZ2:
    inval = key1.param[1] * (key1.time - key0.time);
    if (Math.abs(key1.param[0]) > 1e-5) { 
      inval /= key1.param[0]; 
    } else { 
      inval *= 1e5;
    }
    break;

  default:
  case ENV_SHAPE_STEP:
    inval = 0.0;
    break;
  }

  return inval;
};


var cubicvr_envelope_key = function() {
  this.value = 0;
  this.time = 0;
  this.shape = ENV_SHAPE_TCB;
  this.tension = 0;
  this.continuity = 0;
  this.bias = 0;
  this.prev = null;
  this.next = null;

  this.param = Array(4);

  this.param[0] = 0;
  this.param[1] = 0;
  this.param[2] = 0;
  this.param[3] = 0;
};


var cubicvr_envelope = function() {
  this.nKeys = 0;
  this.keys = null;
  this.in_behavior = ENV_BEH_CONSTANT;
  this.out_behavior = ENV_BEH_CONSTANT;
};


cubicvr_envelope.prototype.setBehavior = function(in_b, out_b) {
  this.in_behavior = in_b;
  this.out_behavior = out_b;
};


cubicvr_envelope.prototype.empty = function() {
  return (this.nKeys === 0);
};


cubicvr_envelope.prototype.addKey = function(time, value) {
  var tempKey;

  tempKey = this.insertKey(time);
  tempKey.value = value;

  return tempKey;
};


cubicvr_envelope.prototype.insertKey = function(time) {
  var tempKey = new cubicvr_envelope_key();

  tempKey.time = time;

  var k1 = this.keys;

  if (!this.nKeys) {
    this.keys = tempKey;

    this.nKeys++;

    return tempKey;
  }

  while (k1) {
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

cubicvr_envelope.prototype.evaluate = function(time) {
  var key0, key1, skey, ekey;
  var t, h1, h2, h3, h4, inval, out, offset = 0.0;
  var noff;

  /* if there's no key, the value is 0 */
  if (this.nKeys === 0) { return 0.0; }

  /* if there's only one key, the value is constant */
  if (this.nKeys === 1) { return (this.keys).value; }

  /* find the first and last keys */
  skey = ekey = this.keys;
  while (ekey.next) { ekey = ekey.next; }

  var tmp;

  /* use pre-behavior if time is before first key time */
  if (time < skey.time) {
    switch (this.in_behavior) {
    case ENV_BEH_RESET:
      return 0.0;

    case ENV_BEH_CONSTANT:
      return skey.value;

    case ENV_BEH_REPEAT:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      break;

    case ENV_BEH_OSCILLATE:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];

      if (noff % 2) { time = ekey.time - skey.time - time; }
      break;

    case ENV_BEH_OFFSET:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];
      offset = noff * (ekey.value - skey.value);
      break;

    case ENV_BEH_LINEAR:
      out = cubicvr_env_outgoing(skey, skey.next) / (skey.next.time - skey.time);
      return out * (time - skey.time) + skey.value;
    }
  }

  /* use post-behavior if time is after last key time */
  else if (time > ekey.time) {
    switch (this.out_behavior) {
    case ENV_BEH_RESET:
      return 0.0;

    case ENV_BEH_CONSTANT:
      return ekey.value;

    case ENV_BEH_REPEAT:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      break;

    case ENV_BEH_OSCILLATE:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];

      if (noff % 2) { time = ekey.time - skey.time - time; }
      break;

    case ENV_BEH_OFFSET:
      tmp = cubicvr_env_range(time, skey.time, ekey.time);
      time = tmp[0];
      noff = tmp[1];
      offset = noff * (ekey.value - skey.value);
      break;

    case ENV_BEH_LINEAR:
      inval = cubicvr_env_incoming(ekey.prev, ekey) / (ekey.time - ekey.prev.time);
      return inval * (time - ekey.time) + ekey.value;
    }
  }

  // get the endpoints of the interval being evaluated
  key0 = this.keys;
  while (time > key0.next.time) {
    key0 = key0.next;
  }
  key1 = key0.next;

  // check for singularities first
  if (time === key0.time) { return key0.value + offset; }
  else if (time === key1.time) { return key1.value + offset; }

  // get interval length, time in [0, 1]
  t = (time - key0.time) / (key1.time - key0.time);

  // interpolate
  switch (key1.shape) {
  case ENV_SHAPE_TCB:
  case ENV_SHAPE_BEZI:
  case ENV_SHAPE_HERM:
    out = cubicvr_env_outgoing(key0, key1);
    inval = cubicvr_env_incoming(key0, key1);
    var h = cubicvr_env_hermite(t);
    return h[0] * key0.value + h[1] * key1.value + h[2] * out + h[3] * inval + offset;

  case ENV_SHAPE_BEZ2:
    return cubicvr_env_bez2(key0, key1, time) + offset;

  case ENV_SHAPE_LINE:
    return key0.value + t * (key1.value - key0.value) + offset;

  case ENV_SHAPE_STEP:
    return key0.value + offset;

  default:
    return offset;
  }
};

var cubicvr_motion = function() {
  this.controllers = Array();
  this.yzflip = false;
};

cubicvr_motion.prototype.envelope = function(controllerId, motionId) {
  if (typeof(this.controllers[controllerId]) === 'undefined') { this.controllers[controllerId] = []; }
  if (typeof(this.controllers[controllerId][motionId]) === 'undefined') { this.controllers[controllerId][motionId] = new cubicvr_envelope(); }

  return this.controllers[controllerId][motionId];
};

cubicvr_motion.prototype.evaluate = function(index) {
  var retArr = Array();

  for (var i in this.controllers) {
    if (this.controllers.hasOwnProperty(i)) { 
      retArr[i] = Array();

      for (var j in this.controllers[i]) {
        if (this.controllers[i].hasOwnProperty(j)) { 
          retArr[i][j] = this.controllers[i][j].evaluate(index);
        }
      }
    }
  }

  return retArr;
};

cubicvr_motion.prototype.apply = function(index, target) {
  for (var i in this.controllers) {
    if (this.controllers.hasOwnProperty(i)) { 
      var ic = parseInt(i, 10);

      /* Special case quaternion fix for ZY->YZ rotation envelopes */
      if (this.yzflip && ic === MOTION_ROT) // assume channel 0,1,2
      {
        if (!this.q) this.q = new cubicvr_Quaternion();
        var q = this.q;
      
        var x = this.controllers[i][0].evaluate(index);
        var y = this.controllers[i][1].evaluate(index);
        var z = this.controllers[i][2].evaluate(index);
        
        q.fromEuler(x,z,-y);
        
        var qr = q.toEuler();
        
        target.control(ic, 0, qr[0]);
        target.control(ic, 1, qr[1]);
        target.control(ic, 2, qr[2]);
      }
      else
      {
        for (var j in this.controllers[i]) {
          if (this.controllers[i].hasOwnProperty(j)) { 
            target.control(ic, parseInt(j, 10), this.controllers[i][j].evaluate(index));
          }
        }        
      }
    }
  }
};


cubicvr_motion.prototype.setKey = function(controllerId, motionId, index, value) {
  var ev = this.envelope(controllerId, motionId);
  return ev.addKey(index, value);
};

cubicvr_motion.prototype.setArray = function(controllerId, index, value) {
  var tmpKeys = Array();

  for (var i in value) {
    if (value.hasOwnProperty(i)) { 
      var ev = this.envelope(controllerId, i);
      tmpKeys[i] = ev.addKey(index, value[i]);
    }
  }

  return tmpKeys;
};


cubicvr_motion.prototype.setBehavior = function(controllerId, motionId, behavior_in, behavior_out) {
  var ev = this.envelope(controllerId, motionId);
  ev.setBehavior(behavior_in, behavior_out);
};


cubicvr_motion.prototype.setBehaviorArray = function(controllerId, behavior_in, behavior_out) {
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
      if (typeof(c[k]) !== "undefined") {
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
            intype = cubicvr_collectTextNode(ein[0]);
          }

          if (eout.length) {
            outtype = cubicvr_collectTextNode(eout[0]);
          }

          if (etime.length) {
            time = cubicvr_floatDelimArray(cubicvr_collectTextNode(etime[0]), " ");
          }

          if (evalue.length) {
            value = cubicvr_floatDelimArray(cubicvr_collectTextNode(evalue[0]), " ");
          }

          if (etcb.length) {
            tcb = cubicvr_floatDelimArray(cubicvr_collectTextNode(etcb[0]), " ");
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

          var in_beh = ENV_BEH_CONSTANT;
          var out_beh = ENV_BEH_CONSTANT;

          if (intype) { 
            switch (intype) {
            case "reset":
              in_beh = ENV_BEH_RESET;
              break;
            case "constant":
              in_beh = ENV_BEH_CONSTANT;
              break;
            case "repeat":
              in_beh = ENV_BEH_REPEAT;
              break;
            case "oscillate":
              in_beh = ENV_BEH_OSCILLATE;
              break;
            case "offset":
              in_beh = ENV_BEH_OFFSET;
              break;
            case "linear":
              in_beh = ENV_BEH_LINEAR;
              break;
            }
          }

          if (outtype) {
            switch (outtype) {
            case "reset":
              out_beh = ENV_BEH_RESET;
              break;
            case "constant":
              out_beh = ENV_BEH_CONSTANT;
              break;
            case "repeat":
              out_beh = ENV_BEH_REPEAT;
              break;
            case "oscillate":
              out_beh = ENV_BEH_OSCILLATE;
              break;
            case "offset":
              out_beh = ENV_BEH_OFFSET;
              break;
            case "linear":
              out_beh = ENV_BEH_LINEAR;
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
  if (node === null) { return false; }

  return (node.getElementsByTagName("x").length || node.getElementsByTagName("y").length || node.getElementsByTagName("z").length || node.getElementsByTagName("fov").length);
}

function cubicvr_loadScene(sceneUrl, model_prefix, image_prefix) {
  if (typeof(model_prefix) === "undefined") { model_prefix = ""; }
  if (typeof(image_prefix) === "undefined") { image_prefix = ""; }

  var obj = new CubicVR.object();
  var scene = CubicVR.getXML(sceneUrl);

  var sceneOut = new cubicvr_scene();

  var parentingSet = [];

  var sceneobjs = scene.getElementsByTagName("sceneobjects");

  //  var pts_str = cubicvr_collectTextNode(pts_elem[0]);
  for (var i = 0, iMax = sceneobjs[0].childNodes.length; i < iMax; i++) {
    var sobj = sceneobjs[0].childNodes[i];

    if (sobj.tagName === "sceneobject") {

      var name = "unnamed";
      var parent = "";
      var model = "";

      var tempNode = sobj.getElementsByTagName("name");
      if (tempNode.length) {
        name = cubicvr_collectTextNode(tempNode[0]);
      }

      var tempNode = sobj.getElementsByTagName("parent");
      if (tempNode.length) {
        parent = cubicvr_collectTextNode(tempNode[0]);
      }

      tempNode = sobj.getElementsByTagName("model");
      if (tempNode.length) {
        model = cubicvr_collectTextNode(tempNode[0]);
      }

      var position = null,
        rotation = null,
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

      var sceneObject = new cubicvr_sceneObject(obj, name);

      if (cubicvr_isMotion(position)) {
        if (!sceneObject.motion) { sceneObject.motion = new cubicvr_motion(); }
        cubicvr_nodeToMotion(position, MOTION_POS, sceneObject.motion);
      } else if (position) {
        sceneObject.position = cubicvr_floatDelimArray(cubicvr_collectTextNode(position));
      }

      if (cubicvr_isMotion(rotation)) {
        if (!sceneObject.motion) { sceneObject.motion = new cubicvr_motion(); }
        cubicvr_nodeToMotion(rotation, MOTION_ROT, sceneObject.motion);
      } else {
        sceneObject.rotation = cubicvr_floatDelimArray(cubicvr_collectTextNode(rotation));
      }

      if (cubicvr_isMotion(scale)) {
        if (!sceneObject.motion) { sceneObject.motion = new cubicvr_motion(); }
        cubicvr_nodeToMotion(scale, MOTION_SCL, sceneObject.motion);
      } else {
        sceneObject.scale = cubicvr_floatDelimArray(cubicvr_collectTextNode(scale));

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
    var position = null,
      rotation = null;

    var target = "";

    var tempNode = camera[0].getElementsByTagName("name");

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
      if (!cam.motion) { cam.motion = new cubicvr_motion(); }
      cubicvr_nodeToMotion(position, MOTION_POS, cam.motion);
    } else if (position) {
      cam.position = cubicvr_floatDelimArray(position.firstChild.nodeValue);
    }

    if (cubicvr_isMotion(rotation)) {
      if (!cam.motion) { cam.motion = new cubicvr_motion(); }
      cubicvr_nodeToMotion(rotation, MOTION_ROT, cam.motion);
    } else if (rotation) {
      cam.rotation = cubicvr_floatDelimArray(rotation.firstChild.nodeValue);
    }

    if (cubicvr_isMotion(fov)) {
      if (!cam.motion) { cam.motion = new cubicvr_motion(); }
      cubicvr_nodeToMotion(fov, MOTION_FOV, cam.motion);
    } else if (fov) {
      cam.fov = parseFloat(fov.firstChild.nodeValue);
    }

  }


  return sceneOut;
}


var cubicvr_renderBuffer = function(width, height, depth_enabled) {
  this.createBuffer(width, height, depth_enabled);
};

cubicvr_renderBuffer.prototype.createBuffer = function(width, height, depth_enabled) {
  this.fbo = null;
  this.depth = null;
  this.texture = null;
  this.width = parseInt(width, 10);
  this.height = parseInt(height, 10);

  var w = this.sizeParam(width);
  var h = this.sizeParam(height);

  var gl = CubicVR_GLCore.gl;

  this.fbo = gl.createFramebuffer();

  if (depth_enabled) { this.depth = gl.createRenderbuffer(); }

  // configure fbo
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
  if (depth_enabled) { gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth); }

  // if (navigator.userAgent.indexOf('Firefox') !== -1) {
  //   if (depth_enabled) { gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT, w, h); }
  // } else {
    if (depth_enabled) { gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); }
  // }
  //  GL_DEPTH_COMPONENT32 0x81A7
  //  if (depth_enabled) { gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT, w, h); }
  if (depth_enabled) { gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth); }

  // init texture
  this.texture = new cubicvr_texture();
  gl.bindTexture(gl.TEXTURE_2D, CubicVR_Textures[this.texture.tex_id]);

  // configure texture params
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // clear buffer
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, CubicVR_Textures[this.texture.tex_id], 0);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

cubicvr_renderBuffer.prototype.destroyBuffer = function() {
  var gl = CubicVR_GLCore.gl;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteRenderbuffer(this.depth);
  gl.deleteFramebuffer(this.fbo);
  gl.deleteTexture(CubicVR_Textures[this.texture.tex_id]);
  CubicVR_Textures[this.texture.tex_id] = null;
};

cubicvr_renderBuffer.prototype.sizeParam = function(t) {
  return t;
  // var s = 32;
  //
  // while (t > s) s *= 2;
  //
  // return s;
};


cubicvr_renderBuffer.prototype.use = function() {
  var gl = CubicVR_GLCore.gl;

  gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
  //  if (this.depth !== null) { gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth); }
  //  gl.viewport(0, 0, this.width, this.height);
};



var cubicvr_postProcessFX = function(width, height) {
  this.bloom = true;

  this.renderBuffer = new cubicvr_renderBuffer(width, height, true);
  this.blurBuffer = new cubicvr_renderBuffer(width, height, false);
  this.bloomBuffer = new cubicvr_renderBuffer(parseInt(width / 6, 10), parseInt(height / 6, 10), false);

  this.copyShader = new cubicvr_shader("attribute vec3 aVertex;\n" + "attribute vec2 aTex;\n" + "varying vec2 vTex;\n" + "void main(void)\n" + "{\n" + "vTex = aTex;\n" + "vec4 vPos = vec4(aVertex.xyz,1.0);\n" + "gl_Position = vPos;\n" + "}\n", "#ifdef GL_ES\nprecision highp float;\n#endif\n" + "uniform sampler2D srcTex;\n" + "varying vec2 vTex;\n" + "void main(void)\n" + "{\n" + "gl_FragColor = texture2D(srcTex, vTex);\n" + "}\n");


  this.copyShader.use();
  this.copyShader.addUVArray("aTex");
  this.copyShader.addVertexArray("aVertex");
  this.copyShader.addInt("srcTex", 0);

  this.fsQuad = this.makeFSQuad(width, height);

  this.bloomShader = new cubicvr_shader("attribute vec3 aVertex;\n" + "attribute vec2 aTex;\n" + "varying vec2 vTex;\n" + "void main(void)\n" + "{\n" + "vTex = aTex;\n" + "vec4 vPos = vec4(aVertex.xyz,1.0);\n" + "gl_Position = vPos;\n" + "}\n",

  "#ifdef GL_ES\nprecision highp float;\n#endif\n" + "uniform sampler2D srcTex;\n" + "uniform vec3 texel_ofs;\n" + "varying vec2 vTex;\n" + "vec3 rangeValHDR(vec3 src)\n" + "{\n" + "return (src.r>0.90||src.g>0.90||src.b>0.90)?(src):vec3(0.0,0.0,0.0);\n" + "}\n" + "vec4 hdrSample(float rad)\n" + "{\n" + "vec3 accum;\n" + "float radb = rad*0.707106781;\n" + "accum =  rangeValHDR(texture2D(srcTex, vec2(vTex.s+texel_ofs.x*rad,  vTex.t)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s,          vTex.t+texel_ofs.y*rad)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s-texel_ofs.x*rad,  vTex.t)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s,          vTex.t-texel_ofs.y*rad)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s+texel_ofs.x*radb, vTex.t+texel_ofs.y*radb)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s-texel_ofs.x*radb, vTex.t-texel_ofs.y*radb)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s+texel_ofs.x*radb, vTex.t-texel_ofs.y*radb)).rgb);\n" + "accum += rangeValHDR(texture2D(srcTex, vec2(vTex.s-texel_ofs.x*radb, vTex.t+texel_ofs.y*radb)).rgb);\n" + "accum /= 8.0;\n" + "return vec4(accum,1.0);\n" + "}\n" + "void main(void)\n" + "{\n" + "vec4 color;\n" + "color = hdrSample(2.0);\n" + "color += hdrSample(8.0);\n" + "color += hdrSample(12.0);\n" + "gl_FragColor = color/2.0;\n" + "}\n");

  this.bloomShader.use();
  this.bloomShader.addUVArray("aTex");
  this.bloomShader.addVertexArray("aVertex");
  this.bloomShader.addInt("srcTex", 0);
  this.bloomShader.addVector("texel_ofs");
  this.bloomShader.setVector("texel_ofs", [1.0 / this.renderBuffer.sizeParam(width), 1.0 / this.renderBuffer.sizeParam(height), 0]);

  this.fsQuadBloom = this.makeFSQuad(this.bloomBuffer.width, this.bloomBuffer.height);

  this.blurShader = new cubicvr_shader("attribute vec3 aVertex;\n" + "attribute vec2 aTex;\n" + "varying vec2 vTex;\n" + "void main(void)\n" + "{\n" + "vTex = aTex;\n" + "vec4 vPos = vec4(aVertex.xyz,1.0);\n" + "gl_Position = vPos;\n" + "}\n", "#ifdef GL_ES\nprecision highp float;\n#endif\n" + "uniform sampler2D srcTex;\n" + "varying vec2 vTex;\n" + "uniform float opacity;\n" + "void main(void)\n" + "{\n" + "gl_FragColor = vec4(texture2D(srcTex, vTex).rgb, opacity);\n" + "}\n");

  this.blurShader.use();
  this.blurShader.addUVArray("aTex");
  this.blurShader.addVertexArray("aVertex");
  this.blurShader.addInt("srcTex", 0);
  this.blurShader.addFloat("opacity");
  this.blurOpacity = 0.1;


  var gl = CubicVR_GLCore.gl;

  this.blurBuffer.use();
  gl.clear(gl.COLOR_BUFFER_BIT);
  this.end();

};

cubicvr_postProcessFX.prototype.resize = function(width, height) {
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

cubicvr_postProcessFX.prototype.begin = function() {
  this.renderBuffer.use();
};

cubicvr_postProcessFX.prototype.end = function() {
  var gl = CubicVR_GLCore.gl;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  //  if (this.depth !== null) { gl.bindRenderbuffer(gl.RENDERBUFFER, null); }
};

cubicvr_postProcessFX.prototype.makeFSQuad = function(width, height) {
  var gl = CubicVR_GLCore.gl;
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

cubicvr_postProcessFX.prototype.destroyFSQuad = function(fsQuad) {
  var gl = CubicVR_GLCore.gl;

  gl.deleteBuffer(fsQuad.gl_points);
  gl.deleteBuffer(fsQuad.gl_uvs);
};

cubicvr_postProcessFX.prototype.renderFSQuad = function(shader, fsq) {
  var gl = CubicVR_GLCore.gl;

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

cubicvr_postProcessFX.prototype.render = function() {
  var gl = CubicVR_GLCore.gl;

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


function cubicvr_repackArray(data, stride, count) {
  if (data.length !== parseInt(stride, 10) * parseInt(count, 10)) {
    alert("array repack error, data size !== stride*count.");
  }

  var returnData = new Array();

  var c = 0;
  for (var i = 0, iMax = data.length; i < iMax; i++) {
    var ims = i % stride;

    if (typeof(returnData[c])==='undefined') {
      returnData[c] = new Array();
    }

    returnData[c][ims] = data[i];

    if (ims === stride - 1) {
      c++;
    }
  }

  return returnData;
}

function cubicvr_loadCollada(meshUrl, prefix) {
  //  if (typeof(CubicVR_MeshPool[meshUrl]) !== "undefined") return CubicVR_MeshPool[meshUrl];
  var obj = new CubicVR.object();
  var scene = new CubicVR.scene();
  var cl = CubicVR.getXML(meshUrl);
  var meshes = [];

  //  console.log(cl);
  var cl_lib_asset = cl.getElementsByTagName("asset");

  var up_axis = 1; // Y
  if (cl_lib_asset.length) {
    var cl_up_axis = cl_lib_asset[0].getElementsByTagName("up_axis");
    if (cl_up_axis.length) {
      var axisval = cubicvr_collectTextNode(cl_up_axis[0]);

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
  
  var fixukaxis = function(mot,chan,val)
  {
//    if (mot === MOTION_POS && chan === MOTION_Y && up_axis === MOTION_Z) return -val;
    if (mot === MOTION_POS && chan === MOTION_Z && up_axis === MOTION_Z) return -val;
    return val;
  }

  var fixuraxis = function(mot,chan,val)
  {
    if (mot === MOTION_ROT && chan === MOTION_Z && up_axis === MOTION_Z) return -val;
    // if (mot === MOTION_ROT && chan === MOTION_X && up_axis === MOTION_Z) return val;
    // if (mot === MOTION_ROT && chan === MOTION_Z && up_axis === MOTION_Z) return -val;
    if (mot === MOTION_ROT && chan === MOTION_X && up_axis === MOTION_Z) return -val;
    return val;
  }



  var cl_lib_images = cl.getElementsByTagName("library_images");
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
          var imageSource = cubicvr_collectTextNode(cl_imgsrc[0]);
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

  var effectsRef = [];
  var effectCount, effectMax;

  if (cl_lib_effects.length) {
    var cl_effects = cl_lib_effects[0].getElementsByTagName("effect");

    for (effectCount = 0, effectMax = cl_effects.length; effectCount < effectMax; effectCount++) {
      var cl_effect = cl_effects[effectCount];

      var effectId = cl_effect.getAttribute("id");

      var effect = {};

      effect.id = effectId;

      effect.surfaces = [];
      effect.samplers = [];

      var cl_params = cl_effect.getElementsByTagName("newparam");

      var params = [];

      var cl_init;

      if (cl_params.length) {
        for (var pCount = 0, pMax = cl_params.length; pCount < pMax; pCount++) {
          var cl_param = cl_params[pCount];

          var paramId = cl_param.getAttribute("sid");

          var cl_surfaces = cl_param.getElementsByTagName("surface");
          var cl_samplers = cl_param.getElementsByTagName("sampler2D");

          if (cl_surfaces.length) {
            effect.surfaces[paramId] = {};

            cl_init = cl_surfaces[0].getElementsByTagName("init_from");

            if (cl_init.length) {
              var initFrom = cubicvr_collectTextNode(cl_init[0]);

              if (typeof(imageRef[initFrom]) === 'object') {
                effect.surfaces[paramId].texture = new CubicVR.texture(prefix + "/" + imageRef[initFrom].source);
                effect.surfaces[paramId].source = prefix + "/" + imageRef[initFrom].source;
                //                console.log(prefix+"/"+imageRef[initFrom].source);
              }
            }
          } else if (cl_samplers.length) {
            effect.samplers[paramId] = {};

            cl_init = cl_samplers[0].getElementsByTagName("source");

            if (cl_init.length) {
              effect.samplers[paramId].source = cubicvr_collectTextNode(cl_init[0]);
            }

            cl_init = cl_samplers[0].getElementsByTagName("minfilter");

            if (cl_init.length) {
              effect.samplers[paramId].minfilter = cubicvr_collectTextNode(cl_init[0]);
            }

            cl_init = cl_samplers[0].getElementsByTagName("magfilter");

            if (cl_init.length) {
              effect.samplers[paramId].magfiter = cubicvr_collectTextNode(cl_init[0]);
            }
          }

        }
      }

      var cl_technique = cl_effect.getElementsByTagName("technique");

      var getColorNode = (function() { 
        return function(n) {
          var el = n.getElementsByTagName("color");
          if (!el.length) { return false; }

          var cn = cubicvr_collectTextNode(el[0]);
          var ar = cubicvr_floatDelimArray(cn, " ");

          return ar;
        };
      }());

      var getFloatNode = (function() {
        return function(n) {
          var el = n.getElementsByTagName("float");
          if (!el.length) { return false; }

          var cn = parseFloat(cubicvr_collectTextNode(el[0]));

          return cn;
        };
      }());

      var getTextureNode = (function() {
        return function(n) {
          var el = n.getElementsByTagName("texture");
          if (!el.length) { return false; }

          var cn = el[0].getAttribute("texture");

          return cn;
        };
      }());

      effect.material = new CubicVR.material(effectId);

      for (var tCount = 0, tMax = cl_technique.length; tCount < tMax; tCount++) {
        //        if (cl_technique[tCount].getAttribute("sid") === 'common') {
          var tech = cl_technique[tCount].getElementsByTagName("blinn");

          if (!tech.length) { tech = cl_technique[tCount].getElementsByTagName("phong"); }

          if (tech.length) {
            for (var eCount = 0, eMax = tech[0].childNodes.length; eCount < eMax; eCount++) {
              var node = tech[0].childNodes[eCount];

              if (node.nodeType === 1) {
                var c = getColorNode(node);
                var f = getFloatNode(node);
                var t = getTextureNode(node);

                if (c !== false) {
                  if (c.length > 3) { c.pop(); }
                }

                switch (node.tagName) {
                case "emission":
                  break;
                case "ambient":
                  if (c !== false) { effect.material.ambient = c; }
                  break;
                case "diffuse":
                  if (c !== false) { effect.material.color = c; }
                  break;
                case "specular":
                  if (c !== false) { effect.material.specular = c; }
                  break;
                case "shininess":
                  if (f !== false) { effect.material.shininess = f; }
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
                    break;
                  case "ambient":
                    effect.material.setTexture(srcTex, TEXTURE_MAP_AMBIENT);
                    break;
                  case "diffuse":
                    effect.material.setTexture(srcTex, TEXTURE_MAP_COLOR);
                    break;
                  case "specular":
                    effect.material.setTexture(srcTex, TEXTURE_MAP_SPECULAR);
                    break;
                  case "shininess":
                    break;
                  case "reflective":
                    effect.material.setTexture(srcTex, TEXTURE_MAP_REFLECT);
                    break;
                  case "reflectivity":
                    break;
                  case "transparent":
                    effect.material.setTexture(srcTex, TEXTURE_MAP_ALPHA);
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
    for (var i = 0, iMax = cl_lib_mat_inst.length; i < iMax; i++) {
      var cl_mat_inst = cl_lib_mat_inst[i];

      var symbolId = cl_mat_inst.getAttribute("symbol");
      var targetId = cl_mat_inst.getAttribute("target").substr(1);

      materialMap[symbolId] = targetId;
    }
  }

  var cl_lib_materials = cl.getElementsByTagName("library_materials");

  var materialsRef = [];

  if (cl_lib_materials.length) {
    var cl_materials = cl.getElementsByTagName("material");

    for (var mCount = 0, mMax = cl_materials.length; mCount < mMax; mCount++) {
      var cl_material = cl_materials[mCount];

      var materialId = cl_material.getAttribute("id");
      var materialName = cl_material.getAttribute("name");

      var cl_einst = cl_material.getElementsByTagName("instance_effect");

      if (cl_einst.length) {
        var effectId = cl_einst[0].getAttribute("url").substr(1);
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

  if (cl_lib_geo.length) {
    for (var geoCount = 0, geoMax = cl_lib_geo.length; geoCount < geoMax; geoCount++) {
      var cl_geo = cl_lib_geo[geoCount];

      var cl_geo_node = cl_geo.getElementsByTagName("geometry");

      if (cl_geo_node.length) {
        for (var meshCount = 0, meshMax = cl_geo_node.length; meshCount < meshMax; meshCount++) {
          var cl_geomesh = cl_geo_node[meshCount].getElementsByTagName("mesh");

          var meshId = cl_geo_node[meshCount].getAttribute("id");
          var meshName = cl_geo_node[meshCount].getAttribute("name");

          var newObj = new CubicVR.object(meshName);

          CubicVR_MeshPool[meshUrl + "@" + meshName] = newObj;

          // console.log("found "+meshUrl+"@"+meshName);
          if (cl_geomesh.length) {
            var cl_geosources = cl_geomesh[0].getElementsByTagName("source");

            var geoSources = [];

            for (var sourceCount = 0, sourceMax = cl_geosources.length; sourceCount < sourceMax; sourceCount++) {
              var cl_geosource = cl_geosources[sourceCount];

              var sourceId = cl_geosource.getAttribute("id");
              var sourceName = cl_geosource.getAttribute("name");
              var cl_floatarray = cl_geosource.getElementsByTagName("float_array");

              if (cl_floatarray.length) {
                geoSources[sourceId] = {
                  id: sourceId,
                  name: sourceName,
                  data: cubicvr_floatDelimArray(cubicvr_collectTextNode(cl_floatarray[0]), " ")
                };
              }

              var cl_accessor = cl_geosource.getElementsByTagName("accessor");

              if (cl_accessor.length) {
                geoSources[sourceId].count = cl_accessor[0].getAttribute("count");
                geoSources[sourceId].stride = cl_accessor[0].getAttribute("stride");
                geoSources[sourceId].data = cubicvr_repackArray(geoSources[sourceId].data, geoSources[sourceId].stride, geoSources[sourceId].count);
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
              var cl_inputs = cl_vertices[0].getElementsByTagName("input");

              if (cl_inputs.length) {
                for (var inpCount = 0, inpMax = cl_inputs.length; inpCount < inpMax; inpCount++) {
                  var cl_input = cl_inputs[inpCount];

                  if (cl_input.getAttribute("semantic") === "POSITION") {
                    pointRef = cl_input.getAttribute("source").substr(1);
                  }
                }
              }
            }

            var cl_triangles = cl_geomesh[0].getElementsByTagName("triangles");

            if (cl_triangles.length) {
              for (var tCount = 0, tMax = cl_triangles.length; tCount < tMax; tCount++) {
                var cl_trianglesCount = parseInt(cl_triangles[tCount].getAttribute("count"), 10);
                var cl_inputs = cl_triangles[tCount].getElementsByTagName("input");
                var cl_inputmap = [];

                var materialRef = cl_triangles[tCount].getAttribute("material");

                // console.log("Material: "+materialRef);
                //              console.log(materialsRef[materialMap[materialRef]].mat);
                if (materialRef === null) {
                  newObj.setFaceMaterial(0);
                } else {
                  newObj.setFaceMaterial(materialsRef[materialMap[materialRef]].mat);
                }

                var CL_VERTEX = 0,
                  CL_NORMAL = 1,
                  CL_TEXCOORD = 2,
                  CL_OTHER = 3;

                if (cl_inputs.length) {
                  for (var inpCount = 0, inpMax = cl_inputs.length; inpCount < inpMax; inpCount++) {
                    var cl_input = cl_inputs[inpCount];

                    var ofs = parseInt(cl_input.getAttribute("offset"), 10);
                    var nameRef = cl_input.getAttribute("source").substr(1);

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

                var cl_triangle_source = cl_triangles[tCount].getElementsByTagName("p");

                var triangleData = [];

                if (cl_triangle_source.length) {
                  triangleData = cubicvr_intDelimArray(cubicvr_collectTextNode(cl_triangle_source[0]), " ");
                }

                if (triangleData.length) {
                  var computedLen = ((triangleData.length) / cl_inputmap.length) / 3;

                  if (computedLen !== cl_trianglesCount) {
                    //                console.log("triangle data doesn't add up, skipping object load: "+computedLen+" !== "+cl_trianglesCount);
                  } else {
                    if (newObj.points.length === 0) { newObj.points = geoSources[pointRef].data; }

                    for (var i = 0, iMax = triangleData.length, iMod = cl_inputmap.length; i < iMax; i += iMod * 3) {
                      var norm = [];
                      var vert = [];
                      var uv = [];

                      for (var j = 0; j < iMod * 3; j++) {
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
                        var nFace = newObj.addFace(vert);

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

            if (up_axis !== 1) {
              for (var i = 0, iMax = newObj.points.length; i < iMax; i++) {
                // console.log(newObj.points[i]);
                newObj.points[i] = fixuaxis(newObj.points[i]);
                // console.log(newObj.points[i],":");
              }
            }

            // newObj.calcNormals();
            newObj.compile();
            meshes[meshId] = newObj;
            // console.log(newObj);
            // return newObj;
          }
        }
      };

    }
  }
  
  
  var cl_lib_cameras = cl.getElementsByTagName("library_cameras");

  var camerasRef = [];
  var camerasBoundRef = [];

  if (cl_lib_cameras.length) {
    var cl_cameras = cl.getElementsByTagName("camera");

    for (var cCount = 0, cMax = cl_cameras.length; cCount < cMax; cCount++) {
      var cl_camera = cl_cameras[cCount];

      var cameraId = cl_camera.getAttribute("id");
      var cameraName = cl_camera.getAttribute("name");
      
      var cl_perspective = cl_camera.getElementsByTagName("perspective");
      
      if (cl_perspective.length)
      {
        var perspective = cl_perspective[0];
        
        var cl_yfov = perspective.getElementsByTagName("yfov");
        var cl_znear = perspective.getElementsByTagName("znear");
        var cl_zfar = perspective.getElementsByTagName("zfar");

        var yfov = cl_yfov.length?cubicvr_collectTextNode(cl_yfov[0]):60;
        var znear = cl_znear.length?cubicvr_collectTextNode(cl_znear[0]):0.1;
        var zfar = cl_zfar.length?cubicvr_collectTextNode(cl_zfar[0]):1000.0;
        
        var newCam = new cubicvr_camera(512,512,parseFloat(yfov),parseFloat(znear),parseFloat(zfar));
        newCam.targeted = false;

        camerasRef[cameraId] = newCam;
     }
      
//      console.log(cl_perspective);
    }
  }
  
  
  
  var cl_getInitalTransform = function(scene_node)
  {
    var retObj = { position:[0,0,0], rotation:[0,0,0], scale:[1,1,1] };
    
     var cl_translate = scene_node.getElementsByTagName("translate");

      if (cl_translate.length) {
        retObj.position = fixuaxis(cubicvr_floatDelimArray(cubicvr_collectTextNode(cl_translate[0]), " "));
      }

      var cl_rotate = scene_node.getElementsByTagName("rotate");

      if (cl_rotate.length) {
        for (var r = 0, rMax = cl_rotate.length; r < rMax; r++) {
          var cl_rot = cl_rotate[r];

          var rType = cl_rot.getAttribute("sid");

          var rVal = cubicvr_floatDelimArray(cubicvr_collectTextNode(cl_rot), " ");

          switch (rType) {
          case "rotateX":
            retObj.rotation[0] = rVal[3];
            break;
          case "rotateY":
            retObj.rotation[1] = rVal[3];
            break;
          case "rotateZ":
            retObj.rotation[2] = rVal[3];
          }
        }
        if (up_axis === 2) { retObj.rotation = fixraxis(retObj.rotation); }
      }

    

      var cl_scale = scene_node.getElementsByTagName("scale");

      if (cl_scale.length) {
        retObj.scale = fixscaleaxis(cubicvr_floatDelimArray(cubicvr_collectTextNode(cl_scale[0]), " "));
      }
      
      return retObj;
  }
  
  

  var cl_lib_scenes = cl.getElementsByTagName("library_visual_scenes");

  var scenesRef = [];

  if (cl_lib_scenes.length) {
    cl_scenes = cl_lib_scenes[0].getElementsByTagName("visual_scene");


    for (sceneCount = 0, sceneMax = cl_scenes.length; sceneCount < sceneMax; sceneCount++) {
      var cl_scene = cl_scenes[sceneCount];

      var sceneId = cl_scene.getAttribute("id");
      var sceneName = cl_scene.getAttribute("name");

      // console.log(sceneId,sceneName);
      var newScene = new CubicVR.scene(sceneName);

      var cl_nodes = cl_scene.getElementsByTagName("node");

      if (cl_nodes.length) {
        for (var nodeCount = 0, nodeMax = cl_nodes.length; nodeCount < nodeMax; nodeCount++) {
          var cl_node = cl_nodes[nodeCount];

          var cl_geom = cl_nodes[nodeCount].getElementsByTagName("instance_geometry");
          var cl_light = cl_nodes[nodeCount].getElementsByTagName("instance_light");
          var cl_camera = cl_nodes[nodeCount].getElementsByTagName("instance_camera");

          var nodeId = cl_node.getAttribute("id");
          var nodeName = cl_node.getAttribute("name");

          var it = cl_getInitalTransform(cl_node);

          if (cl_geom.length) {
            var meshName = cl_geom[0].getAttribute("url").substr(1);

            // console.log(nodeId,nodeName);
            var newSceneObject = new CubicVR.sceneObject(meshes[meshName], nodeName);

            newSceneObject.position = it.position;
            newSceneObject.rotation = it.rotation;
            newSceneObject.scale = it.scale;
            
            newScene.bindSceneObject(newSceneObject);
          }
          
          if (cl_camera.length)
          {
            var cam_instance = cl_camera[0];
            
            var camRefId = cam_instance.getAttribute("url").substr(1);

            newScene.camera = camerasRef[camRefId];
            camerasBoundRef[nodeId] = newScene.camera;
            
            newScene.camera.position = it.position;
            newScene.camera.rotation = cubicvr_vertex_add(it.rotation,[90,0,0]);
            newScene.camera.scale = it.scale;
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

    var sceneUrl = cl_scene[0].getAttribute("url").substr(1);
    
    sceneRef = scenesRef[sceneUrl];
  }



  var cl_lib_anim = cl.getElementsByTagName("library_animations");

  var animRef = [];

  if (cl_lib_anim.length) {
    var cl_anim_sources = cl_lib_anim[0].getElementsByTagName("animation");

    if (cl_anim_sources.length) {
      for (var aCount = 0, aMax = cl_anim_sources.length; aCount < aMax; aCount++) {
        var cl_anim = cl_anim_sources[aCount];

        var animId = cl_anim.getAttribute("id");
        var animName = cl_anim.getAttribute("name");

        animRef[animId] = {};
        animRef[animId].sources = Array();

        var cl_sources = cl_anim.getElementsByTagName("source");

        if (cl_sources.length) {
          for (var sCount = 0, sMax = cl_sources.length; sCount < sMax; sCount++) {
            var cl_source = cl_sources[sCount];

            var sourceId = cl_source.getAttribute("id");

            var name_arrays = cl_source.getElementsByTagName("name_array");
            if (name_arrays.length === 0) { name_arrays = cl_source.getElementsByTagName("Name_array"); }
            var float_arrays = cl_source.getElementsByTagName("float_array");
            var tech_common = cl_source.getElementsByTagName("technique_common");

            var name_array = null;
            var float_array = null;
            var data = null;

            if (name_arrays.length) {
              name_array = cubicvr_textDelimArray(cubicvr_collectTextNode(name_arrays[0]), " ");
            } else if (float_arrays.length) {
              float_array = cubicvr_floatDelimArray(cubicvr_collectTextNode(float_arrays[0]), " ");
            }

            var acCount = 0;
            var acSource = "";
            var acStride = 1;

            if (tech_common.length) {
              var tech = tech_common[0];
              var acc = tech.getElementsByTagName("accessor")[0];

              acCount = parseInt(acc.getAttribute("count"), 10);
              acSource = acc.getAttribute("source").substr(1);
              acStride = parseInt(acc.getAttribute("stride"), 10);
            }

            animRef[animId].sources[sourceId] = {
              data: name_array ? name_array : float_array,
              count: acCount,
              source: acSource,
              stride: acStride
            };

            if (acStride !== 1) {
              animRef[animId].sources[sourceId].data = cubicvr_repackArray(animRef[animId].sources[sourceId].data, acStride, acCount);
            }
          }
        }

        // console.log(animId,animName,cl_anim_sources[aCount]);
        var cl_samplers = cl_anim.getElementsByTagName("sampler");

        if (cl_samplers.length) {
          animRef[animId].samplers = Array();

          for (var sCount = 0, sMax = cl_samplers.length; sCount < sMax; sCount++) {
            cl_sampler = cl_samplers[sCount];

            var samplerId = cl_sampler.getAttribute("id");

            var cl_inputs = cl_sampler.getElementsByTagName("input");

            if (cl_inputs.length) {
              var inputs = [];

              for (var iCount = 0, iMax = cl_inputs.length; iCount < iMax; iCount++) {
                var cl_input = cl_inputs[iCount];

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

          for (var cCount = 0, cMax = cl_channels.length; cCount < cMax; cCount++) {
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


    for (var animId in animRef) {
      if (!animRef.hasOwnProperty(animId)) { continue; }

      var anim = animRef[animId];

      if (anim.channels.length) {
        for (var cCount = 0, cMax = anim.channels.length; cCount < cMax; cCount++) {
          var chan = anim.channels[cCount];
          var sampler = anim.samplers[chan.source];

          var samplerInput = anim.sources[sampler["INPUT"]];
          var samplerOutput = anim.sources[sampler["OUTPUT"]];
          var samplerInterp = anim.sources[sampler["INTERPOLATION"]];

          var mtn = null;
          

          var targetSceneObject = sceneRef.getSceneObject(chan.targetName);
          var targetCamera = camerasBoundRef[chan.targetName];
          

          if (targetSceneObject) {
            if (targetSceneObject.motion === null) {
              targetSceneObject.motion = new CubicVR.motion();
            }
            mtn = targetSceneObject.motion;            
          }
          else if (targetCamera)
          {
            if (targetCamera.motion === null) {
              targetCamera.motion = new CubicVR.motion();
            }
            
            mtn = targetCamera.motion;
          }

          if (mtn === null) continue;

          var controlTarget = MOTION_POS;
          var motionTarget = MOTION_X;

          if (up_axis === 2) mtn.yzflip = true;
            
          switch (chan.paramName) {
          case "rotateX":
            controlTarget = MOTION_ROT;
            motionTarget = MOTION_X;
            break;
          case "rotateY":
            controlTarget = MOTION_ROT;
            motionTarget = MOTION_Y;
            break;
          case "rotateZ":
            controlTarget = MOTION_ROT;
            motionTarget = MOTION_Z;
            break;
          case "translate":
            controlTarget = MOTION_POS;
            break;
          }

          // if (up_axis === 2 && motionTarget == MOTION_Z) motionTarget = MOTION_Y;
          // else if (up_axis === 2 && motionTarget == MOTION_Y) motionTarget = MOTION_Z;
          // 

          for (var mCount = 0, mMax = samplerInput.data.length; mCount < mMax; mCount++) {
            var k = null;

            if (typeof(samplerOutput.data[mCount]) === 'object') {
              for (var i = 0, iMax = samplerOutput.data[mCount].length; i < iMax; i++) {
                var ival = i;

                if (up_axis === 2 && i === 2) ival = 1;
                else if (up_axis === 2 && i === 1) ival = 2;

                k = mtn.setKey(controlTarget, ival, samplerInput.data[mCount], fixukaxis(controlTarget, ival, samplerOutput.data[mCount][i]));

                switch (samplerInterp.data[mCount][i]) {
                case "LINEAR":
                  k.shape = ENV_SHAPE_LINE;
                  break;
                case "BEZIER":
                  k.shape = ENV_SHAPE_BEZI;
                  break;
                }
              }
            } else {
              
              var ival = motionTarget;
              var ofs = 0;

              if (targetCamera)
              {
                // if (up_axis === 2 && i === 2) ival = 1;
                // else if (up_axis === 2 && i === 1) ival = 2;                
                if (up_axis===2 && ival === 0) ofs = -90;
                // if (up_axis===2 && ival === 2) ofs = 180;
              }
              
              k = mtn.setKey(controlTarget, ival, samplerInput.data[mCount], samplerOutput.data[mCount]+ofs);

              switch (samplerInterp.data[mCount]) {
              case "LINEAR":
                k.shape = ENV_SHAPE_LINE;
                break;
              case "BEZIER":
                k.shape = ENV_SHAPE_BEZI;
                break;
              }
            }
          }
        }
      }
    }
  }

  return sceneRef;
};



function cubicvr_GML(srcUrl) {
  this.strokes = Array();
  this.bounds = [1, 1, 1];
  this.origin = [0, 0, 0];
  this.upvector = [0, 1, 0];
  this.viewvector = [0, 0, 1];
  this.manual_pos = 0;

  if (typeof(srcUrl)==='undefined') return;

  var gml = CubicVR.getXML(srcUrl);

  var gml_header = gml.getElementsByTagName("header");

  if (!gml_header.length) return null;

  var header = gml_header[0];

  var gml_environment = gml.getElementsByTagName("environment");


  if (!gml_environment.length) return null;

  this.name = null;

  var gml_name = header.getElementsByTagName("name");

  if (gml_name.length) {
    this.name = cubicvr_collectTextNode(gml_name[0]);
  }

  var gml_screenbounds = gml_environment[0].getElementsByTagName("screenBounds");

  if (gml_screenbounds.length) {
    this.bounds = [
      parseFloat(cubicvr_collectTextNode(gml_screenbounds[0].getElementsByTagName("x")[0])),
      parseFloat(cubicvr_collectTextNode(gml_screenbounds[0].getElementsByTagName("y")[0])),
      parseFloat(cubicvr_collectTextNode(gml_screenbounds[0].getElementsByTagName("z")[0]))
      ];
  }

  var gml_origin = gml_environment[0].getElementsByTagName("origin");

  if (gml_origin.length) {
    this.origin = [
      parseFloat(cubicvr_collectTextNode(gml_origin[0].getElementsByTagName("x")[0])),
      parseFloat(cubicvr_collectTextNode(gml_origin[0].getElementsByTagName("y")[0])),
      parseFloat(cubicvr_collectTextNode(gml_origin[0].getElementsByTagName("z")[0]))
      ];
  }
  
  var gml_upvector = gml_environment[0].getElementsByTagName("up");

  if (gml_upvector.length) {
    this.upvector = [
      parseFloat(cubicvr_collectTextNode(gml_upvector[0].getElementsByTagName("x")[0])),
      parseFloat(cubicvr_collectTextNode(gml_upvector[0].getElementsByTagName("y")[0])),
      parseFloat(cubicvr_collectTextNode(gml_upvector[0].getElementsByTagName("z")[0]))
      ];
  }

  var gml_drawings = gml.getElementsByTagName("drawing");

  var drawings = Array();

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

      var points = Array();

      for (var pCount = 0, pMax = gml_points.length; pCount < pMax; pCount++) {
        var gml_point = gml_points[pCount];

        var px = parseFloat(cubicvr_collectTextNode(gml_point.getElementsByTagName("x")[0]));
        var py = parseFloat(cubicvr_collectTextNode(gml_point.getElementsByTagName("y")[0]));
        var pz = parseFloat(cubicvr_collectTextNode(gml_point.getElementsByTagName("z")[0]));
        var pt = parseFloat(cubicvr_collectTextNode(gml_point.getElementsByTagName("time")[0]));

        if (this.upvector[0] === 1) {
          points.push([(py !== py) ? 0 : py, (px !== px) ? 0 : -px, (pz !== pz) ? 0 : pz, pt]);
        } else if (this.upvector[1] === 1) {
          points.push([(px !== px) ? 0 : px, (py !== py) ? 0 : py, (pz !== pz) ? 0 : pz, pt]);
        } else if (this.upvector[2] === 1) {
          points.push([(px !== px) ? 0 : px, (pz !== pz) ? 0 : -pz, (py !== py) ? 0 : py, pt]);
        }

        if (xm < px) xm = px;
        if (ym < py) ym = py;
        if (zm < pz) zm = pz;
        if (tm < pt) tm = pt;
      }

      if (zm > tm) // fix swapped Z/Time
      {
        for (var i = 0, iMax = points.length; i < iMax; i++) {
          var t = points[i][3];
          points[i][3] = points[i][2];
          points[i][2] = t/this.bounds[2];
        }
      }

      this.strokes.push(points);
    }
  }
};



cubicvr_GML.prototype.addStroke = function(points,tstep) 
{
  var pts = Array();

  if (typeof(tstep)==='undefined')
  {
    tstep = 0.1;
  }

  for (var i = 0, iMax = points.length; i < iMax; i++)
  {
    var ta = [points[i][0],points[i][1],points[i][2]];
    this.manual_pos += tstep;
    ta.push(this.manual_pos);
    pts.push(ta);
  }
  
  this.strokes.push(pts);   
}


cubicvr_GML.prototype.recenter = function() {
  var min = [0, 0, 0];
  var max = [this.strokes[0][0][0], this.strokes[0][0][1], this.strokes[0][0][2]];

  for (var s = 0, sMax = this.strokes.length; s < sMax; s++) {
    for (var i = 0, iMax = this.strokes[s].length; i < iMax; i++) {
      if (min[0] > this.strokes[s][i][0]) min[0] = this.strokes[s][i][0];
      if (min[1] > this.strokes[s][i][1]) min[1] = this.strokes[s][i][1];
      if (min[2] > this.strokes[s][i][2]) min[2] = this.strokes[s][i][2];

      if (max[0] < this.strokes[s][i][0]) max[0] = this.strokes[s][i][0];
      if (max[1] < this.strokes[s][i][1]) max[1] = this.strokes[s][i][1];
      if (max[2] < this.strokes[s][i][2]) max[2] = this.strokes[s][i][2];
    }
  }

  var center = cubicvr_vertex_mul_const(cubicvr_vertex_sub(max, min), 0.5);

  for (var s = 0, sMax = this.strokes.length; s < sMax; s++) {
    for (var i = 0, iMax = this.strokes[s].length; i < iMax; i++) {
      this.strokes[s][i][0] = this.strokes[s][i][0] - center[0];
      this.strokes[s][i][1] = this.strokes[s][i][1] - (this.upvector[1] ? center[1] : (-center[1]));
      this.strokes[s][i][2] = this.strokes[s][i][2] - center[2];
    }
  }
};

cubicvr_GML.prototype.generateObject = function(seg_mod, extrude_depth) {
  if (typeof(seg_mod) === 'undefined') seg_mod = 0;
  if (typeof(extrude_depth) === 'undefined') extrude_depth = 0;

  // temporary defaults
  var divs = 6;
  var divsper = 0.02;
  var pwidth = 0.015;
  var extrude = extrude_depth !== 0;

  var segCount = 0;
  var faceSegment = 0;

  var obj = new cubicvr_object(this.name);

  for (var sCount = 0, sMax = this.strokes.length; sCount < sMax; sCount++) {
    var strokeEnvX = new cubicvr_envelope();
    var strokeEnvY = new cubicvr_envelope();
    var strokeEnvZ = new cubicvr_envelope();

    var pMax = this.strokes[sCount].length;

    var lx, ly, lz, lt;
    var d = 0;
    var len_set = Array();
    var time_set = Array();
    var start_time = 0;

    for (var pCount = 0; pCount < pMax; pCount++) {
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

    for (var pCount = 0; pCount < len_set.length; pCount++) {
      var segLen = len_set[pCount];
      var segTime = time_set[pCount];
      var segNum = Math.ceil((segLen / divsper) * divs);

      var lx, ly, lz;

      for (var t = dpos, tMax = dpos + segTime, tInc = (segTime / segNum); t < (tMax - tInc); t += tInc) {
        if (t == dpos) {
          lx = strokeEnvX.evaluate(t);
          ly = strokeEnvY.evaluate(t);
          lz = strokeEnvZ.evaluate(t);
        }

        var px, py;

        px = strokeEnvX.evaluate(t + tInc);
        py = strokeEnvY.evaluate(t + tInc);
        pz = strokeEnvZ.evaluate(t + tInc);

        var pdx = (px - lx),
          pdy = py - ly,
          pdz = pz - lz;
        var pd = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
        var a;

        a = cubicvr_vertex_mul_const(
        cubicvr_normalize(
        cubicvr_crossProduct(this.viewvector, cubicvr_normalize([pdx, pdy, pdz]))), pwidth / 2.0);

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
      for (var i = ptofs, iMax = ptlen; i < iMax; i++) {
        obj.addPoint([obj.points[i][0], obj.points[i][1], obj.points[i][2] - (extrude ? (extrude_depth / 2.0) : 0)])
      }
    }

    for (var i = 0, iMax = ptlen - ptofs; i <= iMax - 4; i += 2) {
      if (segCount % seg_mod === 0) {
        faceSegment++;
      }

      obj.setSegment(faceSegment);

      var arFace = [ptofs + i, ptofs + i + 1, ptofs + i + 3, ptofs + i + 2];
      var ftest = cubicvr_dp(this.viewvector, cubicvr_calcNormal(arFace[0], arFace[1], arFace[2]));

      var faceNum = obj.addFace(arFace);
      if (ftest < 0) { this.faces[faceNum].flip(); }

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
        if (i == iMax - 4) {
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

var cubicvr_particle = function(pos,start_time,life_time,velocity,accel)
{
  this.startpos = new Float32Array(pos);
  this.pos = new Float32Array(pos);
  this.velocity = new Float32Array((typeof(velocity)!=='undefined')?velocity:[0,0,0]);
  this.accel = new Float32Array((typeof(accel)!=='undefined')?accel:[0,0,0]);
  this.start_time = (typeof(start_time)!=='undefined')?start_time:0;
  this.life_time = (typeof(life_time)!=='undefined')?life_time:0;
  this.color = null;
  this.nextParticle = null;
  this.alive = false;
}

var cubicvr_particleBucket = function(max_particles)
{
  this.max_particles = max_particles;
  this.num_particles = 0;
  this.dead_particles = 0;
  this.particles = [];
} //cubicvr_particleBucket::Constructor

cubicvr_particleBucket.prototype.addParticle = function(p)
{
  this.particles[this.num_particles] = p;
  ++this.num_particles;
} //cubicvr_particleBucket::addParticle

var cubicvr_particleSystem = function(maxPts,hasColor,pTex,vWidth,vHeight,alpha,alphaCut)
{
  var gl = CubicVR_GLCore.gl;
  
  if (!maxPts) return;
  
  this.emitters = [];
  this.particles = null;        
  this.last_particle = null;
  this.pTex = (typeof(pTex)!=='undefined')?pTex:null;
  this.vWidth = vWidth;
  this.vHeight = vHeight;
  this.alpha = (typeof(alpha)!=='undefined')?alpha:false;
  this.alphaCut = (typeof(alphaCut)!=='undefined')?alphaCut:0;
  
  this.pfunc = function(p,time)
  {
    var tdelta = time-p.start_time;

    if (tdelta < 0) return 0;
    if (tdelta > p.life_time && p.life_time)
    {
      return -1;
    }
    
    p.pos[0] = p.startpos[0] + (tdelta*p.velocity[0]) + (tdelta*tdelta*p.accel[0]);
    p.pos[1] = p.startpos[1] + (tdelta*p.velocity[1]) + (tdelta*tdelta*p.accel[1]);
    p.pos[2] = p.startpos[2] + (tdelta*p.velocity[2]) + (tdelta*tdelta*p.accel[2]);    
    
    if (this.pgov !== null)
    {
      this.pgov(p,time);
    }
    
    return 1;
  };

  this.pgov = null;

  if (typeof(hasColor)==='undefined')
  {
    this.hasColor = false;
  }
  else
  {
    this.hasColor = hasColor;
  }

  gl.enable(gl.VERTEX_PROGRAM_POINT_SIZE);

  var hasTex = (this.pTex!==null);

  this.vs = [
  "#ifdef GL_ES",
  "precision highp float;",
  "#endif",
  "attribute vec3 aVertexPosition;",
  this.hasColor?"attribute vec3 aColor;":"",
  "uniform mat4 uMVMatrix;",
  "uniform mat4 uPMatrix;",
  "varying vec4 color;",
  "varying vec2 screenPos;",
  hasTex?"varying float pSize;":"",
  "void main(void) {",
    "vec4 position = uPMatrix * uMVMatrix * vec4(aVertexPosition,1.0);",
    hasTex?"screenPos=vec2(position.x/position.w,position.y/position.w);":"",
    "gl_Position = position;",
    this.hasColor?"color = vec4(aColor.r,aColor.g,aColor.b,1.0);":"color = vec4(1.0,1.0,1.0,1.0);",
    hasTex?"pSize=200.0/position.z;":"float pSize=200.0/position.z;",
    "gl_PointSize = pSize;",
  "}"].join("\n");

  this.fs = [
  "#ifdef GL_ES",
  "precision highp float;",
  "#endif",

  hasTex?"uniform sampler2D pMap;":"",


  "varying vec4 color;",
  hasTex?"varying vec2 screenPos;":"",
  hasTex?"uniform vec3 screenDim;":"",
  hasTex?"varying float pSize;":"",

  "void main(void) {",
    "vec4 c = color;",
    hasTex?"vec2 screen=vec2((gl_FragCoord.x/screenDim.x-0.5)*2.0,(gl_FragCoord.y/screenDim.y-0.5)*2.0);":"",
    hasTex?"vec2 pointCoord=vec2( ((screen.x-screenPos.x)/(pSize/screenDim.x))/2.0+0.5,((screen.y-screenPos.y)/(pSize/screenDim.y))/2.0+0.5);":"",
    hasTex?"vec4 tc = texture2D(pMap,pointCoord); gl_FragColor = vec4(c.rgb*tc.rgb,1.0);":"gl_FragColor = c;",
  "}"].join("\n");

  this.maxPoints = maxPts;
  this.numParticles = 0;
  this.arPoints = new Float32Array(maxPts*3);
  this.glPoints = null;
  
  if (hasColor)
  {
    this.arColor = new Float32Array(maxPts*3);
    this.glColor = null;
  }

  this.shader_particle = new CubicVR.shader(this.vs,this.fs);
	this.shader_particle.use();
	this.shader_particle.addVertexArray("aVertexPosition");
	
	if (this.hasColor) this.shader_particle.addVertexArray("aColor");
	
	this.shader_particle.addMatrix("uMVMatrix");
  this.shader_particle.addMatrix("uPMatrix"); 
  
  if (this.pTex != null) {
    this.shader_particle.addInt("pMap",0);
    this.shader_particle.addVector("screenDim");
    this.shader_particle.setVector("screenDim",[vWidth,vHeight,0]);  
  }
  
  this.genBuffer();
}

particle_emitter_uuid = 0;
cubicvr_particleEmitter = function(params)
{
  this.id = particle_emitter_uuid;
  ++particle_emitter_uuid;

  this.particle_system = null;
  this.name = null;
  this.life = 0;
  this.type = PARTICLE_EMITTER_TYPE_DETERMINISTIC;
  this.position = [0,0,0];
  this.bucket_size = PARTICLE_BUCKET_SIZE;
  this.max_particles = PARTICLE_EMITTER_MAX_PARTICLES;
  this.max_visible_particles = PARTICLE_EMITTER_MAX_PARTICLES;
  this.alpha = false;
  this.stop_request = false;

  this.p_life = 0;
  this.p_life_variance = 0;
  this.emission_rate = 0;
  this.emission_size = 0;
  this.p_base_velocity = [0,0,0];
  this.p_velocity_variance = [0,0,0];
  this.p_base_accel = [0,0,0];
  this.p_accel_variance = [0,0,0];
  this.p_position_variance = [0,0,0];
  this.p_base_color = [0,0,0];
  this.p_color_variance = [0,0,0];
  this.p_color_velocity = [0,0,0];
  this.p_texture = null;

  var read_params = [ 'name',
                      'life', 
                      'type', 
                      'position',
                      'bucket_size', 
                      'max_particles',
                      'max_visible_particles',
                      'alpha',
                      'emission_rate',
                      'emission_size',
                      'p_position_variance', 
                      'p_life', 
                      'p_life_variance', 
                      'p_base_velocity', 
                      'p_base_accel', 
                      'p_velocity_variance', 
                      'p_accel_variance', 
                      'p_base_color', 
                      'p_color_variance', 
                      'p_color_velocity',
                      'p_texture'
                    ];

  for (var i in read_params) {
    var p = read_params[i];
    if (params[p] !== undefined) this[p] = params[p];
  } //for

  this.has_colour = params['p_base_color'] !== undefined;

  this.p_func = null;
  this.p_gov = null;

  this.last_time = 0;
  this.buckets = [];
  this.current_bucket = null;

  switch(this.type)
  {
    case PARTICLE_EMITTER_TYPE_DETERMINISTIC:
      this.p_func = function(p, time){
        var tdelta = time-p.start_time;

        if (tdelta < 0) return 0;
        if (tdelta > p.life_time && p.life_time) return -1;
    
        p.pos[0] = p.startpos[0] + (tdelta*p.velocity[0]) + (tdelta*tdelta*p.accel[0]);
        p.pos[1] = p.startpos[1] + (tdelta*p.velocity[1]) + (tdelta*tdelta*p.accel[1]);
        p.pos[2] = p.startpos[2] + (tdelta*p.velocity[2]) + (tdelta*tdelta*p.accel[2]);    
    
        if (this.p_gov !== null) this.p_gov(p, time);
    
        return 1;

      }; //update_function
      break;

    default:
    case PARTICLE_EMITTER_TYPE_NONDETERMINISTIC:
      this.p_func = function(){
      }; //update_function
      break;

  } //switch

  var gl = CubicVR_GLCore.gl;

  this.glPoints = gl.createBuffer();
  this.arPoints = new Float32Array(this.max_particles*3);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
  gl.bufferData(gl.ARRAY_BUFFER, this.arPoints, gl.DYNAMIC_DRAW);

  if (this.has_colour) {
    this.arColor = new Float32Array(this.max_particles*3);
    this.glColor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
    gl.bufferData(gl.ARRAY_BUFFER, this.arColor, gl.DYNAMIC_DRAW);
  } //if

} //cubicvr_particleEmitter::Constructor

cubicvr_particleEmitter.prototype.createParticle = function(time)
{
  var pos = [ this.position[2] + (Math.random()-0.5)*this.p_position_variance[2]*2,
              this.position[1] + (Math.random()-0.5)*this.p_position_variance[1]*2,
              this.position[0] + (Math.random()-0.5)*this.p_position_variance[0]*2
                ];
  var start = time;
  var life = this.p_life + this.p_life_variance*Math.random();
  var v = [ this.p_base_velocity[0] + (Math.random()-0.5)*this.p_velocity_variance[0]*2,
            this.p_base_velocity[1] + (Math.random()-0.5)*this.p_velocity_variance[1]*2,
            this.p_base_velocity[2] + (Math.random()-0.5)*this.p_velocity_variance[2]*2
                ];
      var a = [ this.p_base_accel[0] + (Math.random()-0.5)*this.p_accel_variance[0]*2,
                this.p_base_accel[1] + (Math.random()-0.5)*this.p_accel_variance[1]*2,
                this.p_base_accel[2] + (Math.random()-0.5)*this.p_accel_variance[2]*2
                ];

  var p = new cubicvr_particle(pos, start, life, v, a);

  if (this.p_base_color) {
    var r = this.p_base_color[0] + (Math.random()-0.5)*this.p_color_variance[0];
    if (r<0) r = 0;
    if (r>1) r = 1;
    var g = this.p_base_color[1] + (Math.random()-0.5)*this.p_color_variance[1];
    if (g<0) r = 0;
    if (g>1) r = 1;
    var b = this.p_base_color[2] + (Math.random()-0.5)*this.p_color_variance[2];
    if (b<0) r = 0;
    if (b>1) r = 1;
    p.color = new Float32Array(3);
    p.color[0] = r;
    p.color[1] = g;
    p.color[2] = b;
  } //if

  //console.log("creating particle", pos, start, life, v, a, p.color[0]);
  return p;

} //cubicvr_particleEmitter::createParticle

cubicvr_particleEmitter.prototype.update = function(time)
{
  var new_buckets = [];
  for (var bi=0, maxBI=this.buckets.length; bi<maxBI; ++bi) {
    var bucket = this.buckets[bi];
    var bucket_size = 0;
    for (var pi=0, maxPI=bucket.particles.length; pi<maxPI; ++pi) {
      var p = bucket.particles[pi];
      var pf = this.p_func(p, time);
      if (pf === -1) {
        p.alive = false;
      }
      else {
        ++bucket_size;
      } //if
    } //for pi
    if (bucket_size > 0) new_buckets.push(bucket);
  } //for bi
  this.buckets = new_buckets;
  if (this.buckets.length > 0) {
    this.current_bucket = this.buckets[this.buckets.length-1];
  } //if

  if (!this.stop_request && time > this.last_time + this.emission_rate) {
    var num_new_particles = this.emission_size;
    for (var i = 0; i < num_new_particles; ++i) {
      var p = this.createParticle(time);
      p.alive = true;
      this.addParticle(p);
    } //for
    this.last_time = time;
  } //if

} //cubicvr_particleEmitter::update

cubicvr_particleEmitter.prototype.draw = function(modelViewMat, projectionMat, time)
{
  var gl = CubicVR_GLCore.gl;
  this.shader_particle.init(true);
  this.shader_particle.use();
  if (this.p_texture !== null) this.p_texture.use(gl.TEXTURE0);
  this.shader_particle.setMatrix("uMVMatrix", modelViewMat);
  this.shader_particle.setMatrix("uPMatrix", projectionMat);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
  gl.vertexAttribPointer(this.shader_particle.uniforms["aVertexPosition"], 3, gl.FLOAT, false, 0, 0);
  if (this.has_colour) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
    gl.vertexAttribPointer(this.shader_particle.uniforms["aColor"], 3, gl.FLOAT, false, 0, 0);
  } //if
  if (time === undefined) time = 0;

  var ofs = 0;
  var num_particles = 0;
  for (var bi=0, maxBI=this.buckets.length; bi<maxBI; ++bi) {
    var bucket = this.buckets[bi];
    for (var pi=0, maxPI=bucket.particles.length; pi<maxPI; ++pi) {
      var p = bucket.particles[pi];
      if (p.alive) {
        this.arPoints[ofs] = p.pos[0];
        this.arPoints[ofs+1] = p.pos[1];
        this.arPoints[ofs+2] = p.pos[2];

        if (p.color !== null) {
          this.arColor[ofs] = p.color[0];
          this.arColor[ofs+1] = p.color[1];
          this.arColor[ofs+2] = p.color[2];
        } //if

        ++num_particles;
        ofs += 3;
        if (num_particles === this.max_visible_particles) break;
      } //if
    } //for pi
    if (num_particles === this.max_visible_particles) break;
  } //for bi

  // prepare vertex buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
  gl.bufferData(gl.ARRAY_BUFFER, this.arPoints, gl.DYNAMIC_DRAW);        

  // prepare colour buffer
  if (this.has_colour) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
    gl.bufferData(gl.ARRAY_BUFFER, this.arColor, gl.DYNAMIC_DRAW);
  } //if

  // draw!
  if (this.alpha) {
    gl.enable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(0);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
  } //if

  gl.drawArrays(gl.POINTS, 0, num_particles);

  if (this.alpha) {
    gl.disable(gl.BLEND);
    gl.depthMask(1);
    gl.blendFunc(gl.ONE, gl.ONE);
  } //if

  //console.log("drew", num_particles, "particles", ofs);

} //cubicvr_particleEmitter.prototype.draw

cubicvr_particleEmitter.prototype.setupShader = function(vs, fs, vWidth, vHeight)
{
  this.shader_particle = new CubicVR.shader(vs, fs);
  this.shader_particle.use();
  this.shader_particle.addVertexArray("aVertexPosition");
  if(this.has_colour) this.shader_particle.addVertexArray("aColor");
  this.shader_particle.addMatrix("uMVMatrix");
  this.shader_particle.addMatrix("uPMatrix");

  if (this.p_texture !== null) {
    this.shader_particle.addInt("pMap", 0);
    this.shader_particle.addVector("screenDim");
    this.shader_particle.setVector("screenDim", [vWidth, vHeight, 0]);
  } //if

} //cubicvr_particleEmitter::setupShader

cubicvr_particleEmitter.prototype.addParticle = function(p)
{
  if (this.current_bucket === null || this.current_bucket.num_particles === this.current_bucket.max_particles) {
    this.current_bucket = new cubicvr_particleBucket(this.bucket_size);
    this.buckets.push(this.current_bucket);
  } //if
  this.current_bucket.addParticle(p);
} //cubicvr_particleEmitter::addParticle

cubicvr_particleSystem.prototype.addEmitter = function(emitter)
{
  this.emitters.push(emitter);
  emitter.particle_system = this;
  emitter.setupShader(this.vs, this.fs, this.vWidth, this.vHeight);
} //cubicvr_particleSystem::addEmitter

cubicvr_particleSystem.prototype.removeEmitter = function(e)
{
  for (var i = 0; i < this.emitters.length; ++i)
    if (this.emitters[i] === e) this.emitters[i].stop_request = true;
} //cubicvr_particleSystem::removeEmitter

cubicvr_particleSystem.prototype.removeEmitterByName = function(n)
{
  for (var i = 0; i < this.emitters.length; ++i)
    if (this.emitters[i].name == n) this.emitters[i].stop_request = true;
} //cubicvr_particleSystem::removeEmitterByName

cubicvr_particleSystem.prototype.removeEmitterByID = function(id)
{
  for (var i = 0; i < this.emitters.length; ++i)
    if (this.emitters[i].id == id) this.emitters[i].stop_request = true;
} //cubicvr_particleSystem::removeEmitterByID

cubicvr_particleSystem.prototype.update = function(time)
{
  var new_emitters = [];
  for (var i = 0, l = this.emitters.length; i < l; ++i) {
    var e = this.emitters[i];
    e.update(time);
    if (e.stop_request === true) {
      if (e.buckets.length > 0) {
        new_emitters.push(e);
      } //if
    }
    else {
      new_emitters.push(e);
    } //if
  } //for
  this.emitters = new_emitters;
} //cubicvr_particleSystem::update

cubicvr_particleSystem.prototype.resizeView = function(vWidth,vHeight)
{
  this.vWidth = vWidth;
  this.vHeight = vHeight;

  if (this.pTex != null) {
    this.shader_particle.addVector("screenDim");
    this.shader_particle.setVector("screenDim",[vWidth,vHeight,0]);    
  }
}

cubicvr_particleSystem.prototype.addParticle = function(p)
{
  if (this.last_particle==null)
  {
    this.particles = p;
    this.last_particle = p;
  }
  else
  {
    this.last_particle.nextParticle = p;
    this.last_particle = p;
  }
}

cubicvr_particleSystem.prototype.genBuffer = function()
{
  var gl = CubicVR_GLCore.gl;

  this.glPoints = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
  gl.bufferData(gl.ARRAY_BUFFER, this.arPoints, gl.DYNAMIC_DRAW);

  if (this.hasColor)
  {
    this.glColor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
    gl.bufferData(gl.ARRAY_BUFFER, this.arColor, gl.DYNAMIC_DRAW);
  }
}

cubicvr_particleSystem.prototype.updatePoints = function()
{
  var gl = CubicVR_GLCore.gl;

  // buffer update
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
  gl.bufferData(gl.ARRAY_BUFFER, this.arPoints, gl.DYNAMIC_DRAW);        
  // end buffer update
}

cubicvr_particleSystem.prototype.updateColors = function()
{
  var gl = CubicVR_GLCore.gl;

  if (!this.hasColor) return;
  // buffer update
  gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
  gl.bufferData(gl.ARRAY_BUFFER, this.arColor, gl.DYNAMIC_DRAW);        
  // end buffer update
}

cubicvr_particleSystem.prototype.draw = function(modelViewMat,projectionMat,time)
{
  for (var i = 0, l = this.emitters.length; i < l; ++i)
    this.emitters[i].draw(modelViewMat, projectionMat, time);

  var gl = CubicVR_GLCore.gl;

  this.shader_particle.init(true);
  this.shader_particle.use();

  if (this.pTex !== null) this.pTex.use(gl.TEXTURE0);

  this.shader_particle.setMatrix("uMVMatrix", modelViewMat);
  this.shader_particle.setMatrix("uPMatrix", projectionMat);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.glPoints);
  gl.vertexAttribPointer(this.shader_particle.uniforms["aVertexPosition"], 3, gl.FLOAT, false, 0, 0);

  if (this.hasColor) 
  {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glColor);
    gl.vertexAttribPointer(this.shader_particle.uniforms["aColor"], 3, gl.FLOAT, false, 0, 0);
  }
  
  if (typeof(time)==='undefined') time=0;

  if (this.particles == null) return;
  
  var p = this.particles;
  var lp = null;
  
  this.numParticles = 0;

  var c = 0;

  while (p!==null)
  {
    var ofs = this.numParticles*3;
    var pf = this.pfunc(p,time);
    
    if (pf===1)
    {
      this.arPoints[ofs] = p.pos[0];
      this.arPoints[ofs+1] = p.pos[1];
      this.arPoints[ofs+2] = p.pos[2];

      if (p.color !== null)
      {
        this.arColor[ofs] = p.color[0];
        this.arColor[ofs+1] = p.color[1];
        this.arColor[ofs+2] = p.color[2];
      }

      this.numParticles++;
      c++;
      if (this.numParticles===this.maxPoints) break;
    }
    else if (pf === -1) // particle death
    {
      if (lp !== null) lp.nextParticle = p.nextParticle;
    }
    else if (pf == 0)
    {
      c++;      
    }

    lp = p;
    p = p.nextParticle;   
  } //while

  if (!c) { this.particles = null; this.last_particle = null; }
    
  this.updatePoints();
  if (this.hasColor) this.updateColors();

  if (this.alpha)
  {
    gl.enable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(0);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
  }

  gl.drawArrays(gl.POINTS, 0, this.numParticles);

  if (this.alpha)
  {
    // gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.depthMask(1);
    gl.blendFunc(gl.ONE, gl.ONE);
  }
}

/* SkyBox */
cubicvr_skyBox = function(input_texture) {
  var texture = input_texture;

  if (typeof(texture) == "string") {
    texture = new cubicvr_texture(input_texture);
  } //if
  mat = new cubicvr_material("skybox");
  obj = new cubicvr_object();
  cubicvr_boxObject(obj, 1, mat);
  obj.calcNormals();

  var w = CubicVR_Images[texture.tex_id].width;
  var h = CubicVR_Images[texture.tex_id].height;
  var quad = [w / 4, h / 3];
  mat_map = new cubicvr_uvmapper();
  mat_map.projection_mode = UV_PROJECTION_SKY;
  mat_map.scale = [1, 1, 1];
  mat_map.apply(obj, mat);

  obj.triangulateQuads();
  obj.compile();

  mat.setTexture(texture);

  this.scene_object = new cubicvr_sceneObject(obj);

} //cubicvr_SkyBox::Constructor
var CubicVR = {
  core: CubicVR_GLCore,
  getXML: cubicvr_getXML,
  transform: cubicvr_transform,
  object: cubicvr_object,
  face: cubicvr_face,
  material: cubicvr_material,
  texture: cubicvr_texture,
  uvmapper: cubicvr_uvmapper,
  xyz: cubicvr_xyz,
  rgb: cubicvr_rgb,
  rgba: cubicvr_rgba,
  shader: cubicvr_shader,
  perspective: cubicvr_perspective,
  lookat: cubicvr_lookat,
  genBoxObject: cubicvr_boxObject,
  genLatheObject: cubicvr_latheObject,
  renderObject: cubicvr_renderObject,
  moveViewRelative: cubicvr_moveViewRelative,
  trackTarget: cubicvr_trackTarget,
  landscape: cubicvr_landscape,
  camera: cubicvr_camera,
  scene: cubicvr_scene,
  sceneObject: cubicvr_sceneObject,
  newTransform: function() {
    return new cubicvr_transform();
  },
  globalAmbient: [0.1, 0.1, 0.1],
  setGlobalAmbient: function(c) {
    CubicVR.globalAmbient = c;
  },
  loadMesh: cubicvr_loadMesh,
  envelope: cubicvr_envelope,
  motion: cubicvr_motion,
  renderBuffer: cubicvr_renderBuffer,
  postProcessFX: cubicvr_postProcessFX,
  loadCollada: cubicvr_loadCollada,
  GML: cubicvr_GML,
  skyBox: cubicvr_skyBox
};

CubicVR_Materials.push(new cubicvr_material("(null)"));


/****************************************************************
 * OcTree & Frustum Culling - Bobby Richter: cyberhive.ca
 ****************************************************************/

/***********************************************
 * Vector3
 ***********************************************/
Vector3_dot = function(u, v) {
  return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
} //Vector3::dot
Vector3_add = function(u, v) {
  return [u[0] + v[0], u[1] + v[1], u[2] + v[2]];
} //Vector3::add
Vector3_subtract = function(u, v) {
  return [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
} //Vector3::subtract
Vector3_multiply = function(u, v) {
  return [u[0] * v, u[1] * v, u[2] * v];
} //Vector3::multiply
Vector3_magnitude = function(u) {
  return Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
} //Vector3::magnitude
/***********************************************
 * AABB
 ***********************************************/
AABB_engulf = function(aabb, point) {
  if (aabb[0][0] > point[0]) aabb[0][0] = point[0];
  if (aabb[0][1] > point[1]) aabb[0][1] = point[1];
  if (aabb[0][2] > point[2]) aabb[0][2] = point[2];
  if (aabb[1][0] < point[0]) aabb[1][0] = point[0];
  if (aabb[1][1] < point[1]) aabb[1][1] = point[1];
  if (aabb[1][2] < point[2]) aabb[1][2] = point[2];
} //AABB::engulf
/***********************************************
 * Plane
 ***********************************************/
Plane = function() {
  this.a = 0;
  this.b = 0;
  this.c = 0;
  this.d = 0;
} //Plane::Constructor
Plane.prototype.classify_point = function(pt) {
  var dist = (this.a * pt[0]) + (this.b * pt[1]) + (this.c * pt[2]) + (this.d);
  if (dist < 0) return -1;
  if (dist > 0) return 1;
  return 0;
} //Plane::classify_point

Plane.prototype.normalize = function() {
  var mag = Math.sqrt(this.a * this.a + this.b * this.b + this.c * this.c);
  this.a = this.a / mag;
  this.b = this.b / mag;
  this.c = this.c / mag;
  this.d = this.d / mag;
} //Plane::normalize
Plane.prototype.toString = function() {
  return "[Plane " + this.a + ", " + this.b + ", " + this.c + ", " + this.d + "]";
} //Plane::toString
/***********************************************
 * Sphere
 ***********************************************/
Sphere = function(position, radius) {
  this.position = position;
  if (this.position === undefined)
    this.position = [0, 0, 0];
  this.radius = radius;
} //Sphere::Constructor
Sphere.prototype.intersects = function(other_sphere) {
  var diff = Vector3_subtract(this.position, other_sphere.position);
  var mag = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]);
  var sum_radii = this.radius + other_sphere.radius;
  if (mag * mag < sum_radii * sum_radii) return true;
  return false;
} //Sphere::intersects
/***********************************************
 * OcTree
 ***********************************************/
var TOP_NW = 0;
var TOP_NE = 1;
var TOP_SE = 2;
var TOP_SW = 3;
var BOTTOM_NW = 4;
var BOTTOM_NE = 5;
var BOTTOM_SE = 6;
var BOTTOM_SW = 7;

function OcTreeWorkerProxy(worker, camera, octree, scene)
{
  this.worker = worker;
  this.scene = scene;
  this.worker.send({type:"init", data:{size: octree._size, max_depth:octree._max_depth}});
  this.worker.send({type:"set_camera", data:camera});

  var that = this;

  this._last_on = [];

  this.onmessage = function(e)
  {
    switch(e.data.type)
    {
      case "log":
        console.log(e.data.data);
        break;

      case "get_frustum_hits":
        var i,l;
        var hits = e.data.data;

        if (that._last_on !== undefined) {
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

      default: break;
    } //switch
  } //onmessage
  this.worker.message_function = this.onmessage;

  this.toString = function()
  {
    return "[OcTreeWorkerProxy]";
  } //toString

  this.insert = function(node)
  {
    var s = JSON.stringify(node);
    that.worker.send({type:"insert", data:s});
  } //insert

  this.cleanup = function()
  {
    that.worker.send({type:"cleanup", data:null});
  } //cleanup

  this.draw_on_map = function()
  {
    return;
  } //draw_on_map

  this.reset_node_visibility = function()
  {
    return;
  } //reset_node_visibility

  this.get_frustum_hits = function()
  {
    for (var i = 0, l = that._last_on.length; i < l; ++i) {
      that._last_on[i].drawn_this_frame = false;
    } //for
    return that._last_on;
  } //get_frustum_hits

} //OcTreeWorkerProxy

OcTree = function(size, max_depth, root, position, child_index) {
  this._children = [];
  for (var i = 0; i < 8; ++i)
  this._children[i] = null;

  if (child_index === undefined) this._child_index = -1;
  else this._child_index = child_index;

  if (size === undefined) this._size = 0;
  else this._size = size;

  if (max_depth === undefined) this._max_depth = 0;
  else this._max_depth = max_depth;

  if (root === undefined) this._root = null;
  else this._root = root;

  if (position === undefined) { this._position = [0, 0, 0]; }
  else this._position = position;

  this._nodes = [];

  this._sphere = new Sphere(this._position, Math.sqrt(3 * (this._size / 2 * this._size / 2)));
  this._bbox = [[0,0,0],[0,0,0]];

  var s = this._size * .5;
  AABB_engulf(this._bbox, [this._position[0] + s, this._position[1] + s, this._position[2] + s]);
  AABB_engulf(this._bbox, [this._position[0] - s, this._position[1] - s, this._position[2] - s]);

  //console.log(this._bbox);
  this._debug_visible = false;
} //OcTree::Constructor

OcTree.prototype.toString = function() {
  return "[OcTree: @" + this._position + ", depth: " + this._max_depth + ", size: " + this._size + ", nodes: " + this._nodes.length + "]";
} //OcTree::toString

OcTree.prototype.remove = function(node) {
  var len = this._nodes.length;
  var nodes = [];
  for (var i = 0; i < len; ++i) {
    var n = this._nodes[i];
    if (node !== n) nodes.push(n);
  } //for

  this._nodes = nodes;

} //remove

OcTree.prototype.cleanup = function()
{
  var num_children = this._children.length;
  var num_keep_children = 0;
  for (var i = 0; i < num_children; ++i) {
    if (this._children[i] !== null) {
      var keep = this._children[i].cleanup();

      if (!keep) this._children[i] = null;
      else ++num_keep_children;
    } //if
  } //for

  if ((this._nodes.length === 0) && (num_keep_children === 0 || num_children === 0)) return false;
  return true;
} //cleanup

OcTree.prototype.insert = function(node)
{
  if (this._root === null) {
    node.octree_leaves = [];
    node.octree_common_root = null;
  } //if

  if (this._max_depth == 0) {
    AABB_engulf(node.octree_aabb, this._bbox[0]);
    AABB_engulf(node.octree_aabb, this._bbox[1]);
    this._nodes.push(node);
    node.octree_leaves.push(this);
    node.octree_common_root = this._root;
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
    this._nodes.push(node);
    node.octree_leaves.push(this);
    node.octree_common_root = this;
    AABB_engulf(node.octree_aabb, this._bbox[0]);
    AABB_engulf(node.octree_aabb, this._bbox[1]);
  } else {
    var new_size = this._size / 2;
    var offset = this._size / 4;

    var num_inserted = 0;
    //Arduously create & check children to see if node fits there too
    var x = this._position[0];
    var y = this._position[1];
    var z = this._position[2];
    if (t_nw) {
      new_position = [x-offset, y-offset, z-offset];
      if (this._children[TOP_NW] === null) { this._children[TOP_NW] = new OcTree(new_size, this._max_depth - 1, this, new_position, TOP_NW); }
      this._children[TOP_NW].insert(node);
      ++num_inserted;
    } //if
    if (t_ne) {
      new_position = [x+offset, y-offset, z-offset];
      if (this._children[TOP_NE] === null) { this._children[TOP_NE] = new OcTree(new_size, this._max_depth - 1, this, new_position, TOP_NE); }
      this._children[TOP_NE].insert(node);
      ++num_inserted;
    } //if
    if (b_nw) {
      new_position = [x-offset, y+offset, z-offset];
      if (this._children[BOTTOM_NW] === null) { this._children[BOTTOM_NW] = new OcTree(new_size, this._max_depth - 1, this, new_position, BOTTOM_NW); }
      this._children[BOTTOM_NW].insert(node);
      ++num_inserted;
    } //if
    if (b_ne) {
      new_position = [x+offset, y+offset, z-offset];
      if (this._children[BOTTOM_NE] === null) { this._children[BOTTOM_NE] = new OcTree(new_size, this._max_depth - 1, this, new_position, BOTTOM_NE); }
      this._children[BOTTOM_NE].insert(node);
      ++num_inserted;
    } //if
    if (t_sw) {
      new_position = [x-offset, y-offset, z+offset];
      if (this._children[TOP_SW] === null) { this._children[TOP_SW] = new OcTree(new_size, this._max_depth - 1, this, new_position, TOP_SW); }
      this._children[TOP_SW].insert(node);
      ++num_inserted;
    } //if
    if (t_se) {
      new_position = [x+offset, y-offset, z+offset];
      if (this._children[TOP_SE] === null) { this._children[TOP_SE] = new OcTree(new_size, this._max_depth - 1, this, new_position, TOP_SE); }
      this._children[TOP_SE].insert(node);
      ++num_inserted;
    } //if
    if (b_sw) {
      new_position = [x-offset, y+offset, z+offset];
      if (this._children[BOTTOM_SW] === null) { this._children[BOTTOM_SW] = new OcTree(new_size, this._max_depth - 1, this, new_position, BOTTOM_SW); }
      this._children[BOTTOM_SW].insert(node);
      ++num_inserted;
    } //if
    if (b_se) {
      new_position = [x+offset, y+offset, z+offset];
      if (this._children[BOTTOM_SE] === null) { this._children[BOTTOM_SE] = new OcTree(new_size, this._max_depth - 1, this, new_position, BOTTOM_SE); }
      this._children[BOTTOM_SE].insert(node);
      ++num_inserted;
    } //if

    if (num_inserted > 1 || node.octree_common_root === null) {
      node.octree_common_root = this;
    } //if
  } //if

} //OcTree::insert
OcTree.prototype.draw_on_map = function(map_context) {
  if (this._debug_visible === true) map_context.fillStyle = "#222222";

  else if (this._debug_visible === 2) map_context.fillStyle = "#00FF00";

  else if (this._debug_visible === 3) map_context.fillStyle = "#0000FF";

  else if (this._debug_visible === false) map_context.fillStyle = "#000000";

  map_context.strokeStyle = "#FF0000";
  map_context.beginPath();
  var offset = this._size / 2;
  map_context.moveTo(200 + this._position[0] - offset, 200 + this._position[2] - offset);
  map_context.lineTo(200 + this._position[0] - offset, 200 + this._position[2] + offset);
  map_context.lineTo(200 + this._position[0] + offset, 200 + this._position[2] + offset);
  map_context.lineTo(200 + this._position[0] + offset, 200 + this._position[2] - offset);
  map_context.closePath();
  map_context.stroke();
  map_context.fill();

  for (var i = 0, l = this._children.length; i < l; ++i) {
    if (this._children[i] !== null) { this._children[i].draw_on_map(map_context); }
  } //for
} //OcTree::draw_on_map

OcTree.prototype.contains_point = function(position) {
  return position[0] <= this._position[0] + this._size / 2 && position[1] <= this._position[1] + this._size / 2 && position[2] <= this._position[2] + this._size / 2 && position[0] >= this._position[0] - this._size / 2 && position[1] >= this._position[1] - this._size / 2 && position[2] >= this._position[2] - this._size / 2;
} //OcTree::contains_point

OcTree.prototype.get_frustum_hits = function(camera, test_children) {
  var hits = [];
  if (test_children === undefined || test_children === true) {
    if (! (this.contains_point(camera.position))) {
      if (camera.frustum.sphere.intersects(this._sphere) === false) return hits;
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
    hits.push(this._nodes[i]);
    this._nodes[i].was_culled = this._nodes[i].culled;
    this._nodes[i].culled = false;
    this._nodes[i].drawn_this_frame = false;
  } //for

	for (i = 0; i < 8; ++i) {
		if(this._children[i] !== null) {
      var child_hits = this._children[i].get_frustum_hits(camera, test_children);
      hits = hits.concat(child_hits);
    } //if
  } //for

  return hits;
} //OcTree::get_frustum_hits

OcTree.prototype.reset_node_visibility = function() {
  this._debug_visible = false;

  var i, l;
  for (i = 0, l = this._nodes.length; i < l; ++i) {
    this._nodes[i].culled = true;
  } //for
  for (i = 0, l = this._children.length; i < l; ++i) {
    if (this._children[i] !== null) {
      this._children[i].reset_node_visibility();
    } //if
  } //for
} //OcTree::reset_visibility
/***********************************************
 * OcTreeNode
 ***********************************************/
OcTreeNode = function() {
  this.position = [0, 0, 0];
  this.visible = false;
  this._object = null;
} //OcTreeNode::Constructor
OcTreeNode.prototype.toString = function() {
  return "[OcTreeNode " + this.position + "]";
} //OcTreeNode::toString
OcTreeNode.prototype.attach = function(obj) {
  this._object = obj;
} //OcTreeNode::attach
/***********************************************
 * Frustum
 ***********************************************/
var PLANE_LEFT = 0;
var PLANE_RIGHT = 1;
var PLANE_TOP = 2;
var PLANE_BOTTOM = 3;
var PLANE_NEAR = 4;
var PLANE_FAR = 5;

function FrustumWorkerProxy(worker, camera)
{
  this.camera = camera;
  this.worker = worker;
  this.draw_on_map = function(map_context) { return; }
} //FrustumWorkerProxy

FrustumWorkerProxy.prototype.extract = function(camera, mvMatrix, pMatrix)
{
  this.worker.send({type:"set_camera", data:{mvMatrix:this.camera.mvMatrix, pMatrix:this.camera.pMatrix, position:this.camera.position, target:this.camera.target}});
} //FrustumWorkerProxy::extract

var Frustum = function() {
  this.last_in = [];
  this._planes = [];
  this.sphere = null;
  for (var i = 0; i < 6; ++i) {
    this._planes[i] = new Plane();
  } //for
} //Frustum::Constructor
Frustum.prototype.extract = function(camera, mvMatrix, pMatrix) {
  if (typeof(mvMatrix) === 'undefined' || typeof(pMatrix) === 'undefined') return;
  var comboMatrix = cubicvr_transform.prototype.m_mat(mvMatrix, pMatrix);

  // Left clipping plane
  this._planes[PLANE_LEFT].a = comboMatrix[3] + comboMatrix[0];
  this._planes[PLANE_LEFT].b = comboMatrix[7] + comboMatrix[4];
  this._planes[PLANE_LEFT].c = comboMatrix[11] + comboMatrix[8];
  this._planes[PLANE_LEFT].d = comboMatrix[15] + comboMatrix[12];

  // Right clipping plane
  this._planes[PLANE_RIGHT].a = comboMatrix[3] - comboMatrix[0];
  this._planes[PLANE_RIGHT].b = comboMatrix[7] - comboMatrix[4];
  this._planes[PLANE_RIGHT].c = comboMatrix[11] - comboMatrix[8];
  this._planes[PLANE_RIGHT].d = comboMatrix[15] - comboMatrix[12];

  // Top clipping plane
  this._planes[PLANE_TOP].a = comboMatrix[3] - comboMatrix[1];
  this._planes[PLANE_TOP].b = comboMatrix[7] - comboMatrix[5];
  this._planes[PLANE_TOP].c = comboMatrix[11] - comboMatrix[9];
  this._planes[PLANE_TOP].d = comboMatrix[15] - comboMatrix[13];

  // Bottom clipping plane
  this._planes[PLANE_BOTTOM].a = comboMatrix[3] + comboMatrix[1];
  this._planes[PLANE_BOTTOM].b = comboMatrix[7] + comboMatrix[5];
  this._planes[PLANE_BOTTOM].c = comboMatrix[11] + comboMatrix[9];
  this._planes[PLANE_BOTTOM].d = comboMatrix[15] + comboMatrix[13];

  // Near clipping plane
  this._planes[PLANE_NEAR].a = comboMatrix[3] + comboMatrix[2];
  this._planes[PLANE_NEAR].b = comboMatrix[7] + comboMatrix[6];
  this._planes[PLANE_NEAR].c = comboMatrix[11] + comboMatrix[10];
  this._planes[PLANE_NEAR].d = comboMatrix[15] + comboMatrix[14];

  // Far clipping plane
  this._planes[PLANE_FAR].a = comboMatrix[3] - comboMatrix[2];
  this._planes[PLANE_FAR].b = comboMatrix[7] - comboMatrix[6];
  this._planes[PLANE_FAR].c = comboMatrix[11] - comboMatrix[10];
  this._planes[PLANE_FAR].d = comboMatrix[15] - comboMatrix[14];

  for (var i = 0; i < 6; ++i)
  this._planes[i].normalize();

  //Sphere
  var fov = 1 / pMatrix[5];
  var near = -this._planes[PLANE_NEAR].d;
  var far = this._planes[PLANE_FAR].d;
  var view_length = far - near;
  var height = view_length * fov;
  var width = height;

  var P = [0, 0, near + view_length * 0.5];
  var Q = [width, height, near + view_length];
  var diff = Vector3_subtract(P, Q);
  var diff_mag = Vector3_magnitude(diff);

  var look_v = [comboMatrix[3], comboMatrix[9], comboMatrix[10]];
  var look_mag = Vector3_magnitude(look_v);
  look_v = Vector3_multiply(look_v, 1 / look_mag);

  this.sphere = new Sphere([camera.position[0], camera.position[1], camera.position[2]], diff_mag);
  this.sphere.position = Vector3_add(this.sphere.position, Vector3_multiply(look_v, view_length * 0.5));
  this.sphere.position = Vector3_add(this.sphere.position, Vector3_multiply(look_v, 1));

} //Frustum::extract
Frustum.prototype.contains_sphere = function(sphere) {
  for (var i = 0; i < 6; ++i) {
    var p = this._planes[i];
    var normal = [p.a, p.b, p.c];
    var distance = Vector3_dot(normal, sphere.position) + p.d;
    this.last_in[i] = 1;

    //OUT
    if (distance < -sphere.radius) return -1;

    //INTERSECT
    if (Math.abs(distance) < sphere.radius) return 0;

  } //for
  //IN
  return 1;
} //Frustum::contains_sphere
Frustum.prototype.draw_on_map = function(map_context) {
  for (var pi = 0, l=this._planes.length; pi < l; ++pi) {
    map_context.strokeStyle = "#FF00FF";
    if (pi < this.last_in.length) {
      if (this.last_in[pi]) map_context.strokeStyle = "#FFFF00";
    } //if
    var p = this._planes[pi];
    map_context.beginPath();
    var x1 = -200;
    var y1 = (-p.d - p.a * x1) / p.c;
    var x2 = 200;
    var y2 = (-p.d - p.a * x2) / p.c;
    map_context.moveTo(200 + x1, 200 + y1);
    map_context.lineTo(200 + x2, 200 + y2);
    map_context.closePath();
    map_context.stroke();
  } //for
  map_context.strokeStyle = "#0000FF";
  map_context.beginPath();
  map_context.arc(200 + this.sphere.position[0], 200 + this.sphere.position[2], this.sphere.radius, 0, Math.PI * 2, false);
  map_context.closePath();
  map_context.stroke();
} //Frustum::draw_on_map
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
    if (in_count === 0) return -1;

    total_in += point_in;
  } //for i
  //IN
  if (total_in === 6) return 1;

  return 0;
} //Frustum::contains_box

/*****************************************************************************
 * Workers
 *****************************************************************************/
var CubicVR_Worker = function(fn, message_function)
{
  this._worker = new Worker("../../CubicVR.js");
  this._data = null;
  this._function = fn;
  this.message_function = undefined;

  var that = this;
  this._worker.onmessage = function(e)
  {
    this._data = e.data;
    if (typeof(that.message_function) !== "undefined") that.message_function(e);
  } //onmessage

  this._worker.onerror = function(e)
  {
    console.log("Error: " + e.message + ": " + e.lineno);
  } //onerror

} //CubicVR_Worker::Constructor 

CubicVR_Worker.prototype.start = function()
{
  this._worker.postMessage({message:"start", data:this._function});
} //CubicVR_Worker::start

CubicVR_Worker.prototype.stop = function()
{
  this._worker.postMessage({message:"stop", data:null});
} //CubicVR_Worker::stop

CubicVR_Worker.prototype.send = function(message_data)
{
  this._worker.postMessage({message:"data", data:message_data});
} //CubicVR_Worker::send

/*****************************************************************************
 * Global Worker Store
 *****************************************************************************/
function CubicVR_GlobalWorkerStore()
{
  this.listener = null;
} //CubicVR_GlobalWorkerStore

var global_worker_store = new CubicVR_GlobalWorkerStore();

/*****************************************************************************
 * OcTree Worker
 *****************************************************************************/
function CubicVR_OcTreeWorker()
{
  this.octree = null;
  this.nodes = [];
  this.camera = null;
  this._last_on = undefined;
  this._last_off = undefined;
} //CubicVR_OcTreeWorker::Constructor

CubicVR_OcTreeWorker.prototype.onmessage = function(e)
{
  var i;

  switch(e.data.data.type)
  {
    case "init":
      params = e.data.data.data;
      this.octree = new OcTree(params.size, params.max_depth);
      this.camera = new cubicvr_camera();
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
      var node = new cubicvr_sceneObject();
      var trans = new cubicvr_transform();

      for (i in json_node)
        node[i] = json_node[i];
        
      for (i in json_node.trans)
        trans[i] = json_node.trans[i];

      node.trans = trans;
      node.id = json_node.id;

      this.octree.insert(node);
      this.nodes[node.id] = node;
      break;

    case "cleanup":
      this.octree.cleanup();
      break;

    default: break;
  } //switch
} //onmessage

CubicVR_OcTreeWorker.prototype.run = function(that)
{
  if (that.camera !== null && that.octree !== null)
  {
    var i, l;

    if (this._last_on !== undefined) {
      for (i = 0, l = this._last_on.length; i < l; ++i) {
        this._last_on[i].culled = true;
      } //for
    } //if

    // set new visibility on nodes
    var new_hits = that.octree.get_frustum_hits(that.camera);

    // so that ids are in order
    var ids = [];
    for (i = 0, l = that.nodes.length; i < l; ++i) {
      if (that.nodes[i].culled != that.nodes[i].was_culled) {
        ids.push(that.nodes[i].id);
      } //if
    } //for

    // is there anything to send?
    if (ids.length > 0) {
      postMessage({type: "get_frustum_hits", data:ids});
    } //if

    this._last_on = new_hits;
  } //if
} //run

/*****************************************************************************
 * Worker Entry Point
 *****************************************************************************/
onmessage = function(e)
{
  var message = e.data.message;
  if (message === "start")
  {
    switch(e.data.data)
    {
      case "octree":
        var octree = new CubicVR_OcTreeWorker();
        global_worker_store.listener = octree;
        setInterval("global_worker_store.listener.run(global_worker_store.listener)", 50);
        break;
    } //switch
  }
  else if (message === "data")
  {
    if (global_worker_store.listener !== null)
    {
      global_worker_store.listener.onmessage(e);
    } //if
  } //if
} //onmessage

