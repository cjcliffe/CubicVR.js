
CubicVR.RegisterModule("Material", function(base) {
  var undef = base.undef;
  var GLCore = base.GLCore;
  var enums = CubicVR.enums;
  

  /* Materials */
  function Material(mat_name) {
  //  this.material_id = -1;

    /*
    if (mat_name !== undef) {
      var old_mat = Material_ref[mat_name];
      if (old_mat) {
        var old_id = old_mat.material_id;
        Materials[old_id] = this;
        old_mat = null;
      } //if
      Material_ref[mat_name] = this;
    }
    */

    //if (this.material_id === -1) {
  //    this.material_id = Materials.length;
  //    Materials.push(this);
    //} //if

    this.initialized = false;
    this.textures = [];
    this.shader = [];
    this.customShader = null;

    if (typeof(mat_name)==='object') {
      this.diffuse = (mat_name.diffuse===undef)?[1.0, 1.0, 1.0]:mat_name.diffuse;
      this.specular = (mat_name.specular===undef)?[0.1, 0.1, 0.1]:mat_name.specular;
      this.color = (mat_name.color===undef)?[1, 1, 1]:mat_name.color;
      this.ambient = (mat_name.ambient===undef)?[0, 0, 0]:mat_name.ambient;
      this.opacity = (mat_name.opacity===undef)?1.0:mat_name.opacity;
      this.shininess = (mat_name.shininess===undef)?1.0:mat_name.shininess;
      this.max_smooth = (mat_name.max_smooth===undef)?60.0:mat_name.max_smooth;
      this.env_amount = (mat_name.env_amount===undef)?0.75:mat_name.env_amount;
      this.morph = (mat_name.morph===undef)?false:mat_name.morph;
      this.color_map = (mat_name.colorMap===undef)?false:mat_name.colorMap;
      this.name = (mat_name.name===undef)?undef:mat_name.name;

      if (typeof(mat_name.textures)==='object') {
        if (mat_name.textures.color!==undef) this.setTexture(mat_name.textures.color,enums.texture.map.COLOR);
        if (mat_name.textures.envsphere!==undef) this.setTexture(mat_name.textures.envsphere,enums.texture.map.ENVSPHERE);
        if (mat_name.textures.normal!==undef) this.setTexture(mat_name.textures.normal,enums.texture.map.NORMAL);
        if (mat_name.textures.bump!==undef) this.setTexture(mat_name.textures.bump,enums.texture.map.BUMP);
        if (mat_name.textures.reflect!==undef) this.setTexture(mat_name.textures.reflect,enums.texture.map.REFLECT);
        if (mat_name.textures.specular!==undef) this.setTexture(mat_name.textures.specular,enums.texture.map.SPECULAR);
        if (mat_name.textures.ambient!==undef) this.setTexture(mat_name.textures.ambient,enums.texture.map.AMBIENT);
        if (mat_name.textures.alpha!==undef) this.setTexture(mat_name.textures.alpha,enums.texture.map.ALPHA);
      }
    } else {
      this.diffuse = [1.0, 1.0, 1.0];
      this.specular = [0.1, 0.1, 0.1];
      this.color = [1, 1, 1];
      this.ambient = [0, 0, 0];
      this.opacity = 1.0;
      this.shininess = 1.0;
      this.max_smooth = 60.0;
      this.name = mat_name;
      this.morph = false;
      this.color_map = false;
    }

  }

  Material.prototype = {
     setTexture: function(tex, tex_type) {
      if (tex_type === undef) {
        tex_type = 0;
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
      if (num_lights === undef) {
        num_lights = 0;
      }
      
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
         this.shader[light_type] = [];
      }

      if (this.shader[light_type][num_lights] === undef) {
        
        var smask = this.calcShaderMask(light_type);
        
        if (base.ShaderPool[light_type][smask] === undef) {
          base.ShaderPool[light_type][smask] = [];
        }
        
        if (base.ShaderPool[light_type][smask][num_lights] === undef) {
          var hdr = this.getShaderHeader(light_type,num_lights);
          var vs = hdr + GLCore.CoreShader_vs;
          var fs = hdr + GLCore.CoreShader_fs;

          var l = new CubicVR.Shader(vs, fs);
          
          base.ShaderPool[light_type][smask][num_lights] = l;
          
          m = 0;

          if (light_type !== enums.light.type.DEPTH_PACK) {
            if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.AREA)) {
              m+=num_lights;  // leave room for shadow map..
              if (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) {
                m+=num_lights; // leave room for projectors
              }              
            }
            
            if (typeof(thistex[enums.texture.map.COLOR]) === 'object') {
              l.addInt("colorMap", m++);
            }
            if (typeof(thistex[enums.texture.map.ENVSPHERE]) === 'object') {
              l.addInt("envSphereMap", m++);
            }
            if (typeof(thistex[enums.texture.map.NORMAL]) === 'object') {
              l.addInt("normalMap", m++);
            }
            if (typeof(thistex[enums.texture.map.BUMP]) === 'object') {
              l.addInt("bumpMap", m++);
            }
            if (typeof(thistex[enums.texture.map.REFLECT]) === 'object') {
              l.addInt("reflectMap", m++);
            }
            if (typeof(thistex[enums.texture.map.SPECULAR]) === 'object') {
              l.addInt("specularMap", m++);
            }
            if (typeof(thistex[enums.texture.map.AMBIENT]) === 'object') {
              l.addInt("ambientMap", m++);
            }
          }

          if (typeof(thistex[enums.texture.map.ALPHA]) === 'object') {
            l.addInt("alphaMap", m++);
          }

          l.addMatrix("uMVMatrix");
          l.addMatrix("uPMatrix");
          l.addMatrix("uOMatrix");
          l.addMatrix("uNMatrix");

          l.addVertexArray("aVertexPosition");
          l.addVertexArray("aNormal");

          if (this.color_map) {
            l.addVertexArray("aColor");
          }
          
          if (this.morph) {
            l.addVertexArray("amVertexPosition");
            l.addVertexArray("amNormal");
            l.addFloat("morphWeight",0.0);
          }


          for (var mLight = 0; mLight < num_lights; mLight++) {
            l.addVector("lDiff["+mLight+"]");
            l.addVector("lSpec["+mLight+"]");
            l.addFloat("lInt["+mLight+"]");
            l.addFloat("lDist["+mLight+"]");
            l.addVector("lPos["+mLight+"]");
            l.addVector("lDir["+mLight+"]");
            if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.SPOT)) {
              l.addFloat("lCut["+mLight+"]");
            }
            if ((light_type === enums.light.type.SPOT_SHADOW)||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR)||(light_type === enums.light.type.AREA)) {
              l.addInt("lDepthTex["+mLight+"]");
              if (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) {
              l.addInt("lProjTex["+mLight+"]");
              }
              l.addVector("lDepth["+mLight+"]");
              l.addMatrix("spMatrix["+mLight+"]");
            }
          }

          if (light_type !== enums.light.type.DEPTH_PACK) {  // not needed for depth packing stage

            l.addVector("lAmb");
            l.addVector("mDiff");
            l.addVector("mColor");
            l.addVector("mAmb");
            l.addVector("mSpec");
            l.addFloat("mShine");
            l.addFloat("envAmount");
            
          } // !DEPTH_PACK

          l.addFloat("mAlpha");      
          
          if (GLCore.depth_alpha || (light_type === enums.light.type.DEPTH_PACK) || (light_type === enums.light.type.SPOT_SHADOW) || (light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) || (light_type === enums.light.type.AREA)) {
            l.addVector("depthInfo");
          }

          l.addUVArray("aTextureCoord");
        }
        
        this.shader[light_type][num_lights] = base.ShaderPool[light_type][smask][num_lights];
      }

      var sh = this.shader[light_type][num_lights];
      var gl = GLCore.gl;

      sh.use();

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
          // sh.setFloat("envAmount", this.env_amount);
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

      // sh.setVector("mColor", this.color);
      // sh.setVector("mDiff", this.diffuse);
      // sh.setVector("mAmb", this.ambient);
      // sh.setVector("mSpec", this.specular);
      // sh.setFloat("mShine", this.shininess);
      // sh.setVector("lAmb", CubicVR.globalAmbient);

      if (light_type !== enums.light.type.DEPTH_PACK) {  
        gl.uniform3fv(sh.mColor,this.color);
        gl.uniform3fv(sh.mDiff,this.diffuse);
        gl.uniform3fv(sh.mAmb,this.ambient);
        gl.uniform3fv(sh.mSpec,this.specular);
        gl.uniform1f(sh.mShine,this.shininess*128.0);
        gl.uniform3fv(sh.lAmb, CubicVR.globalAmbient);
      

        if (GLCore.depth_alpha || (light_type === enums.light.type.SPOT_SHADOW) ||(light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) || (light_type === enums.light.type.AREA)) {
          //sh.setVector("depthInfo", [GLCore.depth_alpha_near, GLCore.depth_alpha_far, 0.0]);
          gl.uniform3fv(sh.depthInfo, [GLCore.depth_alpha_near, GLCore.depth_alpha_far, 0.0]);
        }
      }
      else { // Depth Pack
        gl.uniform3fv(sh.depthInfo, [GLCore.shadow_near, GLCore.shadow_far, 0.0]);
      }
      
      if (this.opacity !== 1.0) {
        gl.uniform1f(sh.mAlpha, this.opacity);
      }
    }
  };
  
  var extend = {
    Material: Material
  };

  return extend;
});
