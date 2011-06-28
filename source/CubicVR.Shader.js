CubicVR.RegisterModule("Shader",function(base) {

  var undef = base.undef;
  var GLCore = base.GLCore;
  var enums = CubicVR.enums;    




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
      log(gl.getShaderInfoLog(shader));
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
      log(gl.getShaderInfoLog(shader));
//      return null;
    }

    return shader;
  };

  /* Shaders */

  function Shader(vs_id, fs_id) {
    var util = CubicVR.util;
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
      throw new Error("Could not initialise shader vert(" + vs_id + "), frag(" + fs_id + ")");
    }
  }


  Shader.prototype.bindSelf = function(uniform_id) {  
    var t,k,p,v;
    
    if (uniform_id.indexOf(".")!==-1) {
      if (uniform_id.indexOf("[")!==-1) {
        t = uniform_id.split("[");
        p = t[0];
        t = t[1].split("]");
        k = t[0];
        t = t[1].split(".");
        v = t[1];
        
        if (this[p] === undef) {
          this[p] = [];
        }
        if (this[p][k] === undef) {
          this[p][k] = {};
        }
        
        this[p][k][v] = this.uniforms[uniform_id];

      } else {  // untested
        t = uniform_id.split(".");
        p = t[0];
        v = t[1];

        if (this[p] === undef) {
          this[p] = {};
        }
        
        this[p][v] = this.uniforms[uniform_id];
        
      }
    } else if ( uniform_id.indexOf("[") !== -1){  // untested
      t = uniform_id.split("[");
      p = t[0];
      t = t[1].split("]");
      k = t[0];
      
      if (this[p] === undef) {
        this[p] = [];
      }
      
      this[p][k] = this.uniforms[uniform_id];
    }
    else {
      this[uniform_id] = this.uniforms[uniform_id];
    }
  }

  Shader.prototype.addMatrix = function(uniform_id, default_val) {
    this.use();
    this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
    this.uniform_type[uniform_id] = enums.shader.uniform.MATRIX;
    this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

    if (default_val !== undef) {
      this.setMatrix(uniform_id, default_val);
    }

    this.bindSelf(uniform_id);
    return this.uniforms[uniform_id];
  };

  Shader.prototype.addVector = function(uniform_id, default_val) {
    this.use();

    this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
    this.uniform_type[uniform_id] = enums.shader.uniform.VECTOR;
    this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

    if (default_val !== undef) {
      this.setVector(uniform_id, default_val);
    }

    this.bindSelf(uniform_id);
    return this.uniforms[uniform_id];
  };

  Shader.prototype.addFloat = function(uniform_id, default_val) {
    this.use();
    this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
    this.uniform_type[uniform_id] = enums.shader.uniform.FLOAT;
    this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

    if (default_val !== undef) {
      this.setFloat(uniform_id, default_val);
    }

    this.bindSelf(uniform_id);
    return this.uniforms[uniform_id];
  };


  Shader.prototype.addVertexArray = function(uniform_id) {
    this.use();
    this.uniforms[uniform_id] = GLCore.gl.getAttribLocation(this.shader, uniform_id);
    this.uniform_type[uniform_id] = enums.shader.uniform.ARRAY_VERTEX;
    this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

    this.bindSelf(uniform_id);
    return this.uniforms[uniform_id];
  };

  Shader.prototype.addUVArray = function(uniform_id) {
    this.use();
    this.uniforms[uniform_id] = GLCore.gl.getAttribLocation(this.shader, uniform_id);
    this.uniform_type[uniform_id] = enums.shader.uniform.ARRAY_UV;
    this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

    this.bindSelf(uniform_id);
    return this.uniforms[uniform_id];
  };

  Shader.prototype.addFloatArray = function(uniform_id) {
    this.use();
    this.uniforms[uniform_id] = GLCore.gl.getAttribLocation(this.shader, uniform_id);
    this.uniform_type[uniform_id] = enums.shader.uniform.ARRAY_FLOAT;
    this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

    this.bindSelf(uniform_id);
    return this.uniforms[uniform_id];
  };

  Shader.prototype.addInt = function(uniform_id, default_val) {
    this.use();
    this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
    this.uniform_type[uniform_id] = enums.shader.uniform.INT;
    this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

    if (default_val !== undef) {
      this.setInt(uniform_id, default_val);
    }

    this.bindSelf(uniform_id);
    return this.uniforms[uniform_id];
  };

  Shader.prototype.use = function() {
    GLCore.gl.useProgram(this.shader);
  };

  Shader.prototype.setMatrix = function(uniform_id, mat) {
    var u = this.uniforms[uniform_id];
    if (u === null) {
      return;
    }
    
    var l = mat.length;
    
    if (l===16) {
      GLCore.gl.uniformMatrix4fv(u, false, mat);  
    } else if (l === 9) {
      GLCore.gl.uniformMatrix3fv(u, false, mat);  
    } else if (l === 4) {
      GLCore.gl.uniformMatrix2fv(u, false, mat);  
    }
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
    
    var l = val.length;
    
    if (l==3) {
      GLCore.gl.uniform3fv(u, val);    
    } else if (l==2) {
      GLCore.gl.uniform2fv(u, val);    
    } else {
      GLCore.gl.uniform4fv(u, val);
    }
  };


  Shader.prototype.clearArray = function(uniform_id) {
    var gl = GLCore.gl;  
    var u = this.uniforms[uniform_id];
    if (u === null) {
      return;
    }
      
    gl.disableVertexAttribArray(u);
  };

  Shader.prototype.bindArray = function(uniform_id, buf) {
    var gl = GLCore.gl;  
    var u = this.uniforms[uniform_id];
    if (u === null) {
      return;
    }
    
    var t = this.uniform_type[uniform_id];
      
    if (t === enums.shader.uniform.ARRAY_VERTEX) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(u, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(u);
    } else if (t === enums.shader.uniform.ARRAY_UV) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(u, 2, gl.FLOAT, false, 0, 0);
    } else if (t === enums.shader.uniform.ARRAY_FLOAT) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(u, 1, gl.FLOAT, false, 0, 0);
    }
  };

  var extend = {
    Shader: Shader    
  };
  
  return extend;
});
