
CubicVR.RegisterModule("Shader",function(base) {

  var undef = base.undef;
  var GLCore = base.GLCore;
  var enums = base.enums;    
  var log = base.log;
  var util = base.util;

  // Shader Map Inputs (binary hash index)
  enums.shader = {
    map: {
      COLOR: 1,
      SPECULAR: 2,
      NORMAL: 4,
      BUMP: 8,
      REFLECT: 16,
      ENVSPHERE: 32,
      AMBIENT: 64,
      ALPHA: 128,
      COLORMAP: 256
    },
    mode: {
      POINT_SPRITE: 512,
      POINT_SIZE: 1024,
      POINT_CIRCLE: 2048
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

//    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
  //    log(gl.getShaderInfoLog(shader));
//      return null;
//    }

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

    return shader;
  };

  /* Shaders */

  function Shader(vs_id, fs_id) {
    var util = base.util;
    var vertexShader;
    var fragmentShader;
    var loadedVertexShader;
    var loadedFragmentShader;
    var gl =  GLCore.gl;
    
    this.uniforms = [];
    this.uniform_type = [];
    this.uniform_typelist = [];
    this.success = true;
    this.vertexLog = "";
    this.fragmentLog = "";
    this.classType = base.enums.classType.SHADER;


    if (vs_id.indexOf("\n") !== -1) {
      loadedVertexShader = vs_id;
      vertexShader = cubicvr_compileShader(GLCore.gl, vs_id, "x-shader/x-vertex");
    } else {
      vertexShader = cubicvr_getShader(GLCore.gl, vs_id);

      if (vertexShader === null) {
        loadedVertexShader = util.getURL(vs_id);

        vertexShader = cubicvr_compileShader(GLCore.gl, loadedVertexShader, "x-shader/x-vertex");
      }
    }

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      this.vertexLog = gl.getShaderInfoLog(vertexShader);
//      log();
      this.success = false;
    }

    if (fs_id.indexOf("\n") !== -1) {
      loadedFragmentShader = fs_id;
      fragmentShader = cubicvr_compileShader(GLCore.gl, fs_id, "x-shader/x-fragment");
    } else {
      fragmentShader = cubicvr_getShader(GLCore.gl, fs_id);

      if (fragmentShader === null) {
        loadedFragmentShader = util.getURL(fs_id);

        fragmentShader = cubicvr_compileShader(GLCore.gl, loadedFragmentShader, "x-shader/x-fragment");
      }
    }

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      this.fragmentLog = gl.getShaderInfoLog(fragmentShader);
      //      log(gl.getShaderInfoLog(fragmentShader));
      this.success = false;
    }
    
    if (this.success) {
      this.shader = gl.createProgram();
      gl.attachShader(this.shader, vertexShader);
      gl.attachShader(this.shader, fragmentShader);
      gl.linkProgram(this.shader);

      if (!GLCore.gl.getProgramParameter(this.shader,gl.LINK_STATUS)) {
  //      throw new Error("Could not initialise shader vert(" + vs_id + "), frag(" + fs_id + ")");
        log("Error linking shader:\n"+gl.getProgramInfoLog(this.shader));
        this.success = false;
      }
    } else {
        var vertexResult = util.multiSplit(this.vertexLog,";\n");
        var fragmentResult = util.multiSplit(this.fragmentLog,";\n");
        
        if (vertexResult.length) {
          this.dumpErrors(vertexResult,loadedVertexShader);            
        }
        
        if (fragmentResult.length) {
          this.dumpErrors(fragmentResult,loadedFragmentShader);                                
        }
    }
  }


  Shader.prototype = {
    isCompiled: function() {
      return this.success;
    },
    dumpErrors: function(err,src,prefix) {
      prefix = prefix||"Error on line";
      prefix += " ";
      var errorToken = "ERROR: ";
      var arrSrc = src.split("\n");
      for (var i = 0, iMax = err.length; i<iMax; i++) {
        var s = err[i];
        if (s.indexOf(errorToken) === 0) {
          var errStr = s.substr(errorToken.length).trim();
          var errLine = errStr.substr(0,errStr.indexOf(" "));
          errStr = errStr.substr(errLine.length);
          var arrLine = errLine.split(":");
          var lineNum = parseInt(arrLine[1],10);
          var srcLine = arrSrc[lineNum-1];
          console.log(lineNum+"> "+srcLine);
          console.log(prefix+lineNum+", :"+errStr);
        }
      }      
    },
    bindSelf: function(uniform_id) {  
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
    },

    addMatrix: function(uniform_id, default_val) {
      this.use();
      this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
      this.uniform_type[uniform_id] = enums.shader.uniform.MATRIX;
      this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

      if (default_val !== undef) {
        this.setMatrix(uniform_id, default_val);
      }

      this.bindSelf(uniform_id);
      return this.uniforms[uniform_id];
    },

    addVector: function(uniform_id, default_val) {
      this.use();

      this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
      this.uniform_type[uniform_id] = enums.shader.uniform.VECTOR;
      this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

      if (default_val !== undef) {
        this.setVector(uniform_id, default_val);
      }

      this.bindSelf(uniform_id);
      return this.uniforms[uniform_id];
    },

    addFloat: function(uniform_id, default_val) {
      this.use();
      this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
      this.uniform_type[uniform_id] = enums.shader.uniform.FLOAT;
      this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

      if (default_val !== undef) {
        this.setFloat(uniform_id, default_val);
      }

      this.bindSelf(uniform_id);
      return this.uniforms[uniform_id];
    },

    addVertexArray: function(uniform_id) {
      this.use();
      this.uniforms[uniform_id] = GLCore.gl.getAttribLocation(this.shader, uniform_id);
      this.uniform_type[uniform_id] = enums.shader.uniform.ARRAY_VERTEX;
      this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

      this.bindSelf(uniform_id);
      return this.uniforms[uniform_id];
    },

    addUVArray: function(uniform_id) {
      this.use();
      this.uniforms[uniform_id] = GLCore.gl.getAttribLocation(this.shader, uniform_id);
      this.uniform_type[uniform_id] = enums.shader.uniform.ARRAY_UV;
      this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

      this.bindSelf(uniform_id);
      return this.uniforms[uniform_id];
    },

    addFloatArray: function(uniform_id) {
      this.use();
      this.uniforms[uniform_id] = GLCore.gl.getAttribLocation(this.shader, uniform_id);
      this.uniform_type[uniform_id] = enums.shader.uniform.ARRAY_FLOAT;
      this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

      this.bindSelf(uniform_id);
      return this.uniforms[uniform_id];
    },

    addInt: function(uniform_id, default_val) {
      this.use();
      this.uniforms[uniform_id] = GLCore.gl.getUniformLocation(this.shader, uniform_id);
      this.uniform_type[uniform_id] = enums.shader.uniform.INT;
      this.uniform_typelist.push([this.uniforms[uniform_id], this.uniform_type[uniform_id]]);

      if (default_val !== undef) {
        this.setInt(uniform_id, default_val);
      }

      this.bindSelf(uniform_id);
      return this.uniforms[uniform_id];
    },

    use: function() {
      GLCore.gl.useProgram(this.shader);
    },

    setMatrix: function(uniform_id, mat) {
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
    },

    setInt: function(uniform_id, val) {
      var u = this.uniforms[uniform_id];
      if (u === null) {
        return;
      }
      
      GLCore.gl.uniform1i(u, val);
    },

    setFloat: function(uniform_id, val) {
      var u = this.uniforms[uniform_id];
      if (u === null) {
        return;
      }
      
      GLCore.gl.uniform1f(u, val);
    },

    setVector: function(uniform_id, val) {
      var u = this.uniforms[uniform_id];
      if (u === null) {
        return;
      }
      
      var l = val.length;
      if (l==4) {
        GLCore.gl.uniform4fv(u, val);    
      } else if (l==3) {
        GLCore.gl.uniform3fv(u, val);    
      } else if (l==2) {
        GLCore.gl.uniform2fv(u, val);    
      } else {
        GLCore.gl.uniform4fv(u, val);
      }
    },
    
    clearArray: function(uniform_id) {
      var gl = GLCore.gl;  
      var u = this.uniforms[uniform_id];
      if (u === null) {
        return;
      }
        
      gl.disableVertexAttribArray(u);
    },

    bindArray: function(uniform_id, buf) {
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
    }
  };
  
  
  var shader_util = {
    tidyScript: function(str) {
        return str.replace(/\t+/g,' ') // strip tabs
        .replace(/\/\/.*$/gm,'')  // strip // comments
        .replace(/\/\*(.|\n)*\*\//g,'')  // strip /star star/ comments
        .replace(/ +/g,' ') // condense multiple spaces
        .replace(/ *\[ */g,'[') // remove spaces from left brackets
        .replace(/ *\] */g,']') // remove spaces from right brackets
        .replace(/ *; */g,';')  // remove spaces around ;
        .replace(/ *$/gm,'')  // strip trailing line spaces
        .replace(/^ */gm,''); // strip prefixed line spaces
    },
    getDefines: function(str) {
       var defines = {};
       var ar_str = util.multiSplit(str,"\n;");
       for (i = 0, iMax = ar_str.length; i<iMax; i++) {
            var s = ar_str[i];
            if (s.indexOf("#define")===0) {
              var sa = s.split(" ");
              if (sa.length>2) {
                defines[sa[1]] = sa.slice(2).join(" ");
              }
            }            
        }
        return defines;
    },
    replaceAll: function(str,arr,wrapl,wrapr) {
      wrapl = wrapl||"";
      wrapr = wrapr||"";
      for (var i in arr) {
        if (!arr.hasOwnProperty(i)) continue;
        var strval = wrapl+i+wrapr;

        while (str.indexOf(strval)!==-1) { 
          str = str.replace(strval,wrapl+arr[i]+wrapr);
        }                            
      }
      return str;
    },
    /*
        TODO: for getShaderInfo -- validate the parsed GLSL data against what the standard WebGL attribute/uniform
        query to make sure we didn't miss any and we can report and handle whatever GLSL has factored out on it's own.
        
        Also need to parse #define statements if we want to get proper results and not keep binding variables that
        don't exist in the current compile.
        
        If we have too many problems with parsing we should just scrap this function and use the WebGL queries
        directly as it's the most sensible method.

        Proper query funcs:
        ------------------
                
        var t = gl.getActiveUniform(this._shader.shader,0);
        console.log(t.size,t.type,t.name);
        var t = gl.getActiveAttrib(this._shader.shader,1);
        console.log(t.size,t.type,t.name);
                
        //  WebGLActiveInfo getActiveAttrib(WebGLProgram program, GLuint index);
        //  WebGLActiveInfo getActiveUniform(WebGLProgram program, GLuint index);
        //  WebGLShader[ ] getAttachedShaders(WebGLProgram program);
        
        
        Proper enums:
        ------------
        const GLenum FLOAT_VEC2                     = 0x8B50;
        const GLenum FLOAT_VEC3                     = 0x8B51;
        const GLenum FLOAT_VEC4                     = 0x8B52;
        const GLenum INT_VEC2                       = 0x8B53;
        const GLenum INT_VEC3                       = 0x8B54;
        const GLenum INT_VEC4                       = 0x8B55;
        const GLenum BOOL                           = 0x8B56;
        const GLenum BOOL_VEC2                      = 0x8B57;
        const GLenum BOOL_VEC3                      = 0x8B58;
        const GLenum BOOL_VEC4                      = 0x8B59;
        const GLenum FLOAT_MAT2                     = 0x8B5A;
        const GLenum FLOAT_MAT3                     = 0x8B5B;
        const GLenum FLOAT_MAT4                     = 0x8B5C;
        const GLenum SAMPLER_2D                     = 0x8B5E;
        const GLenum SAMPLER_CUBE                   = 0x8B60;
        
    */
    getShaderInfo: function(v,f) {
        var i,iMax,j,jMax,s,sa;
        var typeList = ["uniform","attribute","varying"];
        var ids = [];      
        var shader_vars = { };
        var shader_structs = { };
        var ar_str;
        
        if (f === undef) f = "";
        
        v = shader_util.tidyScript(v);
        f = shader_util.tidyScript(f);
        
        shader_vars.v_define = shader_util.getDefines(v); 
        shader_vars.f_define = shader_util.getDefines(f); 

        // we only care about array definitions, such as myVar[myLengthDefine], so wrap with []
        v = shader_util.replaceAll(v,shader_vars.v_define,"[","]");
        f = shader_util.replaceAll(f,shader_vars.f_define,"[","]");

        var str = (v+"\n"+f); 
        
        ar_str = util.multiSplit(str,"\n;");
        
        var structList = [];
        var start = -1, end = -1;
        
        for (i = 0, iMax = ar_str.length; i<iMax; i++) {
          s = ar_str[i];

          if (start === -1 && s.indexOf("struct")===0) {
            start = i;          
          } else if (end === -1 && start !==-1 && s.indexOf("}")!==-1) {
            end = i+1;
          }
          
          if (start !== -1 && end !== -1) {
            var structStr = ar_str.slice(start,end).join("\n")
            .replace(/(\{|\})/g,"\n")
            .replace(/ +$/gm,"")
            .replace(/^ +/gm,"")
            .replace(/\n\n/gm,"\n");
            
            /*
            while (structStr.indexOf("  ") !== -1) { 
              structStr = structStr.replace("  "," ");
            }
            while (structStr.indexOf(" \n") !== -1) {
              structStr = structStr.replace(" \n","\n");
            }
            while (structStr.indexOf("\n\n") !== -1) {
              structStr = structStr.replace("\n\n","\n");
            }
            */
            
            structList.push({start:start,end:end,struct:structStr.split("\n")});
            start = -1;
            end = -1;
          }
        }
        
        for (i = 0, iMax = structList.length; i<iMax; i++) {
          var struct = structList[i].struct;

          var structName = null;
                  
          for (j = 0, jMax = struct.length; j<jMax; j++) {
            s = struct[j].split(" ");
            if (s.length <= 1) continue;
            
            if (s[0] == "struct") {
              structName = s[1];
              shader_structs[structName] = { };
            } else if (structName) {
              shader_structs[structName][s[1]] = s[0];
            }
          }
        }
        shader_vars.struct = shader_structs;

        for (i = 0, iMax = typeList.length; i < iMax; i++) {                        
            shader_vars[typeList[i]] = [];                
        }
        
        for (i = 0, iMax = ar_str.length; i < iMax; i++) {
            s = ar_str[i];
            for (j = 0, jMax = typeList.length; j < jMax; j++) {                        
                var typeName = typeList[j];
                if (s.indexOf(typeName)===0) {
                    sa = s.split(" ");
                    if (sa.length === 3 && sa[0] == typeName) {
                        if (ids.indexOf(sa[2]) === -1) {
                            ids.push(sa[2]);
                            if (sa[2].indexOf("[")!==-1) {
                              var ar_info = sa[2].split("[");
                              var arLen = ar_info[1].replace("]","");
                              var arLenInt = parseInt(arLen,10);
                              var isNan = (arLenInt!==arLenInt);
                              if (!isNan) {
                                arLen = arLenInt;
                              }
                              shader_vars[typeName].push({name:ar_info[0],type:sa[1],isArray:true,len:arLen}); 
                            } else {
                              shader_vars[typeName].push({name:sa[2],type:sa[1]});
                            }
                        }
                    }
                }
            }
        }
       
        return shader_vars;
    },
    genShaderVarList: function(shaderInfo,vtype) {
      var shaderVars = shaderInfo[vtype];
      var resultList = [];
      var i,iMax,j,jMax, svLoc, n;
      
      if (!shaderVars) return [];
      
      for (i = 0, iMax = shaderVars.length; i < iMax; i++) {
        var sv = shaderVars[i];
        if (shaderInfo.struct[sv.type]) {
          var structInfo = shaderInfo.struct[sv.type];
          if (structInfo && sv.isArray) {
            for( j = 0, jMax = sv.len; j<jMax; j++) {
              svLoc = sv.name+"["+j+"]";
              for ( n in structInfo ) {
                if (!structInfo.hasOwnProperty(n)) {
                  continue;
                }
                resultList.push({location:svLoc+"."+n,type:structInfo[n],basename:sv.name});
              }
            }
          } else {
            for ( n in structInfo ) {
              resultList.push({location:sv.name+"."+n,type:structInfo[n],basename:sv.name});
            }
          }
        } else {
          if (sv.isArray) {
            for( j = 0, jMax = sv.len; j<jMax; j++) {
              svLoc = sv.name+"["+j+"]";
              resultList.push({location:svLoc,type:sv.type,basename:sv.name});
            }
          } else {
              resultList.push({location:sv.name,type:sv.type,basename:sv.name});
          }
        }
      }
      
      return resultList;
    },
    getShaderVars: function(shaderInfo) {
        var results = {};
        
        results.uniform = shader_util.genShaderVarList(shaderInfo,"uniform");
        results.attribute = shader_util.genShaderVarList(shaderInfo,"attribute");
        return results;
    }
  };
  
  function CustomShader(obj_init) {
    this._update = obj_init.update||null;
    this._init = obj_init.init||null;
    this._vertex = base.get(obj_init.vertex)||null;
    this._fragment = base.get(obj_init.fragment)||null;
    this._bindings = [];
    this._shader = null;
    this._shaderInfo = null;
    this._shaderVars = null;
    this._initialized = false;
    this.classType = base.enums.classType.CUSTOMSHADER;
    
    var dpCheck = (this._vertex||"")+(this._fragment||"");
    
    if (dpCheck.trim() !== "") {
      this._hasDepthPack = /\s\!?LIGHT_DEPTH_PASS\s/.test(dpCheck);
    } else {
      this._hasDepthPack = false;
    }
        
  }
  
  CustomShader.prototype = {
    use: function() {
      if (this._initialized) {
        this._shader.use();
      }      
    },
    getShader: function() {
      return this._shader;      
    },   
    ready: function() {
      return this._initialized;
    },
    isReady: function() {
      return this._initialized;
    },
    hasDepthPack: function() {
      return this._hasDepthPack;
    },
    _init_shader: function(vs_id,fs_id,internal_vars,doSplice,spliceToken) {
      internal_vars = internal_vars||[];
      var vertex_shader = base.util.get(vs_id);
      var fragment_shader = base.util.get(fs_id);
      spliceToken = spliceToken||"#define customShader_splice";
      doSplice = (doSplice===undef)?(this._vertex||this._fragment):doSplice;
      
      if (doSplice) {
        var vertSplice = vertex_shader.indexOf(spliceToken);
        var fragSplice = fragment_shader.indexOf(spliceToken);
        
        if (vertSplice!==-1&&this._vertex) {
          vertex_shader = vertex_shader.substr(0,vertSplice)+this._vertex;
        }
        if (fragSplice!==-1&&this._fragment) {
          fragment_shader = fragment_shader.substr(0,fragSplice)+this._fragment;
        }
      }
      
      this._shader = new base.Shader(vertex_shader,fragment_shader);
      this._shaderInfo = shader_util.getShaderInfo(vertex_shader,fragment_shader);
      this._shaderVars = shader_util.getShaderVars(this._shaderInfo);
      this._appendShaderVars(this._shaderVars,"uniform",internal_vars);
      this._appendShaderVars(this._shaderVars,"attribute",internal_vars); 

      this._initialized = this._shader.isCompiled();
      
      if (this._initialized && this._init) {
        this._init(this);            
      }
    },
    _appendShaderVars: function(varList,utype,internal_vars) {
        var textureFunc = function(cs,context) { 
            return function(idx,texture) {
               if (texture !== undef) {
                   gl.activeTexture(gl.TEXTURE0+idx);
                   gl.bindTexture(GLCore.gl.TEXTURE_2D, base.Textures[texture.tex_id]);
               }           
               context.value = idx;
               cs.update(context);
            };
        };
    
      for (var i = 0, iMax = this._shaderVars[utype].length; i < iMax; i++) {
        var sv = this._shaderVars[utype][i];
        var svloc = sv.location;
        var basename = sv.basename;
        if (internal_vars.indexOf(basename)!==-1) {
//           console.log("MaterialShader: Skipped ~["+basename+"]");
           continue;
        } else {
//           console.log("CustomShader: Added +["+svloc+": "+sv.type+"]");
        }
        var svtype = sv.type;
        if (svtype === "vec3") {
          if (utype === "attribute") {
            this._shader.addVertexArray(svloc);          
          } else {
            this._shader.addVector(svloc);
          }
        } else if (svtype === "vec2") {
          if (utype === "attribute") {
            this._shader.addUVArray(svloc);          
          } else {
            this._shader.addVector(svloc);
          }
        } else if (svtype === "vec4") {
          if (utype === "attribute") {
                // todo: this..
//            this._shader.addVertexArray(svloc);          
          } else {
            this._shader.addVector(svloc);
          }
        } else if (svtype === "float") {
          if (utype === "attribute") {
            this._shader.addFloatArray(svloc);          
          } else {
            this._shader.addFloat(svloc);
          }
        } else if (svtype === "sampler2D"||svtype === "int") {
          this._shader.addInt(svloc);
        } else if (svtype === "mat4"||svtype === "mat3"||svtype === "mat2") {
          this._shader.addMatrix(svloc);     
        } 
        var binding = this._bindSelf(svloc);
        
        if (svtype=="sampler2D" && binding) {
            var cs = this;
            var gl = GLCore.gl;
            binding.set = textureFunc(this,binding);
        }
      }
    },
    
    _bindSelf: function(uniform_id) {  
      var t,k,p,v,bindval;

      if (this._shader.uniforms[uniform_id]===null) return;

      var bindSetFunc = function(cs,context) { 
        return function(value) {
           context.value = value;
           cs.update(context);
        };
      };
      
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
          
          bindval = { location: this._shader.uniforms[uniform_id], value: null, type: this._shader.uniform_type[uniform_id] };          
          this[p][k][v] = bindval;
          this._bindings.push(bindval);

        } else {  // untested
          t = uniform_id.split(".");
          p = t[0];
          v = t[1];

          if (this[p] === undef) {
            this[p] = {};
          }
          
          bindval = { location: this._shader.uniforms[uniform_id], value: null, type: this._shader.uniform_type[uniform_id] };          
          this[p][v] = bindval;          
          this._bindings.push(bindval);          
        }
      } else if ( uniform_id.indexOf("[") !== -1){  // untested
        t = uniform_id.split("[");
        p = t[0];
        t = t[1].split("]");
        k = t[0];
        
        if (this[p] === undef) {
          this[p] = [];
        }
        
        bindval = { location: this._shader.uniforms[uniform_id], value: null, type: this._shader.uniform_type[uniform_id] };       
        this[p][k] = bindval;
        this._bindings.push(bindval);
      }
      else {
        bindval = { location: this._shader.uniforms[uniform_id], value: null, type: this._shader.uniform_type[uniform_id] };
        this[uniform_id] = bindval;
        this._bindings.push(bindval);
      }
      
      if (bindval) {
        bindval.set = bindSetFunc(this,bindval);
      }
      
      return bindval;
    },
    _doUpdate: function(opt) {
        if (!this._initialized) return;
        if (this._update) {
          this._update(this,opt);
        } else {
          for (var i = 0, iMax = this._bindings.length; i<iMax; i++) {
            this.update(this._bindings[i],opt);            
          }
        }
    },
    update: function(bindObj) {
      if (!this._initialized) return;
      var gl = GLCore.gl;
      var l;
      var val = bindObj.value;
      var u = bindObj.location;

      if (u === null) return;
      
      if (bindObj.type === enums.shader.uniform.MATRIX) {
        l = val.length;
      
        if (l===16) {
          gl.uniformMatrix4fv(u, false, val);  
        } else if (l === 9) {
          gl.uniformMatrix3fv(u, false, val);  
        } else if (l === 4) {
          gl.uniformMatrix2fv(u, false, val);
        }      
      } else if (bindObj.type === enums.shader.uniform.INT) {
         gl.uniform1i(u, val);             
      } else if (bindObj.type === enums.shader.uniform.VECTOR) {
        l = val.length;
      
        if (l===4) {
          gl.uniform4fv(u, val);
        } if (l===3) {
          gl.uniform3fv(u, val);    
        } else if (l===2) {
          gl.uniform2fv(u, val);    
        } else {
          gl.uniform4fv(u, val);
        }    
      } else if (bindObj.type === enums.shader.uniform.FLOAT) {
        gl.uniform1f(u, val);  
      } else if (bindObj.type === enums.shader.uniform.ARRAY_VERTEX) {
        gl.bindBuffer(gl.ARRAY_BUFFER, val);
        gl.vertexAttribPointer(u, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(u);              
      } else if (bindObj.type === enums.shader.uniform.ARRAY_UV) {
        gl.bindBuffer(gl.ARRAY_BUFFER, val);
        gl.vertexAttribPointer(u, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(u);              
      } else if (bindObj.type === enums.shader.uniform.ARRAY_FLOAT) {
        gl.bindBuffer(gl.ARRAY_BUFFER, val);
        gl.vertexAttribPointer(u, 1, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(u);              
      } 
    }
  };


  var extend = {
    Shader: Shader,
    shader_util: shader_util,
    CustomShader: CustomShader
  };
  
  return extend;
});
