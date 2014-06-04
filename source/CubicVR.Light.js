CubicVR.RegisterModule("Light", function (base) {
    /*jshint es5:true */
    var GLCore = base.GLCore;
    var enums = base.enums;
    var undef = base.undef;
    var util = base.util;

    var cubicvr_identity = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];

    // Light Types
    enums.light = {
        type: {
            NULL: 0,
            POINT: 1,
            DIRECTIONAL: 2,
            SPOT: 3,
            AREA: 4,
            DEPTH_PACK: 5,
            // this lets us pass the shadow stage in as a light definition
            SPOT_SHADOW: 6,
            SPOT_SHADOW_PROJECTOR: 7,
            MAX: 8
        },
        method: {
            GLOBAL: 0,
            STATIC: 1,
            DYNAMIC: 2
        }
    };


    function Light(light_type) {
        var mat4 = base.mat4;
        var aabbMath = base.aabb;
        
        light_type = base.get(light_type) || {};
        
        if (light_type === undef) {
            light_type = enums.light.type.POINT;
        }
        
        // if (lighting_method === undef) {
        //     lighting_method = enums.light.method.DYNAMIC;
        // }

        if (typeof (light_type) == 'object') {
            this.light_type = (light_type.type !== undef) ? base.parseEnum(enums.light.type,light_type.type) : enums.light.type.POINT;
            this.diffuse = (light_type.diffuse !== undef) ? light_type.diffuse : [1, 1, 1];
            this.specular = (light_type.specular !== undef) ? light_type.specular : [1.0, 1.0, 1.0];
            this.intensity = (light_type.intensity !== undef) ? light_type.intensity : 1.0;
            this.position = (light_type.position !== undef) ? light_type.position : [0, 0, 0];
            this.direction = (light_type.direction !== undef) ? light_type.direction : [0, 0, 0];
            this.distance = (light_type.distance !== undef) ? light_type.distance : ((this.light_type === enums.light.type.AREA) ? 30 : 10);
            this.cutoff = (light_type.cutoff !== undef) ? light_type.cutoff : 60;
            this.map_res = (light_type.map_res !== undef) ? light_type.map_res : (this.light_type === enums.light.type.AREA) ? 2048 : 512;
            this.map_res = (light_type.mapRes !== undef) ? light_type.mapRes : this.map_res;
            // this.method = (light_type.method !== undef) ? base.parseEnum(enums.light.method,light_type.method) : lighting_method;
            this.areaCam = (light_type.areaCam !== undef) ? light_type.areaCam : null;
            this.areaCeiling = (light_type.areaCeiling !== undef) ? light_type.areaCeiling : 40;
            this.areaFloor = (light_type.areaFloor !== undef) ? light_type.areaFloor : -40;
            this.areaAxis = (light_type.areaAxis !== undef) ? light_type.areaAxis : [1, 1, 0];
            this.projectorTex = (light_type.projector !== undef) ? light_type.projector : null;
            this.target = (light_type.target||null);
            this.static = light_type.static||false;
     } else {
            this.light_type = base.parseEnum(enums.light.type,light_type);
            this.diffuse = [1, 1, 1];
            this.specular = [1.0, 1.0, 1.0];
            this.intensity = 1.0;
            this.position = [0, 0, 0];
            this.direction = [0, 0, 0];
            this.distance = ((this.light_type === enums.light.type.AREA) ? 30 : 10);
            this.cutoff = 60;
            this.map_res = (this.light_type === enums.light.type.AREA) ? 2048 : 512;
            // this.method = base.parseEnum(enums.light.method,lighting_method);
            this.areaCam = null;
            this.areaCeiling = 40;
            this.areaFloor = -40;
            this.areaAxis = [1, 1, 0];
            this.projectorTex = null;
            this.target = (light_type.target||null);
        }

        if (this.projectorTex && typeof(this.projectorTex) === "string") {
             var tex = this.projectorTex;
             this.projectorTex = (base.Textures_ref[tex] !== undef) ? base.Textures_obj[base.Textures_ref[tex]] : (new base.Texture(tex));
        }

        this.setType(this.light_type);

        this.dirty = true;
        this.motion = null;
        this.rotation = [0, 0, 0];
        this.lposition = [0, 0, 0];
        this.lrotation = [0, 0, 0];
        this.ldist = 0;
        this.renderTag = -1;

        if ((this.light_type === enums.light.type.SPOT_SHADOW || this.light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) || this.light_type === enums.light.type.AREA && base.features.lightShadows) {
            this.setShadow(this.map_res);
        }

        // modelview / normalmatrix transform outputs
        this.lDir = [0, 0, 0];
        this.lPos = [0, 0, 0];
        this.parent = null;
    }

    Light.prototype = {
        get x(){
            return this.position[0];
        },
        set x(value){
            this.position[0] = value;
        },
        get y(){
            return this.position[1];
        },
        set y(value){
            this.position[1] = value;
        },
        get z(){
            return this.position[2];
        },
        set z(value){
            this.position[2] = value;
        },
        get rotX(){
            return this.rotation[0];
        },
        set rotX(value){
            this.rotation[0] = value;
        },
        get rotY(){
            return this.rotation[1];
        },
        set rotY(value){
            this.rotation[1] = value;
        },
        get rotZ(){
            return this.rotation[2];
        },
        set rotZ(value){
            this.rotation[2] = value;
        },
        get dirX(){
            return this.direction[0];
        },
        set dirX(value){
            this.direction[0] = value;
        },
        get dirY(){
            return this.direction[1];
        },
        set dirY(value){
            this.direction[1] = value;
        },
        get dirZ(){
            return this.direction[2];
        },
        set dirZ(value){
            this.direction[2] = value;
        },
        get pos(){
            return this.position.slice(0);
        },        
        set pos(value){
            this.position = value.slice(0);
        },
        get rot(){
            return this.rotation.slice(0);
        },        
        set rot(value){
            this.rotation = value.slice(0);
        },
        get dir(){
            return this.direction.slice(0);
        },        
        set dir(value){
            this.direction = base.vec3.normalize(value.slice(0));
        },
        setType: function (light_type) {
            if (light_type === enums.light.type.AREA && !base.features.lightShadows) {
                this.dummyCam = new base.Camera();
                this.areaCam = new base.Camera();
                
                this.updateAreaLight();
                
                this.dummyCam = null;
                this.areaCam = null;
                light_type = enums.light.type.DIRECTIONAL;
            } else if ((light_type === enums.light.type.SPOT_SHADOW || light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) && !base.features.lightShadows) {
                light_type = enums.light.type.SPOT;
            }
            this.light_type = light_type;
        },

        doTransform: function() {
          if (this.distance != this.ldistance || !base.vec3.equal(this.position,this.lposition) || !base.vec3.equal(this.rotation,this.lrotation)) {
            this.lposition = this.rotation.slice(0);
            this.lrotation = this.position.slice(0);
            this.ldist = this.distance;
            this.dirty = true;
          }
        },

        setParent: function(lParent) {
            this.parent = lParent;
        },

        setMethod: function (method) {
            this.method = method;
        },

        setDiffuse: function (diffuse) {
            this.diffuse = diffuse;
        },

        setSpecular: function (specular) {
            this.specular = specular;
        },

        setIntensity: function (intensity) {
            this.intensity = intensity;
        },

        setPosition: function (position) {
            this.position = position;
        },

        setDistance: function (distance) {
            this.distance = distance;
        },

        setCutoff: function (cutoff_angle) {
            this.cutoff = cutoff_angle;
        },

        setTarget: function (target_in) {
            this.target = target_in.slice(0);
        },

        prepare: function (camera) {
            var mat4 = base.mat4;
            var mat3 = base.mat3;
            var ltype = this.light_type;
     
            if (this.target) {
                this.lookat(this.target);
            }
     
            if (this.parent) {
              if (ltype === enums.light.type.SPOT || ltype === enums.light.type.SPOT_SHADOW || ltype === enums.light.type.SPOT_SHADOW_PROJECTOR) {
                  var dMat = mat4.inverse_mat3(this.parent.tMatrix);
                  mat3.transpose_inline(dMat);
                  this.lDir = mat3.vec3_multiply(this.direction, dMat);
                  this.lDir = mat3.vec3_multiply(this.lDir, camera.nMatrix);
                  this.lPos = mat4.vec3_multiply(this.position, mat4.multiply(camera.mvMatrix,this.parent.tMatrix));
              } else if (ltype === enums.light.type.POINT) {
                  this.lPos = mat4.vec3_multiply(this.position, mat4.multiply(camera.mvMatrix,this.parent.tMatrix));
              }     
            } else {
              if (ltype === enums.light.type.DIRECTIONAL) {
                  this.lDir = mat3.vec3_multiply(this.direction, camera.nMatrix);
              } else if (ltype === enums.light.type.SPOT || ltype === enums.light.type.SPOT_SHADOW || ltype === enums.light.type.SPOT_SHADOW_PROJECTOR) {
                  this.lDir = mat3.vec3_multiply(this.direction, camera.nMatrix);
                  this.lPos = mat4.vec3_multiply(this.position, camera.mvMatrix);
              } else if (ltype === enums.light.type.POINT) {
                  this.lPos = mat4.vec3_multiply(this.position, camera.mvMatrix);
              } else if (ltype === enums.light.type.AREA) {
                  this.lDir = mat3.vec3_multiply(this.direction, camera.nMatrix);
              }
            }            
        },

        control: function (controllerId, motionId, value) {
            if (controllerId === enums.motion.POS) {
                this.position[motionId] = value;
            } else if (controllerId === enums.motion.INTENSITY) {
                this.intensity = value;
            }

            // else if (controllerId === enums.motion.ROT) {
            //    this.rotation[motionId] = value;
            //  }
        },

        getAABB: function () {
          if (this.dirty) {

            var vec3 = base.vec3;
            var aabbMath = base.aabb;
            var aabb;

            if (this.light_type == enums.light.type.POINT) {
              aabb = [
                  [0, 0, 0],
                  [0, 0, 0]
              ];

              aabbMath.engulf(aabb, [this.distance, this.distance, this.distance]);
              aabbMath.engulf(aabb, [-this.distance, -this.distance, -this.distance]);
              aabb[0] = vec3.add(aabb[0], this.position);
              aabb[1] = vec3.add(aabb[1], this.position);
            } else if (this.light_type == enums.light.type.SPOT || enums.light.type.SPOT_SHADOW || SPOT_SHADOW_PROJECTOR) {
                            
              var cpos = this.position.slice(0);
              aabb = [cpos,cpos];
              
              var tempCam = new base.Camera({
                position: this.position.slice(0),
                width: 10,
                height: 10,
                nearClip: 0.01,
                farClip: this.distance,
                fov: this.cutoff,
                target: base.vec3.add(this.position,base.vec3.multiply(this.direction,10)),
                targeted: true,
              });
              
              tempCam.calcProjection();
                  
              aabb.engulf( aabb, tempCam.unProject(0,0,this.distance) );
              aabb.engulf( aabb, tempCam.unProject(0,10,this.distance) );
              aabb.engulf( aabb, tempCam.unProject(10,10,this.distance) );
              aabb.engulf( aabb, tempCam.unProject(10,0,this.distance) );
    
            }

            this.dirty = false;
            this.aabb = aabb||this.aabb;
          }
          
          return this.aabb;
        },

        setDirection: function (x, y, z) {
            var vec3 = base.vec3;
            if (typeof (x) === 'object') {
                this.setDirection(x[0], x[1], x[2]);
                return;
            }


            this.direction = vec3.normalize([x, y, z]);
            this.target = null;

            return this;
        },

        lookat: function (x, y, z) {
            var vec3 = base.vec3;
            if (typeof (x) === 'object') {
                this.lookat(x[0], x[1], x[2]);
                return;
            }

            this.direction = vec3.normalize(vec3.subtract([x, y, z], this.position));
            this.target = [x,y,z];

            return this;
        },

        setRotation: function (x, y, z) {
            var mat4 = base.mat4;
            var vec3 = base.vec3;
            if (typeof (x) === 'object') {
                this.setRotation(x[0], x[1], x[2]);
                return;
            }

            var t = new base.Transform();
            t.rotate([-x, -y, -z]);
            t.pushMatrix();

            this.direction = vec3.normalize(mat4.vec3_multiply([1, 0, 0], t.getResult()));
            this.rotation = [x, y, z];

            return this;
        },

        setupShader: function (lShader, lNum) {
            var gl = GLCore.gl;

            var lUniforms = lShader;

            gl.uniform3fv(lUniforms.lightDiffuse[lNum], this.diffuse);
            gl.uniform3fv(lUniforms.lightSpecular[lNum], this.specular);
            if (this.lPos) gl.uniform3fv(lUniforms.lightPosition[lNum], this.lPos);
            if (this.lDir) gl.uniform3fv(lUniforms.lightDirection[lNum], this.lDir);

            gl.uniform1f(lUniforms.lightIntensity[lNum], this.intensity);
            gl.uniform1f(lUniforms.lightDistance[lNum], this.distance);

            if ((this.light_type === enums.light.type.SPOT_SHADOW) || (this.light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) || (this.light_type === enums.light.type.SPOT)) {
                gl.uniform1f(lUniforms.lightCutOffAngle[lNum], this.cutoff);
            }
            if ((this.light_type === enums.light.type.SPOT_SHADOW) || (this.light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) || (this.light_type === enums.light.type.AREA)) {
                if (this.light_type === enums.light.type.SPOT_SHADOW_PROJECTOR) {
                  this.shadowMapTex.texture.use(GLCore.gl.TEXTURE0 + lNum*2); // reserved in material for shadow map
                  gl.uniform1i(lShader.lightShadowMap[lNum], lNum*2);
                  this.projectorTex.use(GLCore.gl.TEXTURE0 + lNum*2+1); // reserved in material for projector map
                  gl.uniform1i(lShader.lightProjectionMap[lNum], lNum*2+1);
                } else {
                  this.shadowMapTex.texture.use(GLCore.gl.TEXTURE0 + lNum); // reserved in material for shadow map
                  gl.uniform1i(lShader.lightShadowMap[lNum], lNum);
                }

                gl.uniform3fv(lShader.lightDepthClip[lNum], [this.dummyCam.nearclip, this.dummyCam.farclip, 1.0 / this.map_res]);
                gl.uniformMatrix4fv(lShader.lightShadowMatrix[lNum], false, this.spMatrix);
            }
        },

        setShadow: function (map_res_in) // cone_tex
        {
            if (!base.features.lightShadows) return;
            
            this.map_res = map_res_in;
            this.shadowMapTex = new base.RenderBuffer(this.map_res, this.map_res, true);
            this.shadowMapTex.texture.setFilter(enums.texture.filter.NEAREST);

            this.dummyCam = new base.Camera(this.map_res, this.map_res, 80, 0.1, this.distance);
            this.dummyCam.calc_nmatrix = false; // don't need a normal matrix, save some cycles and determinant issues
            this.dummyCam.setTargeted(true);
            // if(!(strncmp(cone_tex.c_str(),"null",4) == 0 || strncmp(cone_tex.c_str(),"Null",4) == 0 || strncmp(cone_tex.c_str(),"NULL",4) == 0))
            // {
            //  coneTex = Texture::create(cone_tex);
            //  has_projector = true;
            // }
            this.has_shadow = true;
        },

        hasShadow: function () {
            return has_shadow;
        },
        
        setProjector: function(projectorTex_in) {
          this.projectorTex = projectorTex_in;
        },
        
        hasProjector: function() {
          return ((this.projectorTex!==null)?true:false);
        },

        shadowBegin: function () {
            var gl = GLCore.gl;
            var mat4 = base.mat4;
            var mat3 = base.mat3;

            this.shadowMapTex.use();

            gl.viewport(0, 0, this.map_res, this.map_res);

            gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

            if (this.light_type !== enums.light.type.AREA) {
                this.dummyCam.setClip(0.1, this.distance);
                this.dummyCam.setFOV(this.cutoff);
            } else {
                this.dummyCam.calcProjection();
            }

            if (this.parent) {
               var dMat = mat4.inverse_mat3(this.parent.tMatrix);
               mat3.transpose_inline(dMat);
               var lDir = mat3.vec3_multiply(this.direction, dMat);
               var lPos = mat4.vec3_multiply(this.position, this.parent.tMatrix);
               this.dummyCam.lookat(this.position[0], this.position[1], this.position[2], this.position[0] + this.direction[0] * 10.0, this.position[1] + this.direction[1] * 10.0, this.position[2] + this.direction[2] * 10.0, 0, 1, 0);
               mat4.multiply(this.dummyCam.mvMatrix.slice(0),mat4.inverse(this.parent.tMatrix),this.dummyCam.mvMatrix);
               
//               this.dummyCam.lookat(lPos[0], lPos[1], lPos[2], lPos[0] + lDir[0] * 10.0, lPos[1] + lDir[1] * 10.0, lPos[2] + lDir[2] * 10.0, 0, 1, 0);
            } else {
              this.dummyCam.lookat(this.position[0], this.position[1], this.position[2], this.position[0] + this.direction[0] * 10.0, this.position[1] + this.direction[1] * 10.0, this.position[2] + this.direction[2] * 10.0, 0, 1, 0);
            }

            gl.cullFace(gl.FRONT);
        },

        shadowEnd: function () {
            var gl = GLCore.gl;

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);

            gl.cullFace(gl.BACK);

            this.setupTexGen();
        },

        setupTexGen: function () {
            var mat4 = base.mat4;
            var biasMatrix = [0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.5, 0.5, 0.5, 1.0];

            this.spMatrix = mat4.multiply(cubicvr_identity, biasMatrix);
            this.spMatrix = mat4.multiply(this.spMatrix, this.dummyCam.pMatrix);
            this.spMatrix = mat4.multiply(this.spMatrix, this.dummyCam.mvMatrix);
        },

        setAreaAxis: function (degs_in) {
            this.areaAxis = degs_in;
        },

        updateAreaLight: function () {
            var vec3 = base.vec3;
            var areaHeight = this.areaCeiling - this.areaFloor;

            this.dummyCam.ortho = true;
            this.dummyCam.setClip(0.01, 1); // set defaults
            var dist = 0.0;
            var sx = Math.tan((this.areaCam.fov / 2.0) * (Math.PI / 180.0));
            // var far_clip_range = far_range;
            var vview = vec3.subtract(this.areaCam.target, this.areaCam.position);
            vview[1] = 0;
            vview = vec3.normalize(vview);

            var vleft = vec3.normalize(vec3.cross(vview, [0, 1, 0]));

            var fwd_ang = -Math.atan2(vview[2], vview[0]);

            dist = ((this.distance / 2.0) * Math.abs(sx)) - (this.distance / 2.0);

            if (dist < (this.distance / 3.0) / 2.0) dist = (this.distance / 3.0) / 2.0;

            vview = vec3.multiply(vview, dist);

            var zang = this.areaAxis[0] * (Math.PI / 180);
            var xang = this.areaAxis[1] * (Math.PI / 180);

            var tzang = Math.tan(zang);
            var txang = Math.tan(xang);

            var l_vec = [txang, 0.0, tzang];

            fwd_ang -= Math.atan2(l_vec[0], l_vec[2]);

            this.position = vec3.add(vec3.add(this.areaCam.position, vview), vec3.multiply(l_vec, areaHeight));
            this.position[1] = this.areaCeiling;
            this.target = vec3.add(vec3.add(this.areaCam.position, vview), vec3.multiply(l_vec, -areaHeight));
            this.target[1] = this.areaFloor;
            this.direction = vec3.normalize(vec3.subtract(this.target, this.position));
            this.dummyCam.rotation[2] = fwd_ang * (180.0 / Math.PI);

            var nearclip = this.dummyCam.nearclip;
            var farclip = this.dummyCam.farclip * (Math.abs(this.direction[1]) * areaHeight);

            // adjust clipping ranges to fit ortho bounds
            var aabb = this.orthoBounds(this.position, this.distance, this.distance, this.dummyCam.pMatrix, this.dummyCam.mvMatrix, this.dummyCam.nearclip);
            var diff;

            if (aabb[0][1] < this.areaCeiling) {
                diff = (this.areaCeiling - aabb[0][1]);
                nearclip -= diff / Math.abs(this.direction[1]);
            }

            aabb = this.orthoBounds(this.position, this.distance, this.distance, this.dummyCam.pMatrix, this.dummyCam.mvMatrix, this.dummyCam.farclip);

            if (aabb[1][1] > this.areaFloor) {
                diff = (aabb[1][1] - this.areaFloor);
                farclip += diff / Math.abs(this.direction[1]);
            }

            //if (nearclip < 0.01) 
            nearclip = 0.01;
            this.dummyCam.nearclip = nearclip;
            this.dummyCam.farclip = farclip;

            this.dummyCam.setOrtho(-this.distance / 2.0, this.distance / 2.0, -this.distance / 2.0, this.distance / 2.0);
        },

        orthoBounds: function (position, ortho_width, ortho_height, projMatrix, modelMatrix, clipDist) {
            var vec3 = base.vec3;
            var right = vec3.normalize([modelMatrix[0], modelMatrix[4], modelMatrix[8]]);
            var up = vec3.normalize([modelMatrix[1], modelMatrix[5], modelMatrix[9]]);
            var forward = vec3.normalize(vec3.cross(up, right));

            var hw, hh;

            hw = ortho_width / 2.0;
            hh = ortho_height / 2.0;

            var f_bounds = [];

            var rightHW = vec3.multiply(right, hw);
            var upHH = vec3.multiply(up, hh);
            var forwardClip = vec3.multiply(forward, clipDist);


            f_bounds[0] = vec3.add(vec3.subtract(position, rightHW), vec3.add(upHH, forwardClip));
            f_bounds[1] = vec3.add(vec3.add(position, rightHW), vec3.add(upHH, forwardClip));
            f_bounds[2] = vec3.subtract(vec3.subtract(position, rightHW), vec3.add(upHH, forwardClip));
            f_bounds[3] = vec3.subtract(vec3.add(position, rightHW), vec3.add(upHH, forwardClip));

            aabb1 = f_bounds[0];
            aabb2 = f_bounds[0];

            for (var i = 1; i < 4; i++) {
                if (aabb1[0] > f_bounds[i][0]) aabb1[0] = f_bounds[i][0];
                if (aabb1[1] > f_bounds[i][1]) aabb1[1] = f_bounds[i][1];
                if (aabb1[2] > f_bounds[i][2]) aabb1[2] = f_bounds[i][2];

                if (aabb2[0] < f_bounds[i][0]) aabb2[0] = f_bounds[i][0];
                if (aabb2[1] < f_bounds[i][1]) aabb2[1] = f_bounds[i][1];
                if (aabb2[2] < f_bounds[i][2]) aabb2[2] = f_bounds[i][2];
            }

            return [aabb1, aabb2];
        }
    };

    var extend = {
        Light: Light
    };

    return extend;
});
