CubicVR.RegisterModule("Polygon",function(base) {
    
    /**
    area, insideTriangle, snip, triangulate2D by John W. Ratcliff  // July 22, 2000
    See original code and more information here: http://www.flipcode.com/archives/Efficient_Polygon_Triangulation.shtml
     
    ported to actionscript by Zevan Rosser (www.actionsnippet.com)
    search & replaced to Javascript by Charles J. Cliffe (www.cubicvr.org)
    */

    var EPSILON = 0.0000000000001;  // make sure this exceeds 32-bit limit

    // calculate area of the contour polygon
    function area(contour) {
        var n = contour.length;
        var a = 0.0;

        for (var p = n - 1, q = 0; q < n; p = q++) {
            a += contour[p][0] * contour[q][1] - contour[q][0] * contour[p][1];
        }
        return a * 0.5;
    }

    // see if p is inside triangle abc
    function insideTriangle(ax, ay, bx, by, cx, cy, px, py) {
        var aX, aY, bX, bY
        var cX, cY, apx, apy;
        var bpx, bpy, cpx, cpy;
        var cCROSSap, bCROSScp, aCROSSbp;

        aX = cx - bx;
        aY = cy - by;
        bX = ax - cx;
        bY = ay - cy;
        cX = bx - ax;
        cY = by - ay;
        apx = px - ax;
        apy = py - ay;
        bpx = px - bx;
        bpy = py - by;
        cpx = px - cx;
        cpy = py - cy;

        aCROSSbp = aX * bpy - aY * bpx;
        cCROSSap = cX * apy - cY * apx;
        bCROSScp = bX * cpy - bY * cpx;

        return ((aCROSSbp >= 0.0) && (bCROSScp >= 0.0) && (cCROSSap >= 0.0));
    }

    function snip(contour, u, v, w, n, verts) {
        var p;
        var ax, ay, bx, by;
        var cx, cy, px, py;

        ax = contour[verts[u]][0];
        ay = contour[verts[u]][1];

        bx = contour[verts[v]][0];
        by = contour[verts[v]][1];

        cx = contour[verts[w]][0];
        cy = contour[verts[w]][1];

        if (EPSILON > (((bx - ax) * (cy - ay)) - ((by - ay) * (cx - ax)))) return false;

        for (p = 0; p < n; p++) {
            if ((p == u) || (p == v) || (p == w)) continue;
            
            px = contour[verts[p]][0]
            py = contour[verts[p]][1]
            
            if (insideTriangle(ax, ay, bx, by, cx, cy, px, py)) return false;
        }
        return true;
    }


    // contour = [[1,1],[2,2],vec2,...]

    function triangulate2D(contour) {

        var result = [];
        var n = contour.length;

        if (n < 3) return null;

        var verts = [];

        /* we want a counter-clockwise polygon in verts */
        var v;

        if (0.0 < area(contour)) {
            for (v = 0; v < n; v++) verts[v] = v;
        } else {
            for (v = 0; v < n; v++) verts[v] = (n - 1) - v;
        }

        var nv = n;

        /*  remove nv-2 vertsertices, creating 1 triangle every time */
        var count = 2 * nv; /* error detection */
        var m;
        for (m = 0, v = nv - 1; nv > 2;) { /* if we loop, it is probably a non-simple polygon */
            if (0 >= (count--)) {
                //** Triangulate: ERROR - probable bad polygon!
                // trace("bad poly");
                return null;
            }

            /* three consecutive vertices in current polygon, <u,v,w> */
            var u = v;
            if (nv <= u) u = 0; /* previous */
            v = u + 1;
            if (nv <= v) v = 0; /* new v    */
            var w = v + 1;
            if (nv <= w) w = 0; /* next     */

            if (snip(contour, u, v, w, nv, verts)) {
                var a, b, c, s, t;

                /* true names of the vertices */
                a = verts[u];
                b = verts[v];
                c = verts[w];

                /* output Triangle */
                result.push(a);
                result.push(b);
                result.push(c);

                m++;

                /* remove v from remaining polygon */
                for (s = v, t = v + 1; t < nv; s++, t++) verts[s] = verts[t];
                nv--;

                /* resest error detection counter */
                count = 2 * nv;
            }
        }

        return result;
    }
    
    function polygonToMesh(mesh,contour) {
                  
      var triangulated = triangulate2D(contour);
      var triangles = CubicVR.util.repackArray(triangulated,3,triangulated.length/3);
      
      var points = [];
      
      var point_ofs = mesh.points.length;
     
      for (var i = 0, iMax = contour.length; i < iMax; i++) {
          points.push([contour[i][0],contour[i][1],0.0]);
      } 
      
      mesh.addPoint(points);
      
      for (var i = 0, iMax = triangles.length; i < iMax; i++) {
          mesh.addFace([triangles[i][0]+point_ofs,triangles[i][1]+point_ofs,triangles[i][2]+point_ofs]);
      }
  }
  
  function pairDist(c1,c2) {
    var dx = c2[0]-c1[0],
        dy = c2[1]-c1[1];
        
    return Math.sqrt(dx*dx+dy*dy);
  }
  
  function findNearPair(c1,c2) {
    var minPair = [0,0];
    var minDist = pairDist(c1[0],c2[0]);
    
    var iMax = c1.length, jMax = c2.length;
    
    for (var i = 0; i < iMax; i++) {
      for (var j = 0; j < jMax; j++) {
        var d = pairDist(c1[i],c2[j]);
        if (d<minDist) {
          minPair[0] = i;
          minPair[1] = j;
          minDist = d;
        }
      }
    }
    
    return minPair;
  }
  
  function subtract(c1,c2) {
    var np = findNearPair(c1,c2);

    var result = [];  

    var a = c1[np[0]];
    result.push([a[0]+EPSILON,a[1]+EPSILON]); 
    for (var i = np[1]; i < c2.length; i++) result.push(c2[i]);
    if (np[1]) for (var i = 0; i < np[1]; i++) result.push(c2[i]);

    a = c2[np[1]];
    result.push([a[0]+EPSILON,a[1]+EPSILON]);
    for (var i = np[0]; i < c1.length; i++) result.push(c1[i]);
    if (np[0]) for (var i = 0; i < np[0]; i++) result.push(c1[i]);

    return result;
  }


  function Polygon(point_list) {
    this.points = point_list;
    this.cuts = [];
    this.result = [];
  }
  
  Polygon.prototype = {
    cut: function (pSubtract) {
      this.cuts.push(pSubtract);
    },
    
    toMesh: function(mesh) {
      if (this.points.length == 0) {
        return;
      }
      
      if (!mesh) mesh = new CubicVR.Mesh();
      
      this.result = this.points.slice(0);
      
      for (var i = 0; i < this.cuts.length; i++) {
        var pCut = this.cuts[i].points.slice(0);
        pCut = pCut.reverse();
        this.result = subtract(this.result,pCut);
      }
      
      polygonToMesh(mesh,this.result);
      
      return mesh;
    }
  };

    
  var polygon = {
    triangulate2D: triangulate2D,
    toMesh: polygonToMesh,
    findNearPair: findNearPair,
    subtract: subtract
  };    
    
  
  
  var extend = {
    polygon: polygon,
    Polygon: Polygon
  };
  
  return extend;
});
