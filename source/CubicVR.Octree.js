CubicVR.RegisterModule("Octree",function(base) {

  var undef = base.undef;
  var GLCore = base.GLCore;
  var Plane = base.plane;
  var Sphere = base.sphere;
  var enums = base.enums;
  
  enums.frustum = {
    plane: {
      LEFT: 0,
      RIGHT: 1,
      TOP: 2,
      BOTTOM: 3,
      NEAR: 4,
      FAR: 5
    }
  };

  enums.octree = {
    TOP_NW: 0,
    TOP_NE: 1,
    TOP_SE: 2,
    TOP_SW: 3,
    BOTTOM_NW: 4,
    BOTTOM_NE: 5,
    BOTTOM_SE: 6,
    BOTTOM_SW: 7
  };
  

function OctreeWorkerProxy(size, depth) {
  var that = this;
  this.size = size;
  this.depth = depth;
  this.worker = new base_Worker({
      message: function(e) {
        console.log('Octree Worker Message:', e);
      },
      error: function(e) {
        console.log('Octree Worker Error:', e);
      },
      type: 'octree'});
  this.worker.start();

  this.init = function(scene) {
    that.scene = scene;
    that.worker.init({
      size: that.size,
      max_depth: that.depth,
      camera: scene.camera
    });
  }; //init
  this.insert = function(node) {
    that.worker.send({message:'insert', node:node});
  }; //insert
  this.draw_on_map = function() {
    return;
  }; //draw_on_map
  this.reset_node_visibility = function() {
    return;
  }; //reset_node_visibility
  this.get_frustum_hits = function() {
  }; //get_frustum_hits
} //OctreeWorkerProxy

function Octree(size, max_depth, root, position, child_index) {
  var children = this._children = [];
  this._dirty = false;
  children[0] = null;
  children[1] = null;
  children[2] = null;
  children[3] = null;
  children[4] = null;
  children[5] = null;
  children[6] = null;
  children[7] = null;

  child_index = this._child_index = child_index || -1;
  root = this._root = root || null;
  max_depth = this._max_depth = max_depth || 0;
  size = this._size = size || 0;
  position = this._position = position || [0,0,0];

  this._nodes = [];
  //this._static_nodes = [];
  this._lights = [];
  this._static_lights = [];

  var sphere = this._sphere = [position[0], position[1], position[2], Math.sqrt(3 * (this._size / 2 * this._size / 2))];
  var bbox = this._bbox = [[0,0,0],[0,0,0]];

  var aabbMath = base.aabb;
  aabbMath.reset(bbox, position);

  var s = size/2;
  aabbMath.engulf(bbox, [position[0] + s, position[1] + s, position[2] + s]);
  aabbMath.engulf(bbox, [position[0] - s, position[1] - s, position[2] - s]);
  this._debug_visible = false;
} //Octree::Constructor
var Array_remove = function(arr, from, to) {
  var rest = arr.slice((to || from) + 1 || arr.length);
  arr.length = from < 0 ? arr.length + from : from;
  return arr.push.apply(arr, rest);
};
Octree.prototype.destroy = function() {
  var i, li, light;
  for (i=0, li = this._static_lights.length; i<li; ++i) {
    light = this._static_lights[i];
    light.octree_leaves = null;
    light.octree_common_root = null;
    light.octree_aabb = null;
  } //for
  for (i=0, li = this._lights.length; i<li; ++i) {
    light = this._lights[i];
    light.octree_leaves = null;
    light.octree_common_root = null;
    light.octree_aabb = null;
  } //for
  this._static_lights = null;
  this._lights = null;
  for (i = 0, li = this._children.length; i < li; ++i) {
    if (this._children[i] !== null) {
      this._children[i].destroy();
    } //if
  } //for
  for (i = 0, li = this._nodes.length; i < li; ++i) {
    var node = this._nodes[i];
    node.octree_leaves = null;
    node.octree_common_root = null;
    node.octree_aabb = null;
    node.dynamic_lights = [];
    node.static_lights = [];
  } //for
  this._children[0] = null;
  this._children[1] = null;
  this._children[2] = null;
  this._children[3] = null;
  this._children[4] = null;
  this._children[5] = null;
  this._children[6] = null;
  this._children[7] = null;
  this._children = null;
  this._root = null;
  this._position = null;
  this._nodes = null;
  this._lights = null;
  this._static_lights = null;
  this._sphere = null;
  this._bbox = null;
}; //Octree::destroy
Octree.prototype.toString = function() {
  var real_size = [this._bbox[1][0] - this._bbox[0][0], this._bbox[1][2] - this._bbox[0][2]];
  return "[Octree: @" + this._position + ", depth: " + this._max_depth + ", size: " + this._size + ", nodes: " + this._nodes.length + ", measured size:" + real_size + "]";
}; //Octree::toString
Octree.prototype.remove = function(node) {
  var dont_check_lights = false;
  var len = this._nodes.length;
  var i;
  for (i = len - 1, len = this._nodes.length; i >= 0; --i) {
    if (node === this._nodes[i]) {
      Array_remove(this._nodes, i);
      this.dirty_lineage();
      dont_check_lights = true;
      break;
    } //if
  } //for
  if (!dont_check_lights) {
    for (i = len - 1, len = this._lights.length; i >= 0; --i) {
      if (node === this._lights[i]) {
        Array_remove(this._lights, i);
        this.dirty_lineage();
        break;
      } //if      
    } //for
  } //if
}; //Octree::remove
Octree.prototype.dirty_lineage = function() {
  this._dirty = true;
  if (this._root !== null) { this._root.dirty_lineage(); }
}; //Octree::dirty_lineage
Octree.prototype.cleanup = function() {
  var num_children = this._children.length;
  var num_keep_children = 0;
  for (var i = 0; i < num_children; ++i) {
    var child = this._children[i];
    if (child !== null) {
      var keep = true;
      if (child._dirty === true) {
        keep = child.cleanup();
      } //if
      if (!keep) {
        this._children[i] = null;
      } else {
        ++num_keep_children;
      }
    } //if
  } //for
  if ((this._nodes.length === 0 && this._static_lights.length === 0 && this._lights.length === 0) && (num_keep_children === 0 || num_children === 0)) {
    return false;
  }
  return true;
}; //Octree::cleanup
Octree.prototype.insert_light = function(light) {
  this.insert(light, true);
}; //insert_light
Octree.prototype.propagate_static_light = function(light) {
  var i,l;
  for (i = 0, l = this._nodes.length; i < l; ++i) {
    if (this._nodes[i].static_lights.indexOf(light) === -1) {
      this._nodes[i].static_lights.push(light);
    } //if
  } //for
  for (i = 0; i < 8; ++i) {
    if (this._children[i] !== null) {
      this._children[i].propagate_static_light(light);
    } //if
  } //for
}; //propagate_static_light
Octree.prototype.collect_static_lights = function(node) {
  var i, li;
  for (i=0, li = this._static_lights.length; i<li; ++i) {
    if (node.static_lights.indexOf(this._static_lights[i]) === -1) {
      node.static_lights.push(this._static_lights[i]);
    } //if
  } //for
  for (i = 0; i < 8; ++i) {
    if (this._children[i] !== null) {
      this._children[i].collect_static_lights(node);
    } //if
  } //for
}; //collect_static_lights
Octree.prototype.insert = function(node, is_light) {
  if (is_light === undef) { is_light = false; }
  function $insert(octree, node, is_light, root) {
    var i, li, root_tree;
    if (is_light) {
      if (node.method === enums.light.method.STATIC) {
        if (octree._static_lights.indexOf(node) === -1) {
          octree._static_lights.push(node);
        } //if
        for (i=0, li=octree._nodes.length; i<li; ++i) {
          if (octree._nodes[i].static_lights.indexOf(node) === -1) {
            octree._nodes[i].static_lights.push(node);
          } //if
        } //for
        root_tree = octree._root;
        while (root_tree !== null) {
          for (i=0, l=root_tree._nodes.length; i<l; ++i) {
            var n = root_tree._nodes[i];
            if (n.static_lights.indexOf(node) === -1) {
              n.static_lights.push(node);
            } //if
          } //for
          root_tree = root_tree._root;
        } //while
      }
      else {
        if (octree._lights.indexOf(node) === -1) {
          octree._lights.push(node);
        } //if
      } //if
    } else {
      octree._nodes.push(node);
      for (i=0, li = octree._static_lights.length; i<li; ++i) {
        if (node.static_lights.indexOf(octree._static_lights[i]) === -1) {
          node.static_lights.push(octree._static_lights[i]);
        } //if
      } //for
      root_tree = octree._root;
      while (root_tree !== null) {
        for (i=0, li=root_tree._static_lights.length; i<li; ++i) {
          var light = root_tree._static_lights[i];
          if (node.static_lights.indexOf(light) === -1) {
            node.static_lights.push(light);
          } //if
        } //for
        root_tree = root_tree._root;
      } //while
    } //if
    node.octree_leaves.push(octree);
    node.octree_common_root = root;
    var aabbMath = base.aabb;
    aabbMath.engulf(node.octree_aabb, octree._bbox[0]);
    aabbMath.engulf(node.octree_aabb, octree._bbox[1]);
  } //$insert
  if (this._root === null) {
    node.octree_leaves = [];
    node.octree_common_root = null;
  } //if
  if (this._max_depth === 0) {
    $insert(this, node, is_light, this._root);
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
    $insert(this, node, is_light, this);
    if (is_light) {
      if (node.method == enums.light.method.STATIC) {
        this.propagate_static_light(node);
      } //if
    }
    else {
      this.collect_static_lights(node);
    } //if
  } else {

    //Add static lights in this octree
    for (var i=0, ii=this._static_lights.length; i<ii; ++i) {
      if (node.static_lights === undef) node.static_lights = [];
      if (node.static_lights.indexOf(this._static_lights[i]) === -1) {
        node.static_lights.push(this._static_lights[i]);
      } //if
    } //for

    var new_size = this._size / 2;
    var offset = this._size / 4;
    var new_position;

    var num_inserted = 0;
    //Create & check children to see if node fits there too
    var x = this._position[0];
    var y = this._position[1];
    var z = this._position[2];
    if (t_nw) {
      new_position = [x - offset, y - offset, z - offset];
      if (this._children[enums.octree.TOP_NW] === null) {
        this._children[enums.octree.TOP_NW] = new Octree(new_size, this._max_depth - 1, this, new_position, enums.octree.TOP_NW);
      }
      this._children[enums.octree.TOP_NW].insert(node, is_light);
      ++num_inserted;
    } //if
    if (t_ne) {
      new_position = [x + offset, y - offset, z - offset];
      if (this._children[enums.octree.TOP_NE] === null) {
        this._children[enums.octree.TOP_NE] = new Octree(new_size, this._max_depth - 1, this, new_position, enums.octree.TOP_NE);
      }
      this._children[enums.octree.TOP_NE].insert(node, is_light);
      ++num_inserted;
    } //if
    if (b_nw) {
      new_position = [x - offset, y + offset, z - offset];
      if (this._children[enums.octree.BOTTOM_NW] === null) {
        this._children[enums.octree.BOTTOM_NW] = new Octree(new_size, this._max_depth - 1, this, new_position, enums.octree.BOTTOM_NW);
      }
      this._children[enums.octree.BOTTOM_NW].insert(node, is_light);
      ++num_inserted;
    } //if
    if (b_ne) {
      new_position = [x + offset, y + offset, z - offset];
      if (this._children[enums.octree.BOTTOM_NE] === null) {
        this._children[enums.octree.BOTTOM_NE] = new Octree(new_size, this._max_depth - 1, this, new_position, enums.octree.BOTTOM_NE);
      }
      this._children[enums.octree.BOTTOM_NE].insert(node, is_light);
      ++num_inserted;
    } //if
    if (t_sw) {
      new_position = [x - offset, y - offset, z + offset];
      if (this._children[enums.octree.TOP_SW] === null) {
        this._children[enums.octree.TOP_SW] = new Octree(new_size, this._max_depth - 1, this, new_position, enums.octree.TOP_SW);
      }
      this._children[enums.octree.TOP_SW].insert(node, is_light);
      ++num_inserted;
    } //if
    if (t_se) {
      new_position = [x + offset, y - offset, z + offset];
      if (this._children[enums.octree.TOP_SE] === null) {
        this._children[enums.octree.TOP_SE] = new Octree(new_size, this._max_depth - 1, this, new_position, enums.octree.TOP_SE);
      }
      this._children[enums.octree.TOP_SE].insert(node, is_light);
      ++num_inserted;
    } //if
    if (b_sw) {
      new_position = [x - offset, y + offset, z + offset];
      if (this._children[enums.octree.BOTTOM_SW] === null) {
        this._children[enums.octree.BOTTOM_SW] = new Octree(new_size, this._max_depth - 1, this, new_position, enums.octree.BOTTOM_SW);
      }
      this._children[enums.octree.BOTTOM_SW].insert(node, is_light);
      ++num_inserted;
    } //if
    if (b_se) {
      new_position = [x + offset, y + offset, z + offset];
      if (this._children[enums.octree.BOTTOM_SE] === null) {
        this._children[enums.octree.BOTTOM_SE] = new Octree(new_size, this._max_depth - 1, this, new_position, enums.octree.BOTTOM_SE);
      }
      this._children[enums.octree.BOTTOM_SE].insert(node, is_light);
      ++num_inserted;
    } //if
    if (num_inserted > 1 || node.octree_common_root === null) {
      node.octree_common_root = this;
    } //if
  } //if
}; //Octree::insert
Octree.prototype.draw_on_map = function(map_canvas, map_context, target) {
  var mhw = map_canvas.width/2;
  var mhh = map_canvas.height/2;
  var x, y, w, h;
  var i, l, d, n, len;

  if (target === undef || target === "map") {
    map_context.save();
    if (this._debug_visible !== false) {
      map_context.fillStyle = "rgba(0,0,0,0)";
      map_context.strokeStyle = "#FF0000";
    }
    else {
      map_context.fillStyle = "rgba(0,0,0,0)";
      map_context.strokeStyle = "rgba(0,0,0,0)";
    } //if
    map_context.beginPath();
    var offset = this._size / 2;
    x = this._position[0];
    y = this._position[2];
    map_context.moveTo(mhw + x - offset, mhw + y - offset);
    map_context.lineTo(mhw + x - offset, mhw + y + offset);
    map_context.lineTo(mhw + x + offset, mhw + y + offset);
    map_context.lineTo(mhw + x + offset, mhw + y - offset);
    map_context.stroke();
    map_context.fill();
    map_context.restore();
  }

  if (target === undef || target === "objects") {
    map_context.save();
    for (i = 0, len = this._nodes.length; i < len; ++i) {
      n = this._nodes[i];
      map_context.fillStyle = "#5500FF";
      if (n.visible === true && n.culled === false) {
        map_context.strokeStyle = "#FFFFFF";
      } else {
        map_context.strokeStyle = "#000000";
      } //if
      map_context.beginPath();
      x = n.aabb[0][0];
      y = n.aabb[0][2];
      w = n.aabb[1][0] - x;
      h = n.aabb[1][2] - y;
      map_context.rect(mhw + x, mhh + y, w, h);
      map_context.stroke();
    } //for
    map_context.restore();
  }

  if (target === undef || target === "lights") {
    for (i = 0, len = this._lights.length; i < len; ++i) {
      l = this._lights[i];
      if (l.culled === false && l.visible === true) {
        map_context.fillStyle = "rgba(255, 255, 255, 0.1)";
      } else {
        map_context.fillStyle = "rgba(255, 255, 255, 0.0)";
      }
      map_context.strokeStyle = "#FFFF00";
      map_context.beginPath();
      d = l.distance;
      x = l.position[0];
      y = l.position[2];
      map_context.arc(mhw + x, mhh + y, d, 0, Math.PI * 2, true);
      map_context.closePath();
      map_context.stroke();
      map_context.fill();
      map_context.beginPath();
      x = l.aabb[0][0];
      y = l.aabb[0][2];
      w = l.aabb[1][0] - x;
      h = l.aabb[1][2] - y;
      map_context.rect(mhw + x, mhh + y, w, h);
      map_context.closePath();
      map_context.stroke();
    } //for
    for (i = 0, len = this._static_lights.length; i < len; ++i) {
      l = this._static_lights[i];
      if (l.culled === false && l.visible === true) {
        map_context.fillStyle = "rgba(255, 255, 255, 0.01)";
      } else {
        map_context.fillStyle = "rgba(255, 255, 255, 0.0)";
      }
      map_context.strokeStyle = "#FF66BB";
      map_context.beginPath();
      d = l.distance;
      x = l.position[0];
      y = l.position[2];
      map_context.arc(mhw + x, mhh + y, d, 0, Math.PI * 2, true);
      map_context.closePath();
      map_context.stroke();
      map_context.fill();
      map_context.beginPath();
      x = l.aabb[0][0];
      y = l.aabb[0][2];
      w = l.aabb[1][0] - x;
      h = l.aabb[1][2] - y;
      map_context.rect(mhw + x, mhh + y, w, h);
      map_context.closePath();
      map_context.stroke();
    } //for
  } //if

  function $draw_box(x1, y1, x2, y2, fill) {
    var x = x1 < x2 ? x1 : x2;
    var y = y1 < y2 ? y1 : y2;
    var w = x1 < x2 ? x2-x1 : x1-x2;
    var h = y1 < y2 ? y2-y1 : y1-y2;
    map_context.save();
    if (fill !== undefined) {
      map_context.fillStyle = fill;
      map_context.fillRect(mhw+x,mhh+y,w,h);
    } //if
    map_context.strokeRect(mhw+x,mhh+y,w,h);
    map_context.restore();
  } //$draw_box

  function $draw_oct(oct, fill) {
    var x1 = oct._bbox[0][0];
    var y1 = oct._bbox[0][2];
    var x2 = oct._bbox[1][0];
    var y2 = oct._bbox[1][2];
    $draw_box(x1, y1, x2, y2, fill);
  } //$draw_oct
  if (target != "lights" && target != "objects" && target != "map") {
    map_context.save();
    var nodes = this._nodes;
    for (i=0,l=nodes.length;i<l;++i) {
      n = nodes[i];
      if (n.name == target) {
        map_context.strokeStyle = "#FFFF00";
        map_context.lineWidth = 3;
        map_context.beginPath();
        x = n.aabb[0][0];
        y = n.aabb[0][2];
        w = n.aabb[1][0] - x;
        h = n.aabb[1][2] - y;
        map_context.rect(mhw + x, mhh + y, w, h);
        map_context.closePath();
        map_context.stroke();

        var oab = n.octree_aabb;
        map_context.strokeStyle = "#0000FF";
        $draw_box(oab[0][0], oab[0][2], oab[1][0], oab[1][2]);
        map_context.lineWidth = 1;
        if (n.common_root !== null) {
          map_context.strokeStyle = "#00FF00";
          //$draw_oct(n.octree_common_root);
        } //if
        break;
      } //if
    } //for
    map_context.lineWidth = 1;
    map_context.strokeStyle = "#FFFF00";
    $draw_oct(this, "#444444");
    map_context.fill();
    map_context.restore();

  } //if

  for (i = 0, len = this._children.length; i < len; ++i) {
    if (this._children[i] !== null) {
      this._children[i].draw_on_map(map_canvas, map_context, target);
    }
  } //for
}; //Octree::draw_on_map
Octree.prototype.contains_point = function(position) {
  return position[0] <= this._position[0] + this._size / 2 && position[1] <= this._position[1] + this._size / 2 && position[2] <= this._position[2] + this._size / 2 && position[0] >= this._position[0] - this._size / 2 && position[1] >= this._position[1] - this._size / 2 && position[2] >= this._position[2] - this._size / 2;
}; //Octree::contains_point
Octree.prototype.get_frustum_hits = function(camera, test_children) {
  var hits = {
    objects: [],
    lights: []
  };
  if (test_children === undef || test_children === true) {
    if (! (this.contains_point(camera.position))) {
      if (Sphere.intersects(camera.frustum.sphere, this._sphere) === false) {
        return hits;
      }
      //if(_sphere.intersects(c.get_frustum().get_cone()) === false) return;
      var contains_sphere = camera.frustum.contains_sphere(this._sphere);
      if (contains_sphere === -1) {
        this._debug_visible = false;
        return hits;
      }
      else if (contains_sphere === 1) {
        this._debug_visible = 2;
        test_children = false;
      }
      else if (contains_sphere === 0) {
        this._debug_visible = true;
        var contains_box = camera.frustum.contains_box(this._bbox);
        if (contains_box === -1) {
          this._debug_visible = false;
          return hits;
        }
        else if (contains_box === 1) {
          this._debug_visible = 3;
          test_children = false;
        } //if
      } //if
    } //if
  } //if
  var i, max_i, l;
  for (i = 0, max_i = this._nodes.length; i < max_i; ++i) {
    var n = this._nodes[i];
    hits.objects.push(n);
    n.dynamic_lights = [].concat(this._lights);
    n.was_culled = n.culled;
    n.culled = false;
    n.drawn_this_frame = false;
  } //for objects
  this._debug_visible = this._lights.length > 0 ? 4 : this._debug_visible;
  for (i = 0, max_i = this._lights.length; i < max_i; ++i) {
    l = this._lights[i];
    if (l.visible === true) {
      hits.lights.push(l);
      l.was_culled = l.culled;
      l.culled = false;
    } //if
  } //for dynamic lights
  for (i = 0, max_i = this._static_lights.length; i < max_i; ++i) {
    l = this._static_lights[i];
    if (l.visible === true) {
      l.culled = false;
    } //if
  } //for static lights
  for (i = 0; i < 8; ++i) {
    if (this._children[i] !== null) {
      var child_hits = this._children[i].get_frustum_hits(camera, test_children);
      var o, max_o;
      for (o = 0, max_o = child_hits.objects.length; o < max_o; ++o) {
        hits.objects.push(child_hits.objects[o]);
        var obj_lights = child_hits.objects[o].dynamic_lights;
        for (var j=0, lj=this._lights.length; j<lj; ++j) {
          if(obj_lights.indexOf(this._lights[j]) < 0) {
            obj_lights.push(this._lights[j]);
          } //if
        } //for j
      } //for o
      //hits.lights = hits.lights.concat(child_hits.lights);
      //collect lights and make sure they're unique <- really slow
      for (o = 0, max_o = child_hits.lights.length; o < max_o; ++o) {
        if (hits.lights.indexOf(child_hits.lights[o]) < 0) {
          hits.lights.push(child_hits.lights[o]);
        } //if
      } //for o
    } //if
  } //for
  return hits;
}; //Octree::get_frustum_hits
Octree.prototype.reset_node_visibility = function() {
  this._debug_visible = false;

  var i, l;
  for (i = 0, l = this._nodes.length; i < l; ++i) {
    this._nodes[i].culled = true;
  } //for
  for (i = 0, l = this._lights.length; i < l; ++i) {
    this._lights[i].culled = true;
  } //for
  for (i = 0, l = this._static_lights.length; i < l; ++i) {
    this._static_lights[i].culled = true;
  } //for
  for (i = 0, l = this._children.length; i < l; ++i) {
    if (this._children[i] !== null) {
      this._children[i].reset_node_visibility();
    } //if
  } //for
}; //Octree::reset_visibility
/***********************************************
 * OctreeNode
 ***********************************************/

function OctreeNode() {
  this.position = [0, 0, 0];
  this.visible = false;
  this._object = null;
} //OctreeNode::Constructor
OctreeNode.prototype.toString = function() {
  return "[OctreeNode " + this.position + "]";
}; //OctreeNode::toString
OctreeNode.prototype.attach = function(obj) {
  this._object = obj;
}; //OctreeNode::attach

function base_OctreeWorker() {
  this.octree = null;
  this.nodes = [];
  this.camera = null;
} //base_OctreeWorker::Constructor
base_OctreeWorker.prototype.onmessage = function(input) {
  var message = input.message;
  if (message === "init") {
    var params = input.data;
    this.octree = new Octree(params.size, params.max_depth);
    this.camera = new Camera();
  }
  else if (type === "set_camera") {
    var data = message.data;
    this.camera.mvMatrix = data.mvMatrix;
    this.camera.pMatrix = data.pMatrix;
    this.camera.position = data.position;
    this.camera.target = data.target;
    this.camera.frustum.extract(this.camera, this.camera.mvMatrix, this.camera.pMatrix);
  }
  else if (type === "insert") {
    var json_node = JSON.parse(message.data);
    var node = new base.SceneObject();
    var trans = new base.Transform();
    var i;

    for (i in json_node) {
      if (json_node.hasOwnProperty(i)) {
        node[i] = json_node[i];
      } //if
    } //for

    for (i in json_node.trans) {
      if (json_node.trans.hasOwnProperty(i)) {
        trans[i] = json_node.trans[i];
      } //if
    } //for

    node.trans = trans;
    node.id = json_node.id;

    this.octree.insert(node);
    this.nodes[node.id] = node;
  }
  else if (type === "cleaup") {
    this.octree.cleanup();
  } //if
}; //onmessage

/***********************************************
 * Frustum
 ***********************************************/

function FrustumWorkerProxy(worker, camera) {
  this.camera = camera;
  this.worker = worker;
  this.draw_on_map = function(map_context) {
    return;
  };
} //FrustumWorkerProxy
FrustumWorkerProxy.prototype.extract = function(camera, mvMatrix, pMatrix) {
  this.worker.send({
    type: "set_camera",
    data: {
      mvMatrix: this.camera.mvMatrix,
      pMatrix: this.camera.pMatrix,
      position: this.camera.position,
      target: this.camera.target
    }
  });
}; //FrustumWorkerProxy::extract

function Frustum() {
  this.last_in = [];
  this._planes = [];
  this.sphere = null;
  for (var i = 0; i < 6; ++i) {
    this._planes[i] = [0, 0, 0, 0];
  } //for
} //Frustum::Constructor
Frustum.prototype.extract = function(camera, mvMatrix, pMatrix) {
  var mat4 = base.mat4,
      vec3 = base.vec3;
  
  if (mvMatrix === undef || pMatrix === undef) {
    return;
  }
  var comboMatrix = mat4.multiply(pMatrix, mvMatrix);

  var planes = this._planes;
  // Left clipping plane
  planes[enums.frustum.plane.LEFT][0] = comboMatrix[3] + comboMatrix[0];
  planes[enums.frustum.plane.LEFT][1] = comboMatrix[7] + comboMatrix[4];
  planes[enums.frustum.plane.LEFT][2] = comboMatrix[11] + comboMatrix[8];
  planes[enums.frustum.plane.LEFT][3] = comboMatrix[15] + comboMatrix[12];

  // Right clipping plane
  planes[enums.frustum.plane.RIGHT][0] = comboMatrix[3] - comboMatrix[0];
  planes[enums.frustum.plane.RIGHT][1] = comboMatrix[7] - comboMatrix[4];
  planes[enums.frustum.plane.RIGHT][2] = comboMatrix[11] - comboMatrix[8];
  planes[enums.frustum.plane.RIGHT][3] = comboMatrix[15] - comboMatrix[12];

  // Top clipping plane
  planes[enums.frustum.plane.TOP][0] = comboMatrix[3] - comboMatrix[1];
  planes[enums.frustum.plane.TOP][1] = comboMatrix[7] - comboMatrix[5];
  planes[enums.frustum.plane.TOP][2] = comboMatrix[11] - comboMatrix[9];
  planes[enums.frustum.plane.TOP][3] = comboMatrix[15] - comboMatrix[13];

  // Bottom clipping plane
  planes[enums.frustum.plane.BOTTOM][0] = comboMatrix[3] + comboMatrix[1];
  planes[enums.frustum.plane.BOTTOM][1] = comboMatrix[7] + comboMatrix[5];
  planes[enums.frustum.plane.BOTTOM][2] = comboMatrix[11] + comboMatrix[9];
  planes[enums.frustum.plane.BOTTOM][3] = comboMatrix[15] + comboMatrix[13];

  // Near clipping plane
  planes[enums.frustum.plane.NEAR][0] = comboMatrix[3] + comboMatrix[2];
  planes[enums.frustum.plane.NEAR][1] = comboMatrix[7] + comboMatrix[6];
  planes[enums.frustum.plane.NEAR][2] = comboMatrix[11] + comboMatrix[10];
  planes[enums.frustum.plane.NEAR][3] = comboMatrix[15] + comboMatrix[14];

  // Far clipping plane
  planes[enums.frustum.plane.FAR][0] = comboMatrix[3] - comboMatrix[2];
  planes[enums.frustum.plane.FAR][1] = comboMatrix[7] - comboMatrix[6];
  planes[enums.frustum.plane.FAR][2] = comboMatrix[11] - comboMatrix[10];
  planes[enums.frustum.plane.FAR][3] = comboMatrix[15] - comboMatrix[14];

  for (var i = 0; i < 6; ++i) {
    Plane.normalize(planes[i]);
  }

  //Sphere
  var fov = 1 / pMatrix[5];
  var near = -planes[enums.frustum.plane.NEAR][3];
  var far = planes[enums.frustum.plane.FAR][3];
  var view_length = far - near;
  var height = view_length * fov;
  var width = height;

  var P = [0, 0, near + view_length * 0.5];
  var Q = [width, height, near + view_length];
  var diff = vec3.subtract(P, Q);
  var diff_mag = vec3.length(diff);

  var look_v = [comboMatrix[3], comboMatrix[9], comboMatrix[10]];
  var look_mag = vec3.length(look_v);
  look_v = vec3.multiply(look_v, 1 / look_mag);

  var pos = [camera.position[0], camera.position[1], camera.position[2]];
  pos = vec3.add(pos, vec3.multiply(look_v, view_length * 0.5));
  pos = vec3.add(pos, vec3.multiply(look_v, 1));
  this.sphere = [pos[0], pos[1], pos[2], diff_mag];

}; //Frustum::extract

Frustum.prototype.contains_sphere = function(sphere) {
  var vec3 = base.vec3,
      planes = this._planes;

  for (var i = 0; i < 6; ++i) {
    var p = planes[i];
    var normal = [p[0], p[1], p[2]];
    var distance = vec3.dot(normal, [sphere[0],sphere[1],sphere[2]]) + p.d;
    this.last_in[i] = 1;

    //OUT
    if (distance < -sphere[3]) {
      return -1;
    }

    //INTERSECT
    if (Math.abs(distance) < sphere[3]) {
      return 0;
    }

  } //for
  //IN
  return 1;
}; //Frustum::contains_sphere

Frustum.prototype.draw_on_map = function(map_canvas, map_context) {
  var mhw = map_canvas.width/2;
  var mhh = map_canvas.height/2;
  map_context.save();
  var planes = this._planes;
  var important = [0, 1, 4, 5];
  for (var pi = 0, l = important.length; pi < l; ++pi) {
    var p = planes[important[pi]];
    map_context.strokeStyle = "#FF00FF";
    if (pi < this.last_in.length) {
      if (this.last_in[pi]) {
        map_context.strokeStyle = "#FFFF00";
      }
    } //if
    var x1 = -mhw;
    var y1 = (-p[3] - p[0] * x1) / p[2];
    var x2 = mhw;
    var y2 = (-p[3] - p[0] * x2) / p[2];
    map_context.moveTo(mhw + x1, mhh + y1);
    map_context.lineTo(mhw + x2, mhh + y2);
    map_context.stroke();
  } //for
  map_context.strokeStyle = "#0000FF";
  map_context.beginPath();
  map_context.arc(mhw + this.sphere[0], mhh + this.sphere[2], this.sphere[3], 0, Math.PI * 2, false);
  map_context.closePath();
  map_context.stroke();
  map_context.restore();
}; //Frustum::draw_on_map

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

  var planes = this._planes;

  for (var i = 0; i < 6; ++i) {
    var in_count = 8;
    var point_in = 1;

    for (var j = 0; j < 8; ++j) {
      if (Plane.classifyPoint(planes[i], points[j]) === -1) {
        point_in = 0;
        --in_count;
      } //if
    } //for j
    this.last_in[i] = point_in;

    //OUT
    if (in_count === 0) {
      return -1;
    }

    total_in += point_in;
  } //for i
  //IN
  if (total_in === 6) {
    return 1;
  }

  return 0;
}; //Frustum::contains_box


  var exports = {
    Frustum: Frustum,
    Octree: Octree 
  }; 
  
  return exports;
});
