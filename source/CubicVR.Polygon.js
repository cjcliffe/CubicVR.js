CubicVR.RegisterModule("Polygon",function(base) {
    
    var undef = base.undef;
    
    /**
    area, insideTriangle, snip and triangulate2D by John W. Ratcliff  // July 22, 2000
    See original code and more information here: http://www.flipcode.com/archives/Efficient_Polygon_Triangulation.shtml
     
    ported to actionscript by Zevan Rosser (www.actionsnippet.com)
    area, insideTriangle, snip and triangulate2D search & replaced to Javascript by Charles J. Cliffe
    additions by Charles J. Cliffe - July 2011 (www.cubicvr.org)
    */

    var EPSILON = 0.0000000001;

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
        var aX, aY, bX, bY,
          cX, cY, apx, apy,
          bpx, bpy, cpx, cpy,
          cCROSSap, bCROSScp, aCROSSbp;

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
            
            px = contour[verts[p]][0];
            py = contour[verts[p]][1];
            
            if (insideTriangle(ax, ay, bx, by, cx, cy, px, py)) return false;
        }
        return true;
    }


    // contour = [[1,1],[2,2],vec2,...]
    // returns: triangle indices to from contour
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
    
    function polygonToMesh(mesh,contour,zdepth) {
      if (zdepth===undef) {
        zdepth = 0;       
      }                  
      
      var i;
                  
      var triangulated = triangulate2D(contour);
      var triangles = CubicVR.util.repackArray(triangulated,3,triangulated.length/3);
      
      var points = [];
      
      var point_ofs = mesh.points.length;
     
      for (i = 0, iMax = contour.length; i < iMax; i++) {
          points.push([contour[i][0],contour[i][1],zdepth]);
      } 
      
      mesh.addPoint(points);
      
      for (i = 0, iMax = triangles.length; i < iMax; i++) {
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

  function minPairShift(c1,c2) {
    var minPair = findNearPair(c1,c2);
    
    var a = c1.slice(minPair[0]);
    if (minPair[0]>0) a = a.concat(c1.slice(0,minPair[0]));
    var b = c2.slice(minPair[1]);
    if (minPair[1]>0) b = b.concat(c2.slice(0,minPair[1]));

    // rewrite original arrays    
    c1.length = 0;
    c2.length = 0;
    
    var i, iMax;
    
    for (i = 0, iMax = a.length; i < iMax; i++) { 
      c1.push(a[i]);
    }
    for (i = 0, iMax = b.length; i < iMax; i++) { 
      c2.push(b[i]);
    }
  }

  function findEdgePairs(c1,c2) {
    var i,j,
      result = [],
      iMax = c1.length,
      jMax = c2.length;

    //minPairShift(c1,c2);
    
    var pairs = [];
    
    for (i = 0; i < iMax; i++) {
      for (j = 0; j < jMax; j++) {
          var d = pairDist(c1[i],c2[j]);
          result.push([d,i,j]);
        }
    }
 
    result.sort(function(a,b) { return a[0]>b[0]; } );

    var edgeLimit = 4;  // this controls the max edge run length allowed

    for (i = 0; i < 5; i++) { // sample the first few near matches instead of the full exponential meal deal
      for (j = 0; j < result.length; j++) {
        if (i==j) continue;
        if (result[i][1]!=result[j][1] && result[i][2] != result[j][2] && result[i][1]<result[j][1] && result[i][2]<result[j][2]) {
          if (Math.abs(result[i][1]-result[j][1])<edgeLimit && Math.abs(result[i][2]-result[j][2])<edgeLimit) {
            pairs.push([i,j]);
          }
        }
      }      
    }

    pairs.sort(function(a,b) { return result[a[0]][0]+result[a[1]][0] > result[b[0]][0]+result[b[1]][0]; } );
    
    if (pairs.length>10) {
      pairs.length = 10;      
    }
    
    var result_pairs = [];
    
    for (i = 0; i < pairs.length; i++) {
       result_pairs.push([result[pairs[i][0]],result[pairs[i][1]]]);
    }
    
//    console.log(result[pairs[0][0]],result[pairs[0][1]]);
    
    return result_pairs;
  }
  
  function subtract(c1,c2) { // attempt to break out an ideal segment of the polygon
    var pairs = findEdgePairs(c1,c2); // get top 10 runs of edge pairs
    var result = [];  
    var i;

    if (!pairs.length) {
      return null;  // no suitable pairs
    }

    var aPair = pairs[0][0];  // pick the top entry for now..
    var bPair = pairs[0][1];

    var aLen = bPair[1]-aPair[1];
    var bLen = bPair[2]-aPair[2];
    
    var a = c1.slice(aPair[1]);
    a = a.concat(c1.slice(0,aPair[1]));
    var b = c2.slice(aPair[2]);
    b = b.concat(c2.slice(0,aPair[2]));
    
    var polygonA = [];
    
    function wrap(a,max) { 
      if (a < 0) a += max;
      if (a > max) a -= max;
      return a;
    }
    
    for (i = aLen; i < a.length; i++) polygonA.push(a[i]);
    polygonA.push(a[0]);
    for (i = bLen; i < b.length; i++) polygonA.push(b[i]);
    polygonA.push(b[0]);

    var polygonB = [];
    
    for (i = 0; i <= aLen; i++) polygonB.push(a[i]);
    for (i = 0; i <= bLen; i++) polygonB.push(b[i]);

// TODO: use references to utilize original points instead of making dupes
/* 
    var aOfs = -aPair[1];
    var bOfs = -aPair[2];

    var aRef = [];
    var bRef = [];

    for (var i = aLen; i < a.length; i++) aRef.push([0,wrap(i+aOfs,c1.length)]);
    aRef.push([0,wrap(aOfs,c1.length)]);
    for (var i = bLen; i < b.length; i++) aRef.push([1,wrap(i+bOfs,c2.length)]);
    aRef.push([1,wrap(bOfs,c2.length)]);
    
    for (var i = 0; i <= aLen; i++) bRef.push([0,wrap(i+aOfs,c1.length)]);
    for (var i = 0; i <= bLen; i++) bRef.push([1,wrap(i+bOfs,c2.length)]);

    return [aRef,bRef];
*/
    return [polygonA,polygonB];
  }
 

  function getCenterPoint(c1) {
    var ctr = [0,0];

    for (var i = 0; i < c1.length; i++) {
      ctr[0]+=c1[i][0];
      ctr[1]+=c1[i][1];
    }
    ctr[0]/=c1.length;
    ctr[1]/=c1.length;

    return ctr;
  }

  function polarShiftPoints(c1,center,shift_val) {
    var result = [];

    for (var i = 0; i < c1.length; i++) {
        var pt = [c1[i][0]-center[0],c1[i][1]-center[1]];
        var d = Math.sqrt(pt[0]*pt[0]+pt[1]*pt[1])+shift_val;
        var a = Math.atan2(pt[1],pt[0]);
        
        result[i] = [center[0]+Math.cos(a)*d,center[1]+Math.sin(a)*d];
    }
    
    return result;
  }

  function extrudePolygonToMesh(mesh,cnear,cfar,znear,zfar) {
      var i, 
        ptOfs = mesh.points.length;
    
      if (cnear.length != cfar.length) {        
        return null;        
      }
      
      var len = cnear.length;

      for (i = 0; i < len; i++) {
          mesh.addPoint([cnear[i][0],cnear[i][1],znear]);
      }

      for (i = 0; i < len; i++) {
          mesh.addPoint([cfar[i][0],cfar[i][1],zfar]);
      }

      for (i = 0; i < len-1; i++) {
        mesh.addFace([ptOfs+i,ptOfs+i+1,ptOfs+(i+len+1),ptOfs+(i+len)]);
      }

      i = len-1;      
      mesh.addFace([ptOfs+i,ptOfs,ptOfs+len,ptOfs+(i+len)]);
  }

  
  function addOffset(c1,pt_ofs) {
      var cout = [];
      for (var i = 0, iMax = c1.length; i<iMax; i++) {
        var p = c1[i];
        cout.push([p[0]+pt_ofs[0],p[1]+pt_ofs[1]]);    
      }
      return cout;
  }
  

  function Polygon(point_list) {
    this.points = point_list;
    if (this.area() < 0) {
      this.points = point_list.reverse();
    }
    this.cuts = [];
    this.result = [];
  }
  
  Polygon.prototype = {
    cut: function (pSubtract) {
      this.cuts.push(pSubtract);
    },
    flip: function() {
      this.points = this.points.reverse();
    },
    area: function() {
      return area(this.points);
    },
    toMesh: function(mesh) {
      if (this.points.length === 0) {
        return;
      }
      
      var i;
      
      if (!mesh) mesh = new CubicVR.Mesh();
      
      this.result = [this.points];
      
      for (i = 0; i < this.cuts.length; i++) {
        var pCut = this.cuts[i].points.slice(0);
        pCut = pCut.reverse();
        
        var sub = subtract(this.result[0],pCut);
        
        this.result[0] = sub[0];
        this.result.push(sub[1]);
      }

      for (i = 0; i < this.result.length; i++) {
        polygonToMesh(mesh,this.result[i]);
      }      

      mesh.removeDoubles();

      return mesh;
    },

    toExtrudedMesh: function(mesh,zfront,zback) {
      if (this.points.length === 0) {
        return;
      }
      
      var pCut,i;

      if (zfront===undef) zfront=0;
      if (zback===undef) zback=0;
      var hasDepth = (zfront!=zback);
      
      if (!mesh) mesh = new CubicVR.Mesh();
      
      this.result = [this.points];
      
      for (i = 0; i < this.cuts.length; i++) {
        pCut = this.cuts[i].points.slice(0);
        pCut = pCut.reverse();
        
        var sub = subtract(this.result[0],pCut);
        
        this.result[0] = sub[0];
        this.result.push(sub[1]);
      }

      var faceMesh = new CubicVR.Mesh();

      for (i = 0; i < this.result.length; i++) {
        polygonToMesh(faceMesh,this.result[i],zback);
      }

      mesh.booleanAdd(faceMesh);

      faceMesh.flipFaces();

      if (hasDepth) {
        for (i = 0; i < faceMesh.points.length; i++) { 
          faceMesh.points[i][2] = zfront;
        }
      }

      mesh.booleanAdd(faceMesh);

      if (hasDepth) {
        extrudePolygonToMesh(mesh,this.points,this.points,zfront,zback);

        for (i = 0; i < this.cuts.length; i++) {
          pCut = this.cuts[i].points.slice(0);
          pCut = pCut.reverse();
          extrudePolygonToMesh(mesh,pCut,pCut,zfront,zback);
        }
      }

      mesh.removeDoubles();
    
      return mesh;
    },

    toExtrudedBeveledMesh: function(mesh,zfront,zback,zfront_depth,zfront_shift,zback_depth,zback_shift) {
      var front_cuts = [],
       back_cuts = [],
       back_bevel_points,
       front_bevel_points,
       pCut,i,sub,cut_center;

      if (this.points.length === 0) {
        return;
      }
      
      if (typeof(zfront)==='object') {
        var opt = zfront;
        
        zfront = opt.front||0;
        zback = opt.back||0;
        zfront_depth = opt.frontDepth||0;
        zfront_shift = opt.frontShift||0;
        zback_depth = opt.backDepth||0;
        zback_shift = opt.backShift||0;        
      }

      var hasDepth = (zfront!==zback);
      var hasBackDepth = (zback_depth!==0);
      var hasFrontDepth = (zfront_depth!==0);
      
      if (!mesh) mesh = new CubicVR.Mesh();

      if (hasFrontDepth) {
         
        var front_center = getCenterPoint(this.points);
        front_bevel_points = polarShiftPoints(this.points,front_center,-zfront_shift);
        
        this.result = [front_bevel_points.slice(0)];
      } else {
        this.result = [this.points.slice(0)];
      }
      
      for (i = 0; i < this.cuts.length; i++) {
        cut_center = getCenterPoint(this.cuts[i].points);
        pCut = polarShiftPoints(this.cuts[i].points,cut_center,zfront_shift);        
        pCut = pCut.reverse();
        front_cuts.push(pCut);

        
        sub = subtract(this.result[0],pCut);
        
        this.result[0] = sub[0];
        this.result.push(sub[1]);
      }

      var faceMesh = new CubicVR.Mesh();

      for (i = 0; i < this.result.length; i++) {
        polygonToMesh(faceMesh,this.result[i],zfront-zfront_depth);
      }

      faceMesh.flipFaces();

      mesh.booleanAdd(faceMesh);

      if (hasBackDepth || hasFrontDepth) {
        var back_center = getCenterPoint(this.points);
        back_bevel_points = polarShiftPoints(this.points,back_center,-zback_shift);

        this.result = [back_bevel_points.slice(0)];


        for (i = 0; i < this.cuts.length; i++) {
          cut_center = getCenterPoint(this.cuts[i].points);
          pCut = polarShiftPoints(this.cuts[i].points,cut_center,zback_shift);
          pCut = pCut.reverse();
          back_cuts.push(pCut);
          
          sub = subtract(this.result[0],pCut);
          
          this.result[0] = sub[0];
          this.result.push(sub[1]);
        }

        faceMesh = new CubicVR.Mesh();

        for (i = 0; i < this.result.length; i++) {
          polygonToMesh(faceMesh,this.result[i],zback+zback_depth);
        }
      } else {
        for (i = 0; i < faceMesh.points.length; i++) {
          faceMesh.points[i][2] = zback;
        }
        faceMesh.flipFaces();                  
        
      }

      mesh.booleanAdd(faceMesh);

      if (hasFrontDepth) extrudePolygonToMesh(mesh,front_bevel_points,this.points,zfront-zfront_depth,zfront);
      if (hasDepth) extrudePolygonToMesh(mesh,this.points,this.points,zfront,zback);
      if (hasBackDepth) extrudePolygonToMesh(mesh,this.points,back_bevel_points,zback,zback+zback_depth);

      for (i = 0; i < front_cuts.length; i++) {
        pCut = this.cuts[i].points.slice(0).reverse();

        if (hasFrontDepth) {
          extrudePolygonToMesh(mesh,front_cuts[i],pCut,zfront-zfront_depth,zfront);
        }
        
        if (hasDepth) {
          extrudePolygonToMesh(mesh,pCut,pCut,zfront,zback);       
        }
        
        if (hasBackDepth) {
          extrudePolygonToMesh(mesh,pCut,back_cuts[i],zback,zback+zback_depth);
        }
      }

      mesh.removeDoubles();
    
      return mesh;
    }    

  };


  function normal(points) { // Newell's method for arbitrary 3d polygon
      var norm = [0,0,0];
      for (var i = 0, iMax = points.length; i<iMax; i++) {
 
        var current_vertex = points[i];
        var next_vertex = points[(i+1)%iMax];

        norm[0] += (current_vertex[1] - next_vertex[1]) * (current_vertex[2] + next_vertex[2]);
        norm[1] += (current_vertex[2] - next_vertex[2]) * (current_vertex[0] + next_vertex[0]);
        norm[2] += (current_vertex[0] - next_vertex[0]) * (current_vertex[1] + next_vertex[1]);
      }
      
      return base.vec3.normalize(norm);
  }

    
  var polygon = {
    triangulate2D: triangulate2D,
    toMesh: polygonToMesh,
    findNearPair: findNearPair,
    subtract: subtract,
    addOffset: addOffset,
    normal: normal
  };    
    
  
  
  var extend = {
    polygon: polygon,
    Polygon: Polygon
  };
  
  return extend;
});
