CubicVR.RegisterModule("CollisionMap",function(base) {

  var undef = base.undef;
  var util = base.util;
  var vec3 = base.vec3;
  var enums = base.enums;

  enums.collision = {
    shape: {
      BOX: 0,
      SPHERE: 1,
      CYLINDER: 2,
      CONE: 3,
      CAPSULE: 4,
      MESH: 5,
      HEIGHTFIELD: 6,
      CONVEX_HULL: 7
    }
  };

  var CollisionMap = function(cmap_objs) {
    this.shapes = [];
    this.result = null;
    
    if (cmap_objs) {
      if (cmap_objs && !cmap_objs.length) {
        cmap_objs = [cmap_objs];
      }
      
      for (var i = 0, iMax = cmap_objs.length; i<iMax; i++) {
        this.addShape(cmap_objs[i]);
      }
    }
  };
  
  CollisionMap.prototype = {
    addShape: function(shape_in) {
      shape_in.type = base.parseEnum(enums.collision.shape,shape_in.type);
      shape_in.position = shape_in.position||[0,0,0];
      shape_in.rotation = shape_in.rotation||[0,0,0];
      shape_in.size = shape_in.size||[1,1,1];
      shape_in.radius = shape_in.radius||1;
      shape_in.height = shape_in.height||1;
      shape_in.margin = shape_in.margin||0.0;
      shape_in.mesh = shape_in.mesh||null;

      this.shapes.push(shape_in);
    },
    getShapes: function() {
      return this.shapes;       
    },
    setResult: function(shape) {
      this.result = shape;
    },
    getResult: function() {
      return this.result;
    }
  };
  
  var extend = {
    CollisionMap: CollisionMap
  };
  
  return extend;
});
