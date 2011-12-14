CubicVR.RegisterModule("Primitives",function(base) {

  var enums = base.enums;
  var undef = base.undef;
  var GLCore = base.GLCore;
  var util = base.util;

  var M_TWO_PI = 2.0 * Math.PI;
  var M_HALF_PI = Math.PI / 2.0;

  /* Procedural Objects */

  function cubicvr_latheObject(obj_in, pointList, lathe_divisions, material, transform, uvmapper) {
    var mat4 = base.mat4;
    var vec3 = base.vec3;
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

    var m = null;
    
    if (transform!==undef) m = (transform.getResult!==undef)?transform.getResult():transform;

    for (j = 0; j < lathe_divisions; j++) {
      for (k = 0, kMax = pointList.length; k < kMax; k++) {
        if (m) {
          obj_in.addPoint(mat4.vec3_multiply(slices[j][k], m));
        } else {
          obj_in.addPoint(slices[j][k]);
        }
      }
    }
    
    if (typeof(material) === "string") {
      material = new base.Material(material);
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

    
    if (uvmapper !== undef)
    {
      var uvm = null;

      if (uvmapper.apply !== undef)
      {
        uvm = uvmapper;
      }
      else if (uvmapper)
      {
        uvm = new base.UVMapper(uvmapper);
      }

      if (uvm !== null)
      {
        // Calculate face normals (used for UV mapping and lighting), todo: face range+offset
        obj_in.calcFaceNormals();

        uvm.apply(obj_in, material);  
      }
    }  

  }

  function cubicvr_planeObject(mesh, size, mat, transform, uvmapper) {
    var mat4 = base.mat4;
    var half_size = size*0.5;
    var pofs = mesh.points.length;

    if (typeof(mat) === "string") {
      mat = new base.Material(mat);
    }
    mesh.setFaceMaterial(mat);

    if (transform !== undef) {
      var m = (transform.getResult!==undef)?transform.getResult():transform;
      mesh.addPoint([
        mat4.vec3_multiply([half_size, -half_size, 0],m),
        mat4.vec3_multiply([half_size, half_size, 0],m),
        mat4.vec3_multiply([-half_size, half_size, 0],m),
        mat4.vec3_multiply([-half_size, -half_size, 0],m)
      ]);
    }
    else {
      mesh.addPoint([
        [half_size, -half_size, 0],
        [half_size, half_size, 0],
        [-half_size, half_size, 0],
        [-half_size, -half_size, 0]
      ]);
    }
    mesh.addFace([
      [pofs+0, pofs+1, pofs+2, pofs+3], //back
      [pofs+3, pofs+2, pofs+1, pofs+0]  //front
    ]);

    if (uvmapper !== undef)
    {
      var uvm = null;

      if (uvmapper.apply !== undef)
      {
        uvm = uvmapper;
      }
      else if (uvmapper)
      {
        uvm = new base.UVMapper(uvmapper);
      }

      if (uvm !== null)
      {
        // Calculate face normals (used for UV mapping and lighting), todo: face range+offset
        mesh.calcFaceNormals();

        uvm.apply(mesh, mat);  
      }
    }  

  } //cubicvr_planeObject

  function cubicvr_boxObject(boxObj, box_size, box_mat, transform, uvmapper) {
    var mat4 = base.mat4;
        
    var half_boxx, half_boxy, half_boxz;
    if (typeof(box_size)==='object') {
       half_boxx = box_size[0]/2;
       half_boxy = box_size[1]/2;
       half_boxz = box_size[2]/2;
    } else {
       half_boxx = half_boxy = half_boxz = box_size / 2.0;
    }
        
    var pofs = boxObj.points.length;
    
    if (typeof(box_mat) === "string") {
      box_mat = new base.Material(box_mat);
    }
    boxObj.setFaceMaterial(box_mat);

    if (transform !== undef) {
      var m = (transform.getResult!==undef)?transform.getResult():transform;
      boxObj.addPoint([
        mat4.vec3_multiply([half_boxx, -half_boxy, half_boxz], m),
        mat4.vec3_multiply([half_boxx, half_boxy, half_boxz], m),
        mat4.vec3_multiply([-half_boxx, half_boxy, half_boxz], m),
        mat4.vec3_multiply([-half_boxx, -half_boxy, half_boxz], m),
        mat4.vec3_multiply([half_boxx, -half_boxy, -half_boxz], m),
        mat4.vec3_multiply([half_boxx, half_boxy, -half_boxz], m),
        mat4.vec3_multiply([-half_boxx, half_boxy, -half_boxz], m),
        mat4.vec3_multiply([-half_boxx, -half_boxy, -half_boxz], m)
        ]);
    } else {
      boxObj.addPoint([
        [half_boxx, -half_boxy, half_boxz],
        [half_boxx, half_boxy, half_boxz],
        [-half_boxx, half_boxy, half_boxz],
        [-half_boxx, -half_boxy, half_boxz],
        [half_boxx, -half_boxy, -half_boxz],
        [half_boxx, half_boxy, -half_boxz],
        [-half_boxx, half_boxy, -half_boxz],
        [-half_boxx, -half_boxy, -half_boxz]
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
    
    if (uvmapper !== undef)
    {
      var uvm = null;

      if (uvmapper.apply !== undef)
      {
        uvm = uvmapper;
      }
      else if (uvmapper)
      {
        uvm = new base.UVMapper(uvmapper);
      }

      if (uvm !== null)
      {
        // Calculate face normals (used for UV mapping and lighting), todo: face range+offset
        boxObj.calcFaceNormals();

        uvm.apply(boxObj, box_mat);  
      }
    }  
  }
  

  function cubicvr_torusObject(mesh, inner_radius, outer_radius, lon, lat, material, transform, uvmapper) {
      var pointList = [],
       thick = outer_radius-inner_radius,
       radius = inner_radius+(thick)/2.0;

      // generate a circle on the right side (radius) of the X/Y axis, circle radius of (thick)
      var step = (M_TWO_PI / lat),
        theta = 0;
      for (var i = 0; i <= lat; i ++) {
          pointList.push([radius + Math.cos(theta) * thick, Math.sin(theta) * thick, 0]);
          theta += step;
      }

      base.genLatheObject(mesh, pointList, lon, material, transform, uvmapper);
  }


  function cubicvr_coneObject(mesh, baseSize, height, lon, material, transform, uvmapper) {
      base.genLatheObject(mesh, [[0,-height/2,0],[baseSize/2.0,-height/2,0],[0,height/2,0]], lon, material, transform, uvmapper);
  }


  function cubicvr_cylinderObject(mesh, radius, height, lon, material, transform, uvmapper) {
      base.genLatheObject(mesh, [[0,-height/2,0],[radius,-height/2,0],[radius,height/2,0],[0,height/2,0]], lon, material, transform, uvmapper);
  }

  function cubicvr_sphereObject(mesh, radius, lon, lat, material, transform, uvmapper) {
      var pointList = [];

      lat = (lat /= 2) | 0;
      lon = lon | 0;

      // generate a half-circle on the right side of the x/y axis
      var step = (Math.PI / lat);
      var theta = -M_HALF_PI;
      for (var i = 0; i <= lat; i ++) {
          pointList.push([Math.cos(theta) * radius, Math.sin(theta) * radius, 0]);
          theta += step;
      }

      base.genLatheObject(mesh, pointList, lon, material, transform, uvmapper);
  }

  function parseMaterial(mat) {
    if (typeof(mat) === 'string') {
        mat = base.get(mat,base.Material);
    }
    if (mat === undef) {
        return new base.Material();
    }
    if (mat.use) {
        return mat;
    } else if (typeof(mat)==='object') {
        return new base.Material(mat);
    } else {    // TODO: support #reference syntax
        return new base.Material();        
    }
  }

  function parseTransform(t) {
    if (t === undef) return undef;
    if (typeof(t) === 'array') {
        return t;
    }
    if (typeof(t) === 'object') {
        if (!!t.getResult) {
            return t.getResult();            
        } else if (!!t.position || !!t.rotation || !!t.scale){
            return base.mat4.transform(t.position,t.rotation,t.scale);
        } else {
            return undef;            
        }
    }
  }
  
  
  function parseUV(uv) {
    if (typeof(uv) === 'string') {
        uv = base.get(uv);
    }
    if (uv === undef) {
        return undef;
    }
    if (uv.apply) {
        return uv;
    } else if (typeof(uv)==='object') {
        return new base.UVMapper(uv);
    } else {    // TODO: support #reference syntax
        return undef;
    }
  }

  var primitives = {
    
    lathe: function(obj_init) {
      var obj_in, material, transform, uvmapper;
      var pointList, lathe_divisions;
      
      if (obj_init.points==undef) return null;
      
      obj_in = (obj_init.mesh!==undef)?obj_init.mesh:(new base.Mesh((obj_init.name!==undef)?obj_init.name:undef));
      material = parseMaterial(obj_init.material);
      transform = parseTransform(obj_init.transform);
      uvmapper = parseUV(obj_init.uvmapper||obj_init.uv);

      lathe_divisions = (obj_init.divisions!==undef)?obj_init.divisions:24;
      
      cubicvr_latheObject(obj_in,obj_init.points,lathe_divisions,material,transform,uvmapper);
      
      return obj_in;
    },
    box: function(obj_init) {
      var obj_in, material, transform, uvmapper;
      var size;
      
      obj_in = (obj_init.mesh!==undef)?obj_init.mesh:(new base.Mesh((obj_init.name!==undef)?obj_init.name:undef));
      material = parseMaterial(obj_init.material);
      transform = parseTransform(obj_init.transform);
      uvmapper = parseUV(obj_init.uvmapper||obj_init.uv);
      
      size = (obj_init.size!==undef)?obj_init.size:1.0;

      cubicvr_boxObject(obj_in, size, material, transform, uvmapper);
      
      return obj_in;
    },
    plane: function(obj_init) {
      var obj_in, material, transform, uvmapper;
      var size;

      obj_in = (obj_init.mesh!==undef)?obj_init.mesh:(new base.Mesh((obj_init.name!==undef)?obj_init.name:undef));
      material = parseMaterial(obj_init.material);
      transform = parseTransform(obj_init.transform);
      uvmapper = parseUV(obj_init.uvmapper||obj_init.uv);

      size = (obj_init.size!==undef)?obj_init.size:1.0;
   
      cubicvr_planeObject(obj_in, size, material, transform, uvmapper);
          
      return obj_in;
    },
    sphere: function(obj_init) {
      var obj_in, material, transform, uvmapper;
      var radius, lon, lat;

      obj_in = (obj_init.mesh!==undef)?obj_init.mesh:(new base.Mesh((obj_init.name!==undef)?obj_init.name:undef));
      material = parseMaterial(obj_init.material);
      transform = parseTransform(obj_init.transform);
      uvmapper = parseUV(obj_init.uvmapper||obj_init.uv);

      radius = (obj_init.radius!==undef)?obj_init.radius:1.0;
      lon = (obj_init.lon!==undef)?obj_init.lon:24;
      lat = (obj_init.lat!==undef)?obj_init.lat:24;
      
      cubicvr_sphereObject(obj_in, radius, lon, lat, material, transform, uvmapper);
        
      return obj_in;    
    },
    torus: function(obj_init) {
      var obj_in, material, transform, uvmapper;
      var innerRadius, outerRadius, lon, lat;

      obj_in = (obj_init.mesh!==undef)?obj_init.mesh:(new base.Mesh((obj_init.name!==undef)?obj_init.name:undef));
      material = parseMaterial(obj_init.material);
      transform = parseTransform(obj_init.transform);
      uvmapper = parseUV(obj_init.uvmapper||obj_init.uv);

      innerRadius = (obj_init.innerRadius!==undef)?obj_init.innerRadius:0.75;
      outerRadius = (obj_init.outerRadius!==undef)?obj_init.outerRadius:1.0;
      lon = (obj_init.lon!==undef)?obj_init.lon:24;
      lat = (obj_init.lat!==undef)?obj_init.lat:24;
      
      cubicvr_torusObject(obj_in, innerRadius, outerRadius, lon, lat, material, transform, uvmapper);
      
      return obj_in;    
    },
    cone: function(obj_init) {
      var obj_in, material, transform, uvmapper;
      var baseSize, height, lon;

      obj_in = (obj_init.mesh!==undef)?obj_init.mesh:(new base.Mesh((obj_init.name!==undef)?obj_init.name:undef));
      material = parseMaterial(obj_init.material);
      transform = parseTransform(obj_init.transform);
      uvmapper = parseUV(obj_init.uvmapper||obj_init.uv);

      baseSize = (obj_init.base!==undef)?obj_init.base:1.0;
      height = (obj_init.height!==undef)?obj_init.height:1.0;
      lon = (obj_init.lon!==undef)?obj_init.lon:24;

      cubicvr_coneObject(obj_in, baseSize, height, lon, material, transform, uvmapper);
      
      return obj_in;    
    },
    cylinder: function(obj_init) {
      var obj_in, material, transform, uvmapper;
      var radius, height, lon;

      obj_in = (obj_init.mesh!==undef)?obj_init.mesh:(new base.Mesh((obj_init.name!==undef)?obj_init.name:undef));
      material = parseMaterial(obj_init.material);
      transform = parseTransform(obj_init.transform);
      uvmapper = parseUV(obj_init.uvmapper||obj_init.uv);

      radius = (obj_init.radius!==undef)?obj_init.radius:1.0;
      height = (obj_init.height!==undef)?obj_init.height:1.0;
      lon = (obj_init.lon!==undef)?obj_init.lon:24;

      cubicvr_cylinderObject(obj_in, radius, height, lon, material, transform, uvmapper);
      
      return obj_in;    
    }
  };
  
  var extend = {
    genPlaneObject: cubicvr_planeObject,
    genBoxObject: cubicvr_boxObject,
    genLatheObject: cubicvr_latheObject,
    genTorusObject: cubicvr_torusObject,
    genConeObject: cubicvr_coneObject,
    genCylinderObject: cubicvr_cylinderObject,
    genSphereObject: cubicvr_sphereObject,
    primitives: primitives
  };

  return extend;
});
