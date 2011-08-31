
CubicVR.RegisterModule("Material", function(base) {
  var undef = base.undef;
  var GLCore = base.GLCore;
  var enums = CubicVR.enums;
 
  /* Materials */
  function Material(obj_init) {
    this.initialized = false;
    this.textures = [];
    this.shader = [];
    this.customShader = null;

    obj_init = obj_init||{};

    this.diffuse = obj_init.diffuse||[1.0, 1.0, 1.0];
    this.specular = obj_init.specular||[0.1, 0.1, 0.1];
    this.color = obj_init.color||[1, 1, 1];
    this.ambient = obj_init.ambient||[0, 0, 0];
    this.name = obj_init.name||null;

    this.opacity = (obj_init.opacity===undef)?1.0:obj_init.opacity;
    this.shininess = (obj_init.shininess===undef)?1.0:obj_init.shininess;
    this.max_smooth = (obj_init.max_smooth===undef)?60.0:obj_init.max_smooth;
    this.env_amount = (obj_init.env_amount===undef)?0.75:obj_init.env_amount;
    this.morph = (obj_init.morph===undef)?false:obj_init.morph;
    this.color_map = (obj_init.colorMap===undef)?false:obj_init.colorMap;
    this.uvOffset = (obj_init.uvOffset===undef)?null:obj_init.uvOffset;

    if (obj_init.textures) {
        if (obj_init.textures.color) this.setTexture(obj_init.textures.color,enums.texture.map.COLOR);
        if (obj_init.textures.envsphere) this.setTexture(obj_init.textures.envsphere,enums.texture.map.ENVSPHERE);
        if (obj_init.textures.normal) this.setTexture(obj_init.textures.normal,enums.texture.map.NORMAL);
        if (obj_init.textures.bump) this.setTexture(obj_init.textures.bump,enums.texture.map.BUMP);
        if (obj_init.textures.reflect) this.setTexture(obj_init.textures.reflect,enums.texture.map.REFLECT);
        if (obj_init.textures.specular) this.setTexture(obj_init.textures.specular,enums.texture.map.SPECULAR);
        if (obj_init.textures.ambient) this.setTexture(obj_init.textures.ambient,enums.texture.map.AMBIENT);
        if (obj_init.textures.alpha) this.setTexture(obj_init.textures.alpha,enums.texture.map.ALPHA);
    }
  }

  
  var basicTex = [enums.texture.map.REFLECT,
               enums.texture.map.SPECULAR,
               enums.texture.map.NORMAL,
               enums.texture.map.BUMP];


  Material.prototype = {
     clone: function() {
     
       var newMat = new CubicVR.Material({
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
           name: this.name
       });
       
       for (var i in this.textures) {
        newMat.setTexture(this.textures[i],i);
       }
       
       return newMat;
     },
     
     setTexture: function(tex, tex_type) {
      if (tex_type === undef) {
        tex_type = 0;
      }

      if (!base.features.texturePerPixel) {
        if (basicTex.indexOf(tex_type)!==-1) {
          return;
        }
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
      shader_mask = shader_mask + ((this.opacity !== 1.0) ? enums.shader.map.ALPHA : 0);
      shader_mask = shader_mask + (this.color_map ? enums.shader.map.COLORMAP : 0);
      

      return shader_mask;
    },

   getShaderHeader: function(light_type,light_count) {
      return ((light_count !== undef) ? ("#define loopCount "+light_count+"\n"):"") +
      "#define hasColorMap " + ((typeof(this.textures[enums.texture.map.COLOR]) === 'object') ? 1 : 0) + 
      "\n#define hasSpecularMap " + ((typeof(this.textures[enums.texture.map.SPECULAR]) === 'object') ? 1 : 0) + 
      "\n#define hasNormalMap " + ((typeof(this.textures[enums.texture.map.NORMAL]) === 'object') ? 1 : 0) + 
      "\n#define hasBumpMap " + ((typeof(this.textures[enums.texture.map.BUMP]) === 'object') ? 1 : 0) + 
      "\n#define hasReflectMap " + ((typeof(this.textures[enums.texture.map.REFLECT]) === 'object') ? 1 : 0) + 
      "\n#define hasEnvSphereMap " + ((typeof(this.textures[enums.texture.map.ENVSPHERE]) === 'object') ? 1 : 0) + 
      "\n#define hasAmbientMap " + ((typeof(this.textures[enums.texture.map.AMBIENT]) === 'object') ? 1 : 0) + 
      "\n#define hasAlphaMap " + ((typeof(this.textures[enums.texture.map.ALPHA]) === 'object') ? 1 : 0) + 
      "\n#define hasAlpha " + ((this.opacity !== 1.0) ? 1 : 0) + 
      "\n#define lightPoint " + ((light_type === enums.light.type.POINT) ? 1 : 0) + 
      "\n#define lightDirectional " + ((light_type === enums.light.type.DIRECTIONAL) ? 1 : 0) + 
      "\n#define lightSpot " + (((light_type === enums.light.type.SPOT)||(light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)) ? 1 : 0) + 
      "\n#define hasShadow " + (((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.AREA)) ? 1 : 0) + 
      "\n#define hasProjector " + (((light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)) ? 1 : 0) + 
      "\n#define softShadow " + (GLCore.soft_shadow?1:0) +
      "\n#define lightArea " + ((light_type === enums.light.type.AREA) ? 1 : 0) + 
      "\n#define depthPack " + ((light_type === enums.light.type.DEPTH_PACK) ? 1 : 0) + 
      "\n#define alphaDepth " + (GLCore.depth_alpha ? 1 : 0) + 
      "\n#define hasMorph " + (this.morph ? 1 : 0) + 
      "\n#define hasVertexColorMap " + (this.color_map ? 1 : 0) + 
      "\n#define perPixel " + (base.features.lightPerPixel ? 1 : 0) + 
      "\n\n";
    },

   bindObject: function(obj_in, light_shader) {
      var gl = GLCore.gl;
      
      var u = light_shader;
      var up = u.aVertexPosition;
      var uv = u.aTextureCoord; 
      var un = u.aNormal; 
      var uc = u.aColor; 

      gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_points);
      gl.vertexAttribPointer(up, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(up);

      if (uv !== null && obj_in.compiled.gl_uvs!==null && uv !==-1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_uvs);
        gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(uv);
      } 

      if (un !== null && obj_in.compiled.gl_normals!==null && un !==-1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_normals);
        gl.vertexAttribPointer(un, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(un);
      }

      if (uc !== null && obj_in.compiled.gl_colors!==null && uc !==-1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_colors);
        gl.vertexAttribPointer(uc, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(uc);
      }

      if (obj_in.morphTarget) {
        up = u.amVertexPosition;
    //    var uv = u.aTextureCoord; 
        un = u.amNormal; 

        gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.morphTarget.gl_points);
        gl.vertexAttribPointer(up, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(up);

    //    if (obj_in.compiled.gl_uvs!==null && uv !==-1) {
    //      gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.compiled.gl_uvs);
    //      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
    //      gl.enableVertexAttribArray(uv);
    //    } 

        if (un !== null && obj_in.morphTarget.gl_normals!==null && un !==-1) {
          gl.bindBuffer(gl.ARRAY_BUFFER, obj_in.morphTarget.gl_normals);
          gl.vertexAttribPointer(un, 3, gl.FLOAT, false, 0, 0);
          gl.enableVertexAttribArray(un);
        }
        
        gl.uniform1f(u.morphWeight,obj_in.morphWeight);
      }

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj_in.compiled.gl_elements);
    },

   clearObject: function(obj_in,light_shader) {
      var gl = GLCore.gl;

      var u = light_shader;
      var uv = u.aTextureCoord; 
      var un = u.aNormal; 
      var uc = u.aColor; 
      
      if (uv !== null && obj_in.compiled.gl_uvs!==null && uv !==-1) {
          gl.disableVertexAttribArray(uv);
      }

      if (un !== null && obj_in.compiled.gl_normals!==null && un !==-1) {
          gl.disableVertexAttribArray(un);    
      }

      if (uc !== null && obj_in.compiled.gl_colors!==null && uc !==-1) {
          gl.disableVertexAttribArray(uc);
      }

      if (obj_in.morphTarget) {
        up = u.amVertexPosition;
        gl.disableVertexAttribArray(up);    

    //    var uv = u.aTextureCoord; 

        un = u.amNormal; 
        if (un !== null && obj_in.compiled.gl_normals!==null && un !==-1) {
          gl.disableVertexAttribArray(un);    
        }
      }
    },

   use: function(light_type,num_lights) {
      var m;
      var gl = GLCore.gl;
      var thistex = this.textures;

      num_lights = num_lights||0;
      light_type = light_type||0;
      
      if (this.customShader) {
          this.customShader.use(light_type,num_lights);
        return;
      }
      
      if (!this.shader[light_type]) {
         this.shader[light_type] = [];
      }

      var sh = this.shader[light_type][num_lights];

      if (!sh) {
        var smask = this.calcShaderMask(light_type);
        
        if (!base.ShaderPool[light_type][smask]) {
          base.ShaderPool[light_type][smask] = [];
        }
        
        sh = base.ShaderPool[light_type][smask][num_lights];
        
        if (!sh) {
          var hdr = this.getShaderHeader(light_type,num_lights);
          var vs = hdr + GLCore.CoreShader_vs;
          var fs = hdr + GLCore.CoreShader_fs;

          sh = new CubicVR.Shader(vs, fs);
          
          base.ShaderPool[light_type][smask][num_lights] = sh;
          
          m = 0;

          if (light_type !== enums.light.type.DEPTH_PACK) {
            if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.AREA)) {
              m+=num_lights;  // leave room for shadow map..
              if (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) {
                m+=num_lights; // leave room for projectors
              }              
            }
            
            if (typeof(thistex[enums.texture.map.COLOR]) === 'object') {
              sh.addInt("colorMap", m++);
            }
            if (typeof(thistex[enums.texture.map.ENVSPHERE]) === 'object') {
              sh.addInt("envSphereMap", m++);
            }
            if (typeof(thistex[enums.texture.map.NORMAL]) === 'object') {
              sh.addInt("normalMap", m++);
            }
            if (typeof(thistex[enums.texture.map.BUMP]) === 'object') {
              sh.addInt("bumpMap", m++);
            }
            if (typeof(thistex[enums.texture.map.REFLECT]) === 'object') {
              sh.addInt("reflectMap", m++);
            }
            if (typeof(thistex[enums.texture.map.SPECULAR]) === 'object') {
              sh.addInt("specularMap", m++);
            }
            if (typeof(thistex[enums.texture.map.AMBIENT]) === 'object') {
              sh.addInt("ambientMap", m++);
            }
          }

          if (typeof(thistex[enums.texture.map.ALPHA]) === 'object') {
            sh.addInt("alphaMap", m++);
          }

          sh.addMatrix("uMVMatrix");
          sh.addMatrix("uPMatrix");
          sh.addMatrix("uOMatrix");
          sh.addMatrix("uNMatrix");

          sh.addVertexArray("aVertexPosition");
          sh.addVertexArray("aNormal");

          if (this.color_map) {
            sh.addVertexArray("aColor");
          }
          
          if (this.morph) {
            sh.addVertexArray("amVertexPosition");
            sh.addVertexArray("amNormal");
            sh.addFloat("morphWeight",0.0);
          }


          for (var mLight = 0; mLight < num_lights; mLight++) {
            sh.addVector("lDiff["+mLight+"]");
            sh.addVector("lSpec["+mLight+"]");
            sh.addFloat("lInt["+mLight+"]");
            sh.addFloat("lDist["+mLight+"]");
            sh.addVector("lPos["+mLight+"]");
            sh.addVector("lDir["+mLight+"]");
            if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.SPOT)) {
              sh.addFloat("lCut["+mLight+"]");
            }
            if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.AREA)) {
              sh.addInt("lDepthTex["+mLight+"]");
              if (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) {
              sh.addInt("lProjTex["+mLight+"]");
              }
              sh.addVector("lDepth["+mLight+"]");
              sh.addMatrix("spMatrix["+mLight+"]");
            }
          }

          if (light_type !== enums.light.type.DEPTH_PACK) {  // not needed for depth packing stage

            sh.addVector("lAmb");
            sh.addVector("mDiff");
            sh.addVector("mColor");
            sh.addVector("mAmb");
            sh.addVector("mSpec");
            sh.addFloat("mShine");
            sh.addFloat("envAmount");
            
          } // !DEPTH_PACK

          sh.addFloat("mAlpha");      
          
          if (GLCore.depth_alpha || (light_type === enums.light.type.DEPTH_PACK) || (light_type === enums.light.type.SPOT_SHADOW) || (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) || (light_type === enums.light.type.AREA)) {
            sh.addVector("depthInfo");
          }

          sh.addUVArray("aTextureCoord");
          sh.addVector("uTexOffset");
        }
        
        this.shader[light_type][num_lights] = sh;

        sh.use();

        if (sh.uTexOffset != -1) gl.uniform2fv(sh.uTexOffset, [0,0]);
        
      } else {
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
          gl.uniform1f(sh.envAmount,this.env_amount);
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

      if (light_type !== enums.light.type.DEPTH_PACK) {  
        gl.uniform3fv(sh.mColor,this.color);
        gl.uniform3fv(sh.mDiff,this.diffuse);
        gl.uniform3fv(sh.mAmb,this.ambient);
        gl.uniform3fv(sh.mSpec,this.specular);
        gl.uniform1f(sh.mShine,this.shininess*128.0);
        gl.uniform3fv(sh.lAmb, CubicVR.globalAmbient);
      
        if (this.opacity !== 1.0) {
          gl.uniform1f(sh.mAlpha, this.opacity);
        }

        if (GLCore.depth_alpha || (light_type === enums.light.type.SPOT_SHADOW) ||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) || (light_type === enums.light.type.AREA)) {
          gl.uniform3fv(sh.depthInfo, [GLCore.depth_alpha_near, GLCore.depth_alpha_far, 0.0]);
        }
      }
      else { // Depth Pack
        gl.uniform3fv(sh.depthInfo, [GLCore.shadow_near, GLCore.shadow_far, 0.0]);
      }

      if (this.uvOffset) gl.uniform2fv(sh.uTexOffset, this.uvOffset);
    }
  };
  
  var extend = {
    Material: Material
  };

  return extend;
});
