
CubicVR.RegisterModule("Material", function(base) {
  var undef = base.undef;
  var GLCore = base.GLCore;
  var enums = base.enums;
  var util = base.util;
  
  var failSafeShader = null;
 
  /* Materials */
  function Material(obj_init) {
    this.initialized = false;
    this.dirtyFlag = false;
    this.blendEnabled = false;
    this.textures = [];
    this.shader = [];
    this.classType = base.enums.classType.MATERIAL;

    obj_init = base.get(obj_init) || {};

    this.customShader = obj_init?(obj_init.shader||null):null;
    
    if (failSafeShader === null) {
      failSafeShader = new base.CustomShader({
        vertex: ["precision lowp float; \nattribute vec3 vertexPosition; uniform mat4 matrixModelView; uniform mat4 matrixProjection; uniform mat4 matrixObject;",
        "void main(void) { gl_Position = matrixProjection * matrixModelView * matrixObject * vec4(vertexPosition,1.0); }"].join("\n"),
        fragment: "precision lowp float; \nvoid main(void) { gl_FragColor = vec4(1.0,0.0,1.0,1.0); }\n"
      });
      failSafeShader._init_shader(failSafeShader._vertex, failSafeShader._fragment, false);
    }
    
    if (this.customShader && !this.customShader._init_shader && typeof(this.customShader) === 'object') {
      this.customShader = new base.CustomShader(this.customShader);
    }

    this.diffuse = obj_init.diffuse||[1.0, 1.0, 1.0];
    this.specular = obj_init.specular||[0.1, 0.1, 0.1];
    this.color = obj_init.color||[1, 1, 1];
    this.ambient = obj_init.ambient||[0, 0, 0];
    this.name = obj_init.name||null;
    this.visible = (obj_init.visible!==undef)?obj_init.visible:true;
    this.friction = (obj_init.friction!==undef)?obj_init.friction:0.3;
    this.collision = (obj_init.visible!==undef)?obj_init.collision:true;

    this.opacity = (obj_init.opacity===undef)?1.0:obj_init.opacity;
    this.shininess = (obj_init.shininess===undef)?1.0:obj_init.shininess;
    this.max_smooth = (obj_init.max_smooth===undef)?60.0:obj_init.max_smooth;
    this.env_amount = (obj_init.env_amount===undef)?0.75:obj_init.env_amount;
    this.morph = (obj_init.morph===undef)?false:obj_init.morph;
    this.color_map = (obj_init.colorMap===undef)?false:obj_init.colorMap;
    this.uvOffset = (obj_init.uvOffset===undef)?[0,0]:obj_init.uvOffset;
    this.noFog = (obj_init.noFog===undef)?false:obj_init.noFog;
    this.pointSprite = obj_init.pointSprite||false;
    this.pointSize = obj_init.pointSize||0;
    this.pointCircle = obj_init.pointCircle||0;

    if (obj_init.textures) {
        for (var i in obj_init.textures) {
            // enumeration and image cache / string url are now handled by setTexture()
            this.setTexture(obj_init.textures[i],i);
        }
    }
  }
  
  var basicTex = [enums.texture.map.REFLECT,
               enums.texture.map.SPECULAR,
               enums.texture.map.NORMAL,
               enums.texture.map.BUMP];

  var renderBindState = [];

  var material_internal_vars = ["textureColor","textureEnvSphere","textureNormal","textureBump","textureReflect","textureSpecular","textureAmbient","textureAlpha",
  "matrixModelView","matrixProjection","matrixObject","matrixNormal","vertexPosition","vertexNormal","vertexColor","vertexTexCoord","materialTexOffset",
  "vertexMorphPosition","vertexMorphNormal","materialMorphWeight","lightDiffuse","lightSpecular","lightIntensity","lightDistance","lightPosition","lightDirection",
  "lightCutOffAngle","lightShadowMap","lightProjectionMap","lightDepthClip","lightShadowMatrix","lightAmbient","materialDiffuse","materialColor","materialAmbient","materialSpecular","materialShininess",
  "materialEnvironment","materialAlpha","postDepthInfo"];


  Material.prototype = {
     clone: function() {
     
       var newMat = new base.Material({
           diffuse: this.diffuse,
           specular: this.specular,
           color: this.color,
           ambient: this.ambient,
           opacity: this.opacity,
           shininess: this.shininess,
           max_smooth: this.max_smooth,
           env_amount: this.env_amount,
           morph: this.morph,
           colorMap: this.color_map,
           visible: this.visible,
           friction: this.friction,
           collision: this.collision,
           pointSprite: this.pointSprite,
           pointSize: this.pointSize,
           pointCircle: this.pointCircle,
           name: this.name
       });
       
       for (var i in this.textures) {
        if (!this.textures.hasOwnProperty(i)) continue;
        newMat.setTexture(this.textures[i],i);
       }
       
       return newMat;
     },
     
     setVisibility: function(vis) {
       this.visible = vis;
     },
     
     getVisibility: function() {
       return this.visible;
     },

     setCollision: function(cval) {
       this.collision = cval;
     },
     
     getCollision: function() {
       return this.collision;
     },
     
     setFriction: function(fval) {
         this.friction = fval;
     },
     
     getFriction: function() {
         return this.friction;
     },
     
     setTexture: function(tex, tex_type) {
      if (!tex) return;
      
      tex_type = base.parseEnum(enums.texture.map,tex_type)||0;

      if (!base.features.texturePerPixel) {
        if (basicTex.indexOf(tex_type)!==-1) {
          return;
        }
      }
      
      if (!tex.use && typeof(tex) === "string") {
        tex = (base.Textures_ref[tex] !== undef) ? base.Textures_obj[base.Textures_ref[tex]] : (new base.Texture(tex));
      }   
      

      this.textures[tex_type] = tex;
    },

   calcShaderMask: function() {
      var shader_mask = 0;

      shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.COLOR]) === 'object') ? enums.shader.map.COLOR : 0);
      shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.SPECULAR]) === 'object') ? enums.shader.map.SPECULAR : 0);
      shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.NORMAL]) === 'object') ? enums.shader.map.NORMAL : 0);
      shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.BUMP]) === 'object') ? enums.shader.map.BUMP : 0);
      shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.REFLECT]) === 'object') ? enums.shader.map.REFLECT : 0);
      shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.ENVSPHERE]) === 'object') ? enums.shader.map.ENVSPHERE : 0);
      shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.AMBIENT]) === 'object') ? enums.shader.map.AMBIENT : 0);
      shader_mask = shader_mask + ((typeof(this.textures[enums.texture.map.ALPHA]) === 'object') ? enums.shader.map.ALPHA : 0);
      shader_mask = shader_mask + ((this.pointSprite) ? enums.shader.mode.POINT_SPRITE : 0);
      shader_mask = shader_mask + ((this.pointSize) ? enums.shader.mode.POINT_SIZE : 0);
      shader_mask = shader_mask + ((this.pointCircle) ? enums.shader.mode.POINT_CIRCLE : 0);
      shader_mask = shader_mask + ((this.opacity !== 1.0) ? enums.shader.map.ALPHA : 0);
      shader_mask = shader_mask + (this.color_map ? enums.shader.map.COLORMAP : 0);
      
      if(this.opacity !== 1.0) {
        this.blendEnabled = true;
      }
      
      return shader_mask;
    },

   getShaderHeader: function(light_type,light_count) {
      return ((light_count !== undef) ? ("#define LIGHT_COUNT "+light_count+"\n"):"") +
      "#define TEXTURE_COLOR " + ((typeof(this.textures[enums.texture.map.COLOR]) === 'object') ? 1 : 0) + 
      "\n#define TEXTURE_SPECULAR " + ((typeof(this.textures[enums.texture.map.SPECULAR]) === 'object') ? 1 : 0) + 
      "\n#define TEXTURE_NORMAL " + ((typeof(this.textures[enums.texture.map.NORMAL]) === 'object') ? 1 : 0) + 
      "\n#define TEXTURE_BUMP " + ((typeof(this.textures[enums.texture.map.BUMP]) === 'object') ? 1 : 0) + 
      "\n#define TEXTURE_REFLECT " + ((typeof(this.textures[enums.texture.map.REFLECT]) === 'object') ? 1 : 0) + 
      "\n#define TEXTURE_ENVSPHERE " + ((typeof(this.textures[enums.texture.map.ENVSPHERE]) === 'object') ? 1 : 0) + 
      "\n#define TEXTURE_AMBIENT " + ((typeof(this.textures[enums.texture.map.AMBIENT]) === 'object') ? 1 : 0) + 
      "\n#define TEXTURE_ALPHA " + ((typeof(this.textures[enums.texture.map.ALPHA]) === 'object') ? 1 : 0) + 
      "\n#define MATERIAL_ALPHA " + ((this.opacity !== 1.0) ? 1 : 0) + 
      "\n#define LIGHT_IS_POINT " + ((light_type === enums.light.type.POINT) ? 1 : 0) + 
      "\n#define LIGHT_IS_DIRECTIONAL " + ((light_type === enums.light.type.DIRECTIONAL) ? 1 : 0) + 
      "\n#define LIGHT_IS_SPOT " + (((light_type === enums.light.type.SPOT)||(light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)) ? 1 : 0) + 
      "\n#define LIGHT_SHADOWED " + (((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.AREA)) ? 1 : 0) + 
      "\n#define LIGHT_IS_PROJECTOR " + (((light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)) ? 1 : 0) + 
      "\n#define LIGHT_SHADOWED_SOFT " + (GLCore.soft_shadow?1:0) +
      "\n#define LIGHT_IS_AREA " + ((light_type === enums.light.type.AREA) ? 1 : 0) + 
      "\n#define LIGHT_DEPTH_PASS " + ((light_type === enums.light.type.DEPTH_PACK) ? 1 : 0) + 
      "\n#define FX_DEPTH_ALPHA " + (GLCore.depth_alpha ? 1 : 0) + 
      "\n#define VERTEX_MORPH " + (this.morph ? 1 : 0) + 
      "\n#define VERTEX_COLOR " + (this.color_map ? 1 : 0) + 
      "\n#define FOG_ENABLED " + ((GLCore.fog_enabled && !this.noFog) ? 1 : 0) + 
      "\n#define USE_FOG_EXP " + (GLCore.fogExp ? 1 : 0) + 
      "\n#define USE_FOG_LINEAR " + (GLCore.fogLinear ? 1 : 0) + 
      "\n#define LIGHT_PERPIXEL " + (base.features.lightPerPixel ? 1 : 0) + 
      "\n#define POINT_SPRITE " + (this.pointSprite ? 1 : 0) + 
      "\n#define POINT_SIZE " + (this.pointSize ? 1 : 0) + 
      "\n#define POINT_CIRCLE " + (this.pointCircle ? 1 : 0) + 
      "\n#define OES_STANDARD_DERIVATIVES " + (GLCore.extensions.standard_derivatives ? 1 : 0) +
      "\n\n";
    },


   bindObject: function(obj_in, light_shader) {
      var gl = GLCore.gl;
      
      var u = light_shader;
      var up = u.vertexPosition;
      var uv = u.vertexTexCoord; 
      var un = u.vertexNormal; 
      var uc = u.vertexColor; 

      gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_points);
      gl.vertexAttribPointer(up, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(up);

      if (uv !== undef && obj_in.compiled.gl_uvs!==null && uv !==-1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_uvs);
        gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(uv);
      } 
      renderBindState.uv = uv;

      if (un !== undef && obj_in.compiled.gl_normals!==null && un !==-1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_normals);
        gl.vertexAttribPointer(un, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(un);
      }
      renderBindState.un = un;

      if (uc !== undef && obj_in.compiled.gl_colors!==null && uc !==-1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_colors);
        gl.vertexAttribPointer(uc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(uc);
      }
      renderBindState.uc = uc;

      if (obj_in.morphTarget) {
        up = u.vertexMorphPosition;
    //    var uv = u.vertexTexCoord; 
        un = u.vertexMorphNormal; 

        gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.morphTarget.gl_points);
        gl.vertexAttribPointer(up, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(up);

    //    if (obj_in.compiled.gl_uvs!==null && uv !==-1) {
    //      gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_uvs);
    //      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
    //      gl.enableVertexAttribArray(uv);
    //    } 

        if (un !== undef && obj_in.morphTarget.gl_normals!==null && un !==-1) {
          gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.morphTarget.gl_normals);
          gl.vertexAttribPointer(un, 3, gl.FLOAT, false, 0, 0);
          gl.enableVertexAttribArray(un);
        }
        
        gl.uniform1f(u.materialMorphWeight,obj_in.morphWeight);
      }

      if (obj_in.compiled.unrolled) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      } else {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj_in.compiled.gl_elements);
      }
    },

    bindLines: function(obj_in, light_shader) {
        var gl = GLCore.gl;

        var u = light_shader;
        var up = u.vertexPosition;
        var uv = u.vertexTexCoord; 
        var un = u.vertexNormal; 
        var uc = u.vertexColor; 

        if (!obj_in.compiled.unrolled) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj_in.compiled.gl_line_elements);
        } else { // replaces existing point buffer..
//          this.clearObject(obj_in,light_shader);  
        
          gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_lines);
          gl.vertexAttribPointer(up, 3, gl.FLOAT, false, 0, 0);
          gl.enableVertexAttribArray(up);
          renderBindState.up = up;

          if (uv !== undef && obj_in.compiled.gl_line_uvs!==null && uv !==-1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_line_uvs);
            gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(uv);
          } 
          renderBindState.uv = uv;

          if (un !== undef && obj_in.compiled.gl_line_normals!==null && un !==-1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_line_normals);
            gl.vertexAttribPointer(un, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(un);
          }
          renderBindState.un = un;

          if (uc !== undef && obj_in.compiled.gl_line_colors!==null && uc !==-1) {
            gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_line_colors);
            gl.vertexAttribPointer(uc, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(uc);
          }
          renderBindState.uc = uc;
        }
        
        if (obj_in.morphTarget) {
            up = u.vertexMorphPosition;
        //    var uv = u.vertexTexCoord; 
            un = u.vertexMorphNormal; 

            gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.morphTarget.gl_lines);
            gl.vertexAttribPointer(up, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(up);

    //    if (obj_in.compiled.gl_uvs!==null && uv !==-1) {
    //      gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_uvs);
    //      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
    //      gl.enableVertexAttribArray(uv);
    //    } 

        if (un !== undef && obj_in.morphTarget.gl_line_normals!==null && un !==-1) {
          gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.morphTarget.gl_line_normals);
          gl.vertexAttribPointer(un, 3, gl.FLOAT, false, 0, 0);
          gl.enableVertexAttribArray(un);
        }
        
        gl.uniform1f(u.materialMorphWeight,obj_in.morphWeight);
      }
    },

   clearObject: function(obj_in,light_shader) {
      var gl = GLCore.gl;

      if (renderBindState.uv !== undef && renderBindState.uv !==-1) {
          gl.disableVertexAttribArray(renderBindState.uv);
      }

      if (renderBindState.un !== undef && renderBindState.un !==-1) {
          gl.disableVertexAttribArray(renderBindState.un);    
      }

      if (renderBindState.uc !== undef && renderBindState.uc !==-1) {
          gl.disableVertexAttribArray(renderBindState.uc);
      }

      var u = light_shader;

      if (obj_in.morphTarget && u) {
        up = u.vertexMorphPosition;
        gl.disableVertexAttribArray(up);    
    //    var uv = u.vertexTexCoord; 

        un = u.vertexMorphNormal; 
        if (un !== null && obj_in.compiled.gl_normals!==null && un !==-1) {
          gl.disableVertexAttribArray(un);    
        }
      }
    },

   use: function(light_type,num_lights) {
      var m;
      var gl = GLCore.gl;
      var thistex = this.textures;
      var success = true;

      num_lights = num_lights||0;
      light_type = light_type||0;
      
      if (!this.shader[light_type]) {
         this.shader[light_type] = [];
      }

      var sh = this.shader[light_type][num_lights];
      var noCustomDepthPack = this.customShader && light_type === enums.light.type.DEPTH_PACK && !this.customShader.hasDepthPack();

      if(sh && this.opacity !== 1.0 && this.blendEnabled !== true) 
      {
        this.dirtyFlag = true;
      }
      
      if(this.dirtyFlag === true)
          {
          sh = null;
          this.dirtyFlag = false;
          }

      if (!sh) {
        var smask = this.calcShaderMask(light_type);
        
        if (!this.customShader || noCustomDepthPack) {
          if (!base.ShaderPool[light_type][smask]) {
            base.ShaderPool[light_type][smask] = [];
          }
          
          sh = base.ShaderPool[light_type][smask][num_lights];
        }
        
        if (!sh) {
          var hdr = this.getShaderHeader(light_type,num_lights);
          var vs = hdr + GLCore.CoreShader_vs;
          var fs = hdr + GLCore.CoreShader_fs;

          
          if (this.customShader && !noCustomDepthPack) {
            if (!this.customShader._initialized) {
              this.customShader._init_shader(vs,fs,material_internal_vars);
              sh = this.customShader.getShader();
              if (!sh.isCompiled()) {
                success = false;
                sh = failSafeShader.getShader();  
              }
            }
          } else {
            sh = new base.Shader(vs, fs);
            if (!sh.isCompiled()) {
              success = false;
              sh = failSafeShader.getShader();                
            }
            base.ShaderPool[light_type][smask][num_lights] = sh;
          }
          m = 0;

          if (light_type !== enums.light.type.DEPTH_PACK) {
            if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.AREA)) {
              m+=num_lights;  // leave room for shadow map..
              if (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) {
                m+=num_lights; // leave room for projectors
              }              
            }
            
            if (typeof(thistex[enums.texture.map.COLOR]) === 'object') {
              sh.addInt("textureColor", m++);
            }
            if (typeof(thistex[enums.texture.map.ENVSPHERE]) === 'object') {
              sh.addInt("textureEnvSphere", m++);
            }
            if (typeof(thistex[enums.texture.map.NORMAL]) === 'object') {
              sh.addInt("textureNormal", m++);
            }
            if (typeof(thistex[enums.texture.map.BUMP]) === 'object') {
              sh.addInt("textureBump", m++);
            }
            if (typeof(thistex[enums.texture.map.REFLECT]) === 'object') {
              sh.addInt("textureReflect", m++);
            }
            if (typeof(thistex[enums.texture.map.SPECULAR]) === 'object') {
              sh.addInt("textureSpecular", m++);
            }
            if (typeof(thistex[enums.texture.map.AMBIENT]) === 'object') {
              sh.addInt("textureAmbient", m++);
            }
          }

          if (typeof(thistex[enums.texture.map.ALPHA]) === 'object') {
            sh.addInt("textureAlpha", m++);
          }

          sh.addMatrix("matrixModelView");
          sh.addMatrix("matrixProjection");
          sh.addMatrix("matrixObject");
          sh.addMatrix("matrixNormal");

          sh.addVertexArray("vertexPosition",0);
          sh.addVertexArray("vertexNormal");

          if (this.color_map) {
            sh.addVertexArray("vertexColor");
          }
          
          if (this.morph) {
            sh.addVertexArray("vertexMorphPosition");
            sh.addVertexArray("vertexMorphNormal");
            sh.addFloat("materialMorphWeight",0.0);
          }


          for (var mLight = 0; mLight < num_lights; mLight++) {
            sh.addVector("lightDiffuse["+mLight+"]");
            sh.addVector("lightSpecular["+mLight+"]");
            sh.addFloat("lightIntensity["+mLight+"]");
            sh.addFloat("lightDistance["+mLight+"]");
            sh.addVector("lightPosition["+mLight+"]");
            sh.addVector("lightDirection["+mLight+"]");
            if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.SPOT)) {
              sh.addFloat("lightCutOffAngle["+mLight+"]");
            }
            if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.AREA)) {
              sh.addInt("lightShadowMap["+mLight+"]");
              if (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) {
              sh.addInt("lightProjectionMap["+mLight+"]");
              }
              sh.addVector("lightDepthClip["+mLight+"]");
              sh.addMatrix("lightShadowMatrix["+mLight+"]");
            }
          }

          if (light_type !== enums.light.type.DEPTH_PACK) {  // not needed for depth packing stage

            sh.addVector("lightAmbient");
            sh.addVector("materialDiffuse");
            sh.addVector("materialColor");
            sh.addVector("materialAmbient");
            sh.addVector("materialSpecular");
            sh.addFloat("materialShininess");
            sh.addFloat("materialEnvironment");
            
          } // !DEPTH_PACK

          sh.addFloat("materialAlpha");      
          
          if (GLCore.depth_alpha || (light_type === enums.light.type.DEPTH_PACK) || (light_type === enums.light.type.SPOT_SHADOW) || (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) || (light_type === enums.light.type.AREA)) {
            sh.addVector("postDepthInfo");
          }

          sh.addUVArray("vertexTexCoord");
          sh.addVector("materialTexOffset");
          if (GLCore.fog_enabled && !this.noFog) {
            sh.addVector("fogColor",GLCore.fogColor);
            sh.addFloat("fogDensity",GLCore.fogDensity);
            sh.addFloat("fogNear",GLCore.fogNear);
            sh.addFloat("fogFar",GLCore.fogFar);
          }
          
          if (this.pointSprite||this.pointSize) {
            sh.addFloat("pointSize",1.0);
            if (this.pointSize&&!this.pointSprite) {
                sh.addVector("viewPort");
            }
          }
        }
        
        this.shader[light_type][num_lights] = sh;

        sh.use();

        if (sh.materialTexOffset != -1) gl.uniform2fv(sh.materialTexOffset, [0,0]);
      } else {
        success = (sh !== failSafeShader);
        sh.use();
      }


      m = 0;
      var t;
      
      if (light_type !== enums.light.type.DEPTH_PACK) {
      
        if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.AREA)) {
          m+=num_lights;  // leave room for shadow map..
          if (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) {  // projector texture reserved
            m+=num_lights;
          }
        }

        if (!!(t = thistex[enums.texture.map.COLOR])) {
          t.use(GLCore.gl.TEXTURE0+m); m++;
        }
        if (!!(t = thistex[enums.texture.map.ENVSPHERE])) {
          t.use(GLCore.gl.TEXTURE0+m); m++;
          gl.uniform1f(sh.materialEnvironment,this.env_amount);
        }
        if (!!(t = thistex[enums.texture.map.NORMAL])) {
          t.use(GLCore.gl.TEXTURE0+m); m++;
        }
        if (!!(t = thistex[enums.texture.map.BUMP])) {
          t.use(GLCore.gl.TEXTURE0+m); m++;
        }
        if (!!(t = thistex[enums.texture.map.REFLECT])) {
          t.use(GLCore.gl.TEXTURE0+m); m++;
        }
        if (!!(t = thistex[enums.texture.map.SPECULAR])) {
          t.use(GLCore.gl.TEXTURE0+m); m++;
        }
        if (!!(t = thistex[enums.texture.map.AMBIENT])) {
          t.use(GLCore.gl.TEXTURE0+m); m++;
        }
      }

      if (!!(t = thistex[enums.texture.map.ALPHA])) {
        t.use(GLCore.gl.TEXTURE0+m); m++;
      }

      if (GLCore.fog_enabled && !this.noFog) {
        gl.uniform3fv(sh.fogColor,GLCore.fogColor);
        gl.uniform1f(sh.fogDensity,GLCore.fogDensity);
        gl.uniform1f(sh.fogNear,GLCore.fogNear);
        gl.uniform1f(sh.fogFar,GLCore.fogFar);
      }


      if (light_type !== enums.light.type.DEPTH_PACK) {  
        gl.uniform3fv(sh.materialColor,this.color);
        gl.uniform3fv(sh.materialDiffuse,this.diffuse);
        gl.uniform3fv(sh.materialAmbient,this.ambient);
        gl.uniform3fv(sh.materialSpecular,this.specular);
        gl.uniform1f(sh.materialShininess,this.shininess*128.0);
        gl.uniform3fv(sh.lightAmbient, base.globalAmbient);
      
        if (this.opacity < 1.0) {
          gl.uniform1f(sh.materialAlpha, this.opacity);
        }
        
        if (GLCore.depth_alpha || (light_type === enums.light.type.SPOT_SHADOW) ||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) || (light_type === enums.light.type.AREA)) {
          gl.uniform3fv(sh.postDepthInfo, [GLCore.depth_alpha_near, GLCore.depth_alpha_far, 0.0]);
        }
      }
      else { // Depth Pack
        gl.uniform3fv(sh.postDepthInfo, [GLCore.shadow_near, GLCore.shadow_far, 0.0]);
      }

      if (sh.materialTexOffset) gl.uniform2fv(sh.materialTexOffset, this.uvOffset);

      if (this.pointSprite||this.pointSize) {
        gl.uniform1f(sh.pointSize, this.pointSize);
        if (!this.pointSprite) {
            gl.uniform3fv(sh.viewPort, [GLCore.viewportWidth, GLCore.viewportHeight, 0.0]);
        }
      }
      
      if (this.customShader) {
          if (light_type !== enums.light.type.DEPTH_PACK || (light_type === enums.light.type.DEPTH_PACK && !noCustomDepthPack)) {
              this.customShader._doUpdate({material:this,textureIndex:m});
          }
      }

      return success;
    }
  };
  
  var extend = {
    Material: Material
  };

  return extend;
});
