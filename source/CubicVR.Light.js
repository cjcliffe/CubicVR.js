
CubicVR.RegisterModule("Light", function(base) {
  
  var GLCore = base.GLCore;
  var enums = CubicVR.enums;
  var undef = base.undef;
  var aabbMath = CubicVR.aabb;

  var cubicvr_identity = [1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0];

  // Light Types
  enums.light = {
     type: {
       NULL: 0,
       POINT: 1,
       DIRECTIONAL: 2,
       SPOT: 3,
       AREA: 4,
       DEPTH_PACK: 5,  // this lets us pass the shadow stage in as a light definition
       SPOT_SHADOW: 6,
       MAX: 7
     },
     method: {
       GLOBAL: 0,
       STATIC: 1,
       DYNAMIC: 2
     }
   };
   
   
  /* Lights */

  function Light(light_type, lighting_method) {
    if (light_type === undef) {
      light_type = enums.light.type.POINT;
    }
    if (lighting_method === undef) {
      lighting_method = enums.light.method.DYNAMIC;
    }

    if (typeof(light_type)=='object') {
      this.light_type = (light_type.type!==undef)?light_type.type:enums.light.type.POINT;
      this.diffuse = (light_type.diffuse!==undef)?light_type.diffuse:[1, 1, 1];
      this.specular = (light_type.specular!==undef)?light_type.specular:[1.0,1.0,1.0];
      this.intensity = (light_type.intensity!==undef)?light_type.intensity:1.0;
      this.position = (light_type.position!==undef)?light_type.position:[0, 0, 0];
      this.direction = (light_type.direction!==undef)?light_type.direction:[0, 0, 0];
      this.distance = (light_type.distance!==undef)?light_type.distance:((this.light_type===enums.light.type.AREA)?30:10);
      this.cutoff = (light_type.cutoff!==undef)?light_type.cutoff:60;
      this.map_res = (light_type.map_res!==undef)?light_type.map_res:(this.light_type===enums.light.type.AREA)?2048:512;
      this.map_res = (light_type.mapRes!==undef)?light_type.mapRes:this.map_res;
      this.method = (light_type.method!==undef)?light_type.method:lighting_method;
      this.areaCam = (light_type.areaCam!==undef)?light_type.areaCam:null;
      this.areaCeiling = (light_type.areaCeiling!==undef)?light_type.areaCeiling:40;
      this.areaFloor = (light_type.areaFloor!==undef)?light_type.areaFloor:-40;
      this.areaAxis = (light_type.areaAxis!==undef)?light_type.areaAxis:[1,1,0];
    } else {
      this.light_type = light_type;
      this.diffuse = [1, 1, 1];
      this.specular = [1.0,1.0,1.0];
      this.intensity = 1.0;
      this.position = [0, 0, 0];
      this.direction = [0, 0, 0];
      this.distance = ((this.light_type===enums.light.type.AREA)?30:10);
      this.cutoff = 60;
      this.map_res = (this.light_type===enums.light.type.AREA)?2048:512;
      this.method = lighting_method;
      this.areaCam = null;
      this.areaCeiling = 40;
      this.areaFloor = -40;
      this.areaAxis = [1,1,0];
    }
    
    this.trans = new CubicVR.Transform();
    this.lposition = [0, 0, 0];
    this.tMatrix = this.trans.getResult();
    this.dirty = true;
    this.octree_leaves = [];
    this.octree_common_root = null;
    this.octree_aabb = [[0, 0, 0], [0, 0, 0]];
    this.ignore_octree = false;
    this.visible = true;
    this.culled = true;
    this.was_culled = true;
    this.aabb = [[0,0,0],[0,0,0]];
    aabbMath.reset(this.aabb, this.position);
    this.adjust_octree = CubicVR.SceneObject.prototype.adjust_octree;
    this.motion = null;
    this.rotation = [0,0,0];
    
    if (this.light_type === enums.light.type.SPOT_SHADOW || this.light_type === enums.light.type.AREA) {
      this.setShadow(this.map_res);
    }
    
    // modelview / normalmatrix transform outputs
    this.lDir = [0,0,0];
    this.lPos = [0,0,0];  
  }

  Light.prototype.setType = function(light_type) {
    this.light_type = type;
  }

  Light.prototype.setMethod = function(method) {
    this.method = method;
  }

  Light.prototype.setDiffuse = function(diffuse) {
    this.diffuse = diffuse;
  }
  Light.prototype.setSpecular = function(specular) {
    this.specular = specular;
  }
  Light.prototype.setIntensity = function(intensity) {
    this.intensity = intensity;
  }
  Light.prototype.setPosition = function(position) {
    this.position = position;
  }
  Light.prototype.setDistance = function(distance) {
    this.distance = distance;
  }
  Light.prototype.setCutoff = function(cutoff_angle) {
    this.cutoff = cutoff_angle;
  }

  Light.prototype.prepare = function(camera) {
    var mat4 = CubicVR.mat4;
    var mat3 = CubicVR.mat3;
    var ltype = this.light_type;
    
    if (ltype === enums.light.type.DIRECTIONAL) {
      this.lDir = mat3.vec3_multiply(this.direction,camera.nMatrix);
    } else if (ltype === enums.light.type.SPOT || ltype === enums.light.type.SPOT_SHADOW) {
      this.lDir = mat3.vec3_multiply(this.direction,camera.nMatrix);
      this.lPos = mat4.vec3_multiply(this.position,camera.mvMatrix);
    } else if (ltype === enums.light.type.POINT) {
      this.lPos = mat4.vec3_multiply(this.position,camera.mvMatrix);
    } else if (ltype === enums.light.type.AREA) {
      this.lDir = mat3.vec3_multiply(this.direction,camera.nMatrix);
    }
  }
  Light.prototype.control = function(controllerId, motionId, value) {
    if (controllerId === enums.motion.POS) {
      this.position[motionId] = value;
      } else if (controllerId === enums.motion.INTENSITY) {
        this.intensity = value;
       }
    
     // else if (controllerId === enums.motion.ROT) {
     //    this.rotation[motionId] = value;
     //  }
  }

  Light.prototype.doTransform = function(mat) {
    var vec3 = CubicVR.vec3;
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
    var vec3 = CubicVR.vec3;
    var aabb = [[0, 0, 0], [0, 0, 0]];
    aabbMath.engulf(aabb, [this.distance, this.distance, this.distance]);
    aabbMath.engulf(aabb, [-this.distance, -this.distance, -this.distance]);
    aabb[0] = vec3.add(aabb[0], this.position);
    aabb[1] = vec3.add(aabb[1], this.position);
    this.aabb = aabb;
    return this.aabb;
  };

  Light.prototype.setDirection = function(x, y, z) {
    var vec3 = CubicVR.vec3;
    if (typeof(x) === 'object') {
      this.setDirection(x[0], x[1], x[2]);
      return;
    }


    this.direction = vec3.normalize([x, y, z]);
      
      return this;
  };

  Light.prototype.lookat = function(x, y, z) {
    var vec3 = CubicVR.vec3;
    if (typeof(x) === 'object') {
      this.lookat(x[0], x[1], x[2]);
      return;
    }

    this.direction = vec3.normalize(vec3.subtract([x, y, z],this.position));
      
    return this;
  };



  Light.prototype.setRotation = function(x, y, z) {
    var mat4 = CubicVR.mat4;
    var vec3 = CubicVR.vec3;
    if (typeof(x) === 'object') {
      this.setRotation(x[0], x[1], x[2]);
      return;
    }

    var t = new CubicVR.Transform();
    t.rotate([-x, -y, -z]);
    t.pushMatrix();

    this.direction = vec3.normalize(mat4.vec3_multiply([1, 0, 0], t.getResult()));
    this.rotation = [x,y,z];
    
    return this;
  };


  Light.prototype.setupShader = function(lShader,lNum) {
      var gl = GLCore.gl;
      
      var lUniforms = lShader;

      gl.uniform3fv(lUniforms.lDiff[lNum], this.diffuse);
      gl.uniform3fv(lUniforms.lSpec[lNum], this.specular);
      if (this.lPos) gl.uniform3fv(lUniforms.lPos[lNum], this.lPos);
      if (this.lDir) gl.uniform3fv(lUniforms.lDir[lNum], this.lDir);

      gl.uniform1f(lUniforms.lInt[lNum], this.intensity);
      gl.uniform1f(lUniforms.lDist[lNum], this.distance);
      
      if ((this.light_type === enums.light.type.SPOT_SHADOW)||(this.light_type === enums.light.type.SPOT)) {
        gl.uniform1f(lUniforms.lCut[lNum], this.cutoff);
      }
      if ((this.light_type === enums.light.type.SPOT_SHADOW)||(this.light_type === enums.light.type.AREA)) {
        this.shadowMapTex.texture.use(GLCore.gl.TEXTURE0+lNum);  // reserved in material for shadow map
        gl.uniform1i(lShader.lDepthTex[lNum], lNum);
        gl.uniform3fv(lShader.lDepth[lNum], [this.dummyCam.nearclip,this.dummyCam.farclip,1.0/this.map_res]);        
        gl.uniformMatrix4fv(lShader.spMatrix[lNum], false, this.spMatrix);
      }
  };

  Light.prototype.setShadow = function(map_res_in)  // cone_tex
  {
    this.map_res = map_res_in;
    this.shadowMapTex = new CubicVR.RenderBuffer(this.map_res, this.map_res, true);
    this.shadowMapTex.texture.setFilter(enums.texture.filter.NEAREST);
    
    this.dummyCam = new CubicVR.Camera(this.map_res,this.map_res,80,0.1,this.distance);
    this.dummyCam.calc_nmatrix = false; // don't need a normal matrix, save some cycles and determinant issues
    this.dummyCam.setTargeted(true);
    // if(!(strncmp(cone_tex.c_str(),"null",4) == 0 || strncmp(cone_tex.c_str(),"Null",4) == 0 || strncmp(cone_tex.c_str(),"NULL",4) == 0))
    // {
    //  coneTex = Texture::create(cone_tex);
    //  has_projector = true;
    // }

    this.has_shadow = true;
  };


  Light.prototype.hasShadow = function()
  {
    return has_shadow;
  };


  Light.prototype.shadowBegin = function()
  {
    var gl = GLCore.gl;  

    this.shadowMapTex.use();

    gl.viewport(0, 0, this.map_res, this.map_res);
      
    gl.clear(gl.DEPTH_BUFFER_BIT|gl.COLOR_BUFFER_BIT);

    if (this.light_type!==enums.light.type.AREA) {
      this.dummyCam.setClip(0.1,this.distance);
      this.dummyCam.setFOV(this.cutoff);
    } else {
      this.dummyCam.calcProjection();
    }

    this.dummyCam.lookat(this.position[0], this.position[1], this.position[2], this.position[0]+this.direction[0]*10.0, this.position[1]+this.direction[1]*10.0, this.position[2]+this.direction[2]*10.0, 0, 1, 0);

    gl.cullFace(gl.FRONT);  
  };


  Light.prototype.shadowEnd = function()
  {
    var gl = GLCore.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    gl.cullFace(gl.BACK);
    
    this.setupTexGen();
  };


  Light.prototype.setupTexGen = function()
  {
    var mat4 = CubicVR.mat4;
    var biasMatrix = [0.5, 0.0, 0.0, 0.0,
                      0.0, 0.5, 0.0, 0.0,
                      0.0, 0.0, 0.5, 0.0,
                      0.5, 0.5, 0.5, 1.0];

    this.spMatrix = mat4.multiply(biasMatrix,cubicvr_identity);
    this.spMatrix = mat4.multiply(this.dummyCam.pMatrix,this.spMatrix);
    this.spMatrix = mat4.multiply(this.dummyCam.mvMatrix,this.spMatrix);
  };


  Light.prototype.setAreaAxis = function(degs_in) {
    this.areaAxis = degs_in;
  }

  Light.prototype.updateAreaLight = function() {
    var vec3 = CubicVR.vec3;
	  var areaHeight = this.areaCeiling-this.areaFloor;

    this.dummyCam.ortho = true;
    this.dummyCam.setClip(0.01,1); // set defaults
      
    	var dist = 0.0;
    	var sx = Math.tan((this.areaCam.fov/2.0)*(Math.PI/180.0));
  //  	var far_clip_range = far_range;

    	var vview = vec3.subtract(this.areaCam.target,this.areaCam.position);
    	vview[1] = 0;
    	vview = vec3.normalize(vview);

    	var vleft = vec3.normalize(vec3.cross(vview,[0,1,0]));

    	var fwd_ang = -Math.atan2(vview[2],vview[0]);

    	dist = ((this.distance/2.0)*Math.abs(sx))-(this.distance/2.0);

    	if (dist < (this.distance/3.0)/2.0) dist = (this.distance/3.0)/2.0;

      vview = vec3.multiply(vview,dist);

      var zang = this.areaAxis[0]*(Math.PI/180);
      var xang = this.areaAxis[1]*(Math.PI/180);
      
      var tzang = Math.tan(zang);
      var txang = Math.tan(xang);

    	var l_vec = [txang,0.0,tzang];

      fwd_ang -= Math.atan2(l_vec[0],l_vec[2]);

    	this.position = vec3.add(vec3.add(this.areaCam.position,vview),vec3.multiply(l_vec,areaHeight));
    	this.position[1] = this.areaCeiling;
    	this.target = vec3.add(vec3.add(this.areaCam.position,vview),vec3.multiply(l_vec,-areaHeight));
    	this.target[1] = this.areaFloor;
    	this.direction = vec3.normalize(vec3.subtract(this.target,this.position));
    	this.dummyCam.rotation[2] = fwd_ang*(180.0/Math.PI);

      var nearclip = this.dummyCam.nearclip;
      var farclip = this.dummyCam.farclip*(Math.abs(this.direction[1])*areaHeight);

      // adjust clipping ranges to fit ortho bounds
       var aabb = this.orthoBounds(this.position, this.distance, this.distance, this.dummyCam.pMatrix, this.dummyCam.mvMatrix, this.dummyCam.nearclip);
           
       if (aabb[0][1] < this.areaCeiling)
       {
         var diff = (this.areaCeiling-aabb[0][1]);
         nearclip-=diff/Math.abs(this.direction[1]);
       }
         
       aabb = this.orthoBounds(this.position, this.distance, this.distance, this.dummyCam.pMatrix, this.dummyCam.mvMatrix, this.dummyCam.farclip);
           
       if (aabb[1][1] > this.areaFloor)
       {
         var diff = (aabb[1][1]-this.areaFloor);
         farclip+=diff/Math.abs(this.direction[1]);
       }

      //if (nearclip < 0.01) 
      nearclip=0.01;
      this.dummyCam.nearclip = nearclip;
      this.dummyCam.farclip = farclip;

      this.dummyCam.setOrtho(-this.distance/2.0, this.distance/2.0, -this.distance/2.0, this.distance/2.0);
  }


  Light.prototype.orthoBounds = function(position, ortho_width, ortho_height, projMatrix, modelMatrix, clipDist)
  {
    var vec3 = CubicVR.vec3;
	  var right = vec3.normalize([modelMatrix[0],modelMatrix[4],modelMatrix[8]]);	
	  var up = vec3.normalize([modelMatrix[1],modelMatrix[5],modelMatrix[9]]);	
	  var forward = vec3.normalize(vec3.cross(up,right));
	
	  var hw, hh;
	
	  hw = ortho_width/2.0;
	  hh = ortho_height/2.0;
	
	  var f_bounds = [];

    var rightHW = vec3.multiply(right,hw);
    var upHH = vec3.multiply(up,hh);
    var forwardClip = vec3.multiply(forward,clipDist);
    

    f_bounds[0] = vec3.add     (vec3.subtract(position,rightHW), vec3.add(upHH,forwardClip));
    f_bounds[1] = vec3.add     (     vec3.add(position,rightHW), vec3.add(upHH,forwardClip));
    f_bounds[2] = vec3.subtract(vec3.subtract(position,rightHW), vec3.add(upHH,forwardClip));
    f_bounds[3] = vec3.subtract(     vec3.add(position,rightHW), vec3.add(upHH,forwardClip));	
	
	  aabb1 = f_bounds[0];
	  aabb2 = f_bounds[0];
	
	  for (var i = 1; i < 4; i++)
	  {
		  if (aabb1[0] > f_bounds[i][0]) aabb1[0] = f_bounds[i][0];
		  if (aabb1[1] > f_bounds[i][1]) aabb1[1] = f_bounds[i][1];
		  if (aabb1[2] > f_bounds[i][2]) aabb1[2] = f_bounds[i][2];
		
		  if (aabb2[0] < f_bounds[i][0]) aabb2[0] = f_bounds[i][0];
		  if (aabb2[1] < f_bounds[i][1]) aabb2[1] = f_bounds[i][1];
		  if (aabb2[2] < f_bounds[i][2]) aabb2[2] = f_bounds[i][2];
	  }
	
	  return [aabb1,aabb2];
  }

  var extend = {
    Light: Light
  };
 
  return extend; 
});

