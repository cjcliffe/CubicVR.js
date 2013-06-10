CubicVR.RegisterModule("Math",function (base) {

  var undef = base.undef;

  var cubicvr_identity = [1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0];

  var M_TWO_PI = 2.0 * Math.PI;
  var M_HALF_PI = Math.PI / 2.0;

  var enums = base.enums;
  
  enums.aabb = {
    DISJOINT: 0,
    A_INSIDE_B: 1,
    B_INSIDE_A: 2,
    INTERSECT: 3
  };
  
  enums.frustum_plane = {
      LEFT: 0,
      RIGHT: 1,
      TOP: 2,
      BOTTOM: 3,
      NEAR: 4,
      FAR: 5
  };
  
  /* Base functions */
  var vec2 = {
    equal: function(a, b, epsilon) {
      if (epsilon===undef) epsilon = 0.00000001;

      if ((a === undef) && (b === undef)) {
        return true;
      }
      if ((a === undef) || (b === undef)) {
        return false;
      }

      return (Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon);
    },
    onLine: function(a,b,c) {
        var minx = (a[0]<b[0])?a[0]:b[0];
        var miny = (a[1]<b[1])?a[1]:b[1];
        var maxx = (a[0]>b[0])?a[0]:b[0];
        var maxy = (a[1]>b[1])?a[1]:b[1];
        
        if ((minx <= c[0] && c[0] <= maxx) && (miny <= c[1] && c[1] <= maxy)) {
            return true;
        } else {
            return false;
        }
    },
    lineIntersect: function(a1,a2,b1,b2) {
        var x1 = a1[0], y1 = a1[1], x2 = a2[0], y2 = a2[1];        
        var x3 = b1[0], y3 = b1[1], x4 = b2[0], y4 = b2[1];

        var d = ((x1-x2) * (y3-y4)) - ((y1-y2) * (x3-x4));
        if (d === 0) return false;

        var xi = (((x3-x4) * ((x1*y2)-(y1*x2))) - ((x1-x2) *((x3*y4)-(y3*x4))))/d;
        var yi = (((y3-y4) * ((x1*y2)-(y1*x2))) - ((y1-y2) *((x3*y4)-(y3*x4))))/d;

        return [xi,yi];
    },
    add: function(a,b) {
        return [a[0]+b[0],a[1]+b[1]];
    },
    subtract: function(a,b) {
        return [a[0]-b[0],a[1]-b[1]];
    },
    length: function(a,b) {
        if (b === undef) {
            return Math.sqrt(a[0]*a[0]+a[1]*a[1]);
        }
        
        var s = [a[0]-b[0],a[1]-b[1]];

        return Math.sqrt(s[0]*s[0]+s[1]*s[1]);
    }
  };

  var vec3 = {
    length: function(pta,ptb) {
      var a,b,c;
      if (ptb===undef) {
          a = pta[0];
          b = pta[1];
          c = pta[2];
      } else {
          a = ptb[0]-pta[0];
          b = ptb[1]-pta[1];
          c = ptb[2]-pta[2];
      }
      return Math.sqrt((a*a) + (b*b) + (c*c));
    },
    normalize: function(pt) {
      var a = pt[0], b = pt[1], c = pt[2];
      var d = Math.sqrt((a*a) + (b*b) + (c*c));
      if (d) {
        return [pt[0] / d, pt[1] / d, pt[2] / d];
      }
      return [0, 0, 0];
    },
    dot: function(v1, v2) {
      return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    },
    angle: function(v1, v2) {
      var a = Math.acos((v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1] + v1[2] * v1[2]) * Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1] + v2[2] * v2[2])));

      return a;
    },
    cross: function(vectA, vectB) {
      return [
      vectA[1] * vectB[2] - vectB[1] * vectA[2], vectA[2] * vectB[0] - vectB[2] * vectA[0], vectA[0] * vectB[1] - vectB[0] * vectA[1]];
    },
    multiply: function(vectA, constB) {
      return [vectA[0] * constB, vectA[1] * constB, vectA[2] * constB];
    },
    add: function(vectA, vectB) {
      return [vectA[0] + vectB[0], vectA[1] + vectB[1], vectA[2] + vectB[2]];
    },
    subtract: function(vectA, vectB) {
      return [vectA[0] - vectB[0], vectA[1] - vectB[1], vectA[2] - vectB[2]];
    },
    equal: function(a, b, epsilon) {
      if (epsilon===undef) epsilon = 0.0000001;

      if ((a === undef) && (b === undef)) {
        return true;
      }
      if ((a === undef) || (b === undef)) {
        return false;
      }

      return (Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon && Math.abs(a[2] - b[2]) < epsilon);
    },
    moveViewRelative: function(position, target, xdelta, zdelta, alt_source) {
      var ang = Math.atan2(zdelta, xdelta);
      var cam_ang = Math.atan2(target[2] - position[2], target[0] - position[0]);
      var mag = Math.sqrt(xdelta * xdelta + zdelta * zdelta);

      var move_ang = cam_ang + ang + M_HALF_PI;

      if (typeof(alt_source) === 'object') {
        return [alt_source[0] + mag * Math.cos(move_ang), alt_source[1], alt_source[2] + mag * Math.sin(move_ang)];
      }

      return [position[0] + mag * Math.cos(move_ang), position[1], position[2] + mag * Math.sin(move_ang)];
    },
    trackTarget: function(position, target, trackingSpeed, safeDistance) {
      var camv = vec3.subtract(target, position);
      var dist = camv;
      var fdist = vec3.length(dist);
      var motionv = camv;

      motionv = vec3.normalize(motionv);
      motionv = vec3.multiply(motionv, trackingSpeed * (1.0 / (1.0 / (fdist - safeDistance))));

      var ret_pos;

      if (fdist > safeDistance) {
        ret_pos = vec3.add(position, motionv);
      } else if (fdist < safeDistance) {
        motionv = camv;
        motionv = vec3.normalize(motionv);
        motionv = vec3.multiply(motionv, trackingSpeed * (1.0 / (1.0 / (Math.abs(fdist - safeDistance)))));
        ret_pos = vec3.subtract(position, motionv);
      } else {
        ret_pos = [position[0], position[1] + motionv[2], position[2]];
      }

      return ret_pos;
    },
    getClosestTo: function(ptA, ptB, ptTest) {
      var S, T, U;

      S = vec3.subtract(ptB, ptA);
      T = vec3.subtract(ptTest, ptA);
      U = vec3.add(vec3.multiply(S, vec3.dot(S, T) / vec3.dot(S, S)), ptA);

      return U;
    },
    linePlaneIntersect: function(normal, point_on_plane, segment_start, segment_end)
    {
        // form a plane from normal and point_on_plane and test segment start->end to find intersect point
        var denom,mu;
    
        var d = - normal[0] * point_on_plane[0] - normal[1] * point_on_plane[1] - normal[2] * point_on_plane[2];
    
        // calculate position where the plane intersects the segment
        denom = normal[0] * (segment_end[0] - segment_start[0]) + normal[1] * (segment_end[1] - segment_start[1]) + normal[2] * (segment_end[2] - segment_start[2]);
        if (Math.abs(denom) < 0.001) return false;
    
        mu = - (d + normal[0] * segment_start[0] + normal[1] * segment_start[1] + normal[2] * segment_start[2]) / denom;
        return [
             (segment_start[0] + mu * (segment_end[0] - segment_start[0])),
             (segment_start[1] + mu * (segment_end[1] - segment_start[1])),
             (segment_start[2] + mu * (segment_end[2] - segment_start[2]))
        ];
    }
  };

  var triangle = {
    normal: function(pt1, pt2, pt3, mOut) {
      if (mOut === undef) mOut = [];
      
      var v10 = pt1[0] - pt2[0];
      var v11 = pt1[1] - pt2[1];
      var v12 = pt1[2] - pt2[2];
      var v20 = pt2[0] - pt3[0];
      var v21 = pt2[1] - pt3[1];
      var v22 = pt2[2] - pt3[2];
      
      mOut[0] = v11 * v22 - v12 * v21;
      mOut[1] = v12 * v20 - v10 * v22;
      mOut[2] = v10 * v21 - v11 * v20;
      
      return mOut;
    }
  };
  
  
  var mat3 = {
    transpose_inline: function(mat) {
        var a01 = mat[1], a02 = mat[2], a12 = mat[5];

        mat[1] = mat[3];
        mat[2] = mat[6];
        mat[3] = a01;
        mat[5] = mat[7];
        mat[6] = a02;
        mat[7] = a12;
    },
    vec3_multiply: function (m1, m2, mOut) {
        if (mOut === undef) mOut = [];


        mOut[0] = m2[0] * m1[0] + m2[3] * m1[1] + m2[6] * m1[2] ;
        mOut[1] = m2[1] * m1[0] + m2[4] * m1[1] + m2[7] * m1[2] ;
        mOut[2] = m2[2] * m1[0] + m2[5] * m1[1] + m2[8] * m1[2];

        return mOut;
    }
  };

  var mat4 = {
      lookat: function(eyex, eyey, eyez, centerx, centery, centerz, upx, upy, upz) {
          var forward = [], side = [], up = [];
          var m = [];

          forward[0] = centerx - eyex;
          forward[1] = centery - eyey;
          forward[2] = centerz - eyez;

          up[0] = upx;
          up[1] = upy;
          up[2] = upz;

          forward = vec3.normalize(forward);

          /* Side = forward x up */
          side = vec3.cross(forward, up);
          side = vec3.normalize(side);

          /* Recompute up as: up = side x forward */
          up = vec3.cross(side, forward);

          m = [ side[0], up[0], -forward[0], 0, side[1], up[1], -forward[1], 0, side[2], up[2], -forward[2], 0, 0, 0, 0, 1];

          var t = new base.Transform(m);
          t.translate([-eyex,-eyey,-eyez]);

          return t.getResult();
      },
      multiply: function (mRight, mLeft, mOut) { // TODO: get these swapped to L,R and fix up usage for consistency
          if (mOut === undef) mOut = [];

          mOut[0] = mRight[0] * mLeft[0] + mRight[4] * mLeft[1] + mRight[8] * mLeft[2] + mRight[12] * mLeft[3];
          mOut[1] = mRight[1] * mLeft[0] + mRight[5] * mLeft[1] + mRight[9] * mLeft[2] + mRight[13] * mLeft[3];
          mOut[2] = mRight[2] * mLeft[0] + mRight[6] * mLeft[1] + mRight[10] * mLeft[2] + mRight[14] * mLeft[3];
          mOut[3] = mRight[3] * mLeft[0] + mRight[7] * mLeft[1] + mRight[11] * mLeft[2] + mRight[15] * mLeft[3];
          mOut[4] = mRight[0] * mLeft[4] + mRight[4] * mLeft[5] + mRight[8] * mLeft[6] + mRight[12] * mLeft[7];
          mOut[5] = mRight[1] * mLeft[4] + mRight[5] * mLeft[5] + mRight[9] * mLeft[6] + mRight[13] * mLeft[7];
          mOut[6] = mRight[2] * mLeft[4] + mRight[6] * mLeft[5] + mRight[10] * mLeft[6] + mRight[14] * mLeft[7];
          mOut[7] = mRight[3] * mLeft[4] + mRight[7] * mLeft[5] + mRight[11] * mLeft[6] + mRight[15] * mLeft[7];
          mOut[8] = mRight[0] * mLeft[8] + mRight[4] * mLeft[9] + mRight[8] * mLeft[10] + mRight[12] * mLeft[11];
          mOut[9] = mRight[1] * mLeft[8] + mRight[5] * mLeft[9] + mRight[9] * mLeft[10] + mRight[13] * mLeft[11];
          mOut[10] = mRight[2] * mLeft[8] + mRight[6] * mLeft[9] + mRight[10] * mLeft[10] + mRight[14] * mLeft[11];
          mOut[11] = mRight[3] * mLeft[8] + mRight[7] * mLeft[9] + mRight[11] * mLeft[10] + mRight[15] * mLeft[11];
          mOut[12] = mRight[0] * mLeft[12] + mRight[4] * mLeft[13] + mRight[8] * mLeft[14] + mRight[12] * mLeft[15];
          mOut[13] = mRight[1] * mLeft[12] + mRight[5] * mLeft[13] + mRight[9] * mLeft[14] + mRight[13] * mLeft[15];
          mOut[14] = mRight[2] * mLeft[12] + mRight[6] * mLeft[13] + mRight[10] * mLeft[14] + mRight[14] * mLeft[15];
          mOut[15] = mRight[3] * mLeft[12] + mRight[7] * mLeft[13] + mRight[11] * mLeft[14] + mRight[15] * mLeft[15];

          return mOut;
      },
      vec4_multiply: function (m1, m2, mOut) {
          if (mOut === undef) mOut = [];

          mOut[0] = m2[0] * m1[0] + m2[4] * m1[1] + m2[8] * m1[2] + m2[12] * m1[3];
          mOut[1] = m2[1] * m1[0] + m2[5] * m1[1] + m2[9] * m1[2] + m2[13] * m1[3];
          mOut[2] = m2[2] * m1[0] + m2[6] * m1[1] + m2[10] * m1[2] + m2[14] * m1[3];
          mOut[3] = m2[3] * m1[0] + m2[7] * m1[1] + m2[11] * m1[2] + m2[15] * m1[3];

          return mOut;
      },
      vec3_multiply: function (m1, m2, mOut) {
          if (mOut === undef) mOut = [];

          mOut[0] = m2[0] * m1[0] + m2[4] * m1[1] + m2[8] * m1[2] + m2[12];
          mOut[1] = m2[1] * m1[0] + m2[5] * m1[1] + m2[9] * m1[2] + m2[13];
          mOut[2] = m2[2] * m1[0] + m2[6] * m1[1] + m2[10] * m1[2] + m2[14];

          return mOut;
      },
      perspective: function (fovy, aspect, near, far) {
          var yFac = Math.tan(fovy * Math.PI / 360.0);
          var xFac = yFac * aspect;

          return [
          1.0 / xFac, 0, 0, 0, 0, 1.0 / yFac, 0, 0, 0, 0, -(far + near) / (far - near), -1, 0, 0, -(2.0 * far * near) / (far - near), 0];
      },
      ortho: function(left,right,bottom,top,near,far) {
        return [2 / (right - left), 0, 0, 0, 0, 2 / (top - bottom), 0, 0, 0, 0, -2 / (far - near), 0, -(left + right) / (right - left), -(top + bottom) / (top - bottom), -(far + near) / (far - near), 1];
      },
      determinant: function (m) {

          var a0 = m[0] * m[5] - m[1] * m[4];
          var a1 = m[0] * m[6] - m[2] * m[4];
          var a2 = m[0] * m[7] - m[3] * m[4];
          var a3 = m[1] * m[6] - m[2] * m[5];
          var a4 = m[1] * m[7] - m[3] * m[5];
          var a5 = m[2] * m[7] - m[3] * m[6];
          var b0 = m[8] * m[13] - m[9] * m[12];
          var b1 = m[8] * m[14] - m[10] * m[12];
          var b2 = m[8] * m[15] - m[11] * m[12];
          var b3 = m[9] * m[14] - m[10] * m[13];
          var b4 = m[9] * m[15] - m[11] * m[13];
          var b5 = m[10] * m[15] - m[11] * m[14];

          var det = a0 * b5 - a1 * b4 + a2 * b3 + a3 * b2 - a4 * b1 + a5 * b0;

          return det;
      },
      coFactor: function (m, n, out) {
        // .. todo..
      },

      transpose: function (m) {
          return [m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14], m[3], m[7], m[11], m[15]];
      },

      inverse_mat3: function(mat) {
          var dest = [];

          var a00 = mat[0], a01 = mat[1], a02 = mat[2],
          a10 = mat[4], a11 = mat[5], a12 = mat[6],
          a20 = mat[8], a21 = mat[9], a22 = mat[10];

          var b01 = a22*a11-a12*a21,
          b11 = -a22*a10+a12*a20,
          b21 = a21*a10-a11*a20;

          var d = a00*b01 + a01*b11 + a02*b21;
          if (!d) { return null; }
          var id = 1/d;

          dest[0] = b01*id;
          dest[1] = (-a22*a01 + a02*a21)*id;
          dest[2] = (a12*a01 - a02*a11)*id;
          dest[3] = b11*id;
          dest[4] = (a22*a00 - a02*a20)*id;
          dest[5] = (-a12*a00 + a02*a10)*id;
          dest[6] = b21*id;
          dest[7] = (-a21*a00 + a01*a20)*id;
          dest[8] = (a11*a00 - a01*a10)*id;

          return dest;
      },
      
      inverse: function (m,m_inv) {

          var a0 = m[0] * m[5] - m[1] * m[4];
          var a1 = m[0] * m[6] - m[2] * m[4];
          var a2 = m[0] * m[7] - m[3] * m[4];
          var a3 = m[1] * m[6] - m[2] * m[5];
          var a4 = m[1] * m[7] - m[3] * m[5];
          var a5 = m[2] * m[7] - m[3] * m[6];
          var b0 = m[8] * m[13] - m[9] * m[12];
          var b1 = m[8] * m[14] - m[10] * m[12];
          var b2 = m[8] * m[15] - m[11] * m[12];
          var b3 = m[9] * m[14] - m[10] * m[13];
          var b4 = m[9] * m[15] - m[11] * m[13];
          var b5 = m[10] * m[15] - m[11] * m[14];

          var determinant = a0 * b5 - a1 * b4 + a2 * b3 + a3 * b2 - a4 * b1 + a5 * b0;

          if (determinant !== 0) {
              if (m_inv === undef) m_inv = [];
              
              m_inv[0] = 0 + m[5] * b5 - m[6] * b4 + m[7] * b3;
              m_inv[4] = 0 - m[4] * b5 + m[6] * b2 - m[7] * b1;
              m_inv[8] = 0 + m[4] * b4 - m[5] * b2 + m[7] * b0;
              m_inv[12] = 0 - m[4] * b3 + m[5] * b1 - m[6] * b0;
              m_inv[1] = 0 - m[1] * b5 + m[2] * b4 - m[3] * b3;
              m_inv[5] = 0 + m[0] * b5 - m[2] * b2 + m[3] * b1;
              m_inv[9] = 0 - m[0] * b4 + m[1] * b2 - m[3] * b0;
              m_inv[13] = 0 + m[0] * b3 - m[1] * b1 + m[2] * b0;
              m_inv[2] = 0 + m[13] * a5 - m[14] * a4 + m[15] * a3;
              m_inv[6] = 0 - m[12] * a5 + m[14] * a2 - m[15] * a1;
              m_inv[10] = 0 + m[12] * a4 - m[13] * a2 + m[15] * a0;
              m_inv[14] = 0 - m[12] * a3 + m[13] * a1 - m[14] * a0;
              m_inv[3] = 0 - m[9] * a5 + m[10] * a4 - m[11] * a3;
              m_inv[7] = 0 + m[8] * a5 - m[10] * a2 + m[11] * a1;
              m_inv[11] = 0 - m[8] * a4 + m[9] * a2 - m[11] * a0;
              m_inv[15] = 0 + m[8] * a3 - m[9] * a1 + m[10] * a0;

              var inverse_det = 1.0 / determinant;

              m_inv[0] *= inverse_det;
              m_inv[1] *= inverse_det;
              m_inv[2] *= inverse_det;
              m_inv[3] *= inverse_det;
              m_inv[4] *= inverse_det;
              m_inv[5] *= inverse_det;
              m_inv[6] *= inverse_det;
              m_inv[7] *= inverse_det;
              m_inv[8] *= inverse_det;
              m_inv[9] *= inverse_det;
              m_inv[10] *= inverse_det;
              m_inv[11] *= inverse_det;
              m_inv[12] *= inverse_det;
              m_inv[13] *= inverse_det;
              m_inv[14] *= inverse_det;
              m_inv[15] *= inverse_det;

              return m_inv;
          }

          return null; 
      },
      
   identity: function(mOut) {
     if (mOut == undef) { 
       return [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
     }
     
     mOut[0] = 1.0;  mOut[1] = 0.0;  mOut[2] = 0.0;  mOut[3] = 0.0; 
     mOut[4] = 0.0;  mOut[5] = 1.0;  mOut[6] = 0.0;  mOut[7] = 0.0; 
     mOut[8] = 0.0;  mOut[9] = 0.0;  mOut[10] = 1.0; mOut[11] = 0.0; 
     mOut[12] = 0.0; mOut[13] = 0.0; mOut[14] = 0.0; mOut[15] = 1.0;        
   },
           
   translate: function(x, y, z, mOut) {
      var m = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, x,   y,   z, 1.0];

      if (mOut === undef) return m;

      mat4.multiply(mOut.slice(0),m,mOut);
   },

   rotateAxis: function(r, x, y, z, mOut) {   // rotate r about axis x,y,z
	    var sAng = Math.sin(r*(Math.PI/180.0));
	    var cAng = Math.cos(r*(Math.PI/180.0));
      
      var m = [ cAng+(x*x)*(1.0-cAng), x*y*(1.0-cAng) - z*sAng, x*z*(1.0-cAng) + y*sAng, 0,
                  y*x*(1.0-cAng)+z*sAng, cAng + y*y*(1.0-cAng), y*z*(1.0-cAng)-x*sAng, 0,
                  z*x*(1.0-cAng)-y*sAng, z*y*(1-cAng)+x*sAng, cAng+(z*z)*(1.0-cAng), 0, 
                  0, 0, 0, 1 ];
	
	    if (mOut === undef) return m;
	
      mat4.multiply(mOut.slice(0),m,mOut);
   },

   rotate: function(x, y, z, mOut) {   // rotate each axis, angles x, y, z in turn
      var sAng,cAng;
      if (mOut === undef) {
        mOut = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
      }
         
	    if (z!==0) {
	      sAng = Math.sin(z*(Math.PI/180.0));
	      cAng = Math.cos(z*(Math.PI/180.0));

        mat4.multiply(mOut.slice(0),[cAng, sAng, 0.0, 0.0, -sAng, cAng, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0],mOut);
	    }
	    
	    if (y!==0) {
	      sAng = Math.sin(y*(Math.PI/180.0));
	      cAng = Math.cos(y*(Math.PI/180.0));

        mat4.multiply(mOut.slice(0),[cAng, 0.0, -sAng, 0.0, 0.0, 1.0, 0.0, 0.0, sAng, 0.0, cAng, 0.0, 0.0, 0.0, 0.0, 1.0],mOut);
	    }
	    
	    if (x!==0) {
	      sAng = Math.sin(x*(Math.PI/180.0));
	      cAng = Math.cos(x*(Math.PI/180.0));
                
        mat4.multiply(mOut.slice(0),[1.0, 0.0, 0.0, 0.0, 0.0, cAng, sAng, 0.0, 0.0, -sAng, cAng, 0.0, 0.0, 0.0, 0.0, 1.0],mOut);
	    }
	    
	    return mOut;
   },

   scale: function(x, y, z, mOut) {    
     if (mOut === undef) return [x, 0.0, 0.0, 0.0, 0.0, y, 0.0, 0.0, 0.0, 0.0, z, 0.0, 0.0, 0.0, 0.0, 1.0];
    
      mat4.multiply(mOut.slice(0),[x, 0.0, 0.0, 0.0, 0.0, y, 0.0, 0.0, 0.0, 0.0, z, 0.0, 0.0, 0.0, 0.0, 1.0],mOut);
   },
   
   transform: function(position, rotation, scale) {
        var m = mat4.identity();
        
        if (position) {
            mat4.translate(position[0],position[1],position[2],m);
        }
        if (rotation) {
            if (!(rotation[0] === 0 && rotation[1] === 0 && rotation[2] === 0)) {
                mat4.rotate(rotation[0],rotation[1],rotation[2],m);
            }
        }
        if (scale) {
            if (!(scale[0] === 1 && scale[1] === 1 && scale[2] === 1)) {
                mat4.scale(scale[0],scale[1],scale[2],m);
            }
        }
        
        return m;
   }      
  };
  
  /* Transform Controller */

  function Transform(init_mat) {
    return this.clearStack(init_mat);
  }

  Transform.prototype = {
      setIdentity: function() {
        this.m_stack[this.c_stack] = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
        if (this.valid === this.c_stack && this.c_stack) {
          this.valid--;
        }
        return this;
      },

      getIdentity: function() {
        return [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
      },

      invalidate: function() {
        this.valid = 0;
        this.result = null;
        return this;
      },
      
      getResult: function() {
        var mat4 = base.mat4;
        if (!this.c_stack) {
          return this.m_stack[0];
        }
        
        var m = cubicvr_identity;
        
        if (this.valid > this.c_stack-1) this.valid = this.c_stack-1;
                    
        for (var i = this.valid; i < this.c_stack+1; i++) {
          m = mat4.multiply(m,this.m_stack[i]);
          this.m_cache[i] = m;
        }
          
        this.valid = this.c_stack-1;
          
        this.result = this.m_cache[this.c_stack];
        
        return this.result;
      },
      
      pushMatrix: function(m) {
        this.c_stack++;
        this.m_stack[this.c_stack] = (m ? m : cubicvr_identity);
        return this;
      },

      popMatrix: function() {
        if (this.c_stack === 0) {
          return;
        }
        this.c_stack--;
        return this;
      },

      clearStack: function(init_mat) {
        this.m_stack = [];
        this.m_cache = [];
        this.c_stack = 0;
        this.valid = 0;
        this.result = null;

        if (init_mat !== undef) {
          this.m_stack[0] = init_mat;
        } else {
          this.setIdentity();
        }

        return this;
      },

      translate: function(x, y, z) {
        var mat4 = base.mat4;
        if (typeof(x) === 'object') {
          return this.translate(x[0], x[1], x[2]);
        }

        var m = this.getIdentity();

        m[12] = x;
        m[13] = y;
        m[14] = z;

        this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack],m);
        if (this.valid === this.c_stack && this.c_stack) {
          this.valid--;
        }

        return this;
      },

      scale: function(x, y, z) {
        var mat4 = base.mat4;
        if (typeof(x) === 'object') {
          return this.scale(x[0], x[1], x[2]);
        }


        var m = this.getIdentity();

        m[0] = x;
        m[5] = y;
        m[10] = z;

        this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack],m);
        if (this.valid === this.c_stack && this.c_stack) {
          this.valid--;
        }

        return this;
      },

      rotate: function(ang, x, y, z) {
        var mat4 = base.mat4;
        if (typeof(ang) === 'object') {
          this.rotate(ang[0], 1, 0, 0);
          this.rotate(ang[1], 0, 1, 0);
          this.rotate(ang[2], 0, 0, 1);
          return this;
        }

        var sAng, cAng;

        if (x || y || z) {
          sAng = Math.sin(-ang * (Math.PI / 180.0));
          cAng = Math.cos(-ang * (Math.PI / 180.0));
        }

        if (x) {
          var X_ROT = this.getIdentity();

          X_ROT[5] = cAng * x;
          X_ROT[9] = sAng * x;
          X_ROT[6] = -sAng * x;
          X_ROT[10] = cAng * x;

          this.m_stack[this.c_stack] = mat4.multiply(X_ROT,this.m_stack[this.c_stack]);
        }

        if (y) {
          var Y_ROT = this.getIdentity();

          Y_ROT[0] = cAng * y;
          Y_ROT[8] = -sAng * y;
          Y_ROT[2] = sAng * y;
          Y_ROT[10] = cAng * y;

          this.m_stack[this.c_stack] = mat4.multiply(Y_ROT,this.m_stack[this.c_stack]);
        }

        if (z) {
          var Z_ROT = this.getIdentity();

          Z_ROT[0] = cAng * z;
          Z_ROT[4] = sAng * z;
          Z_ROT[1] = -sAng * z;
          Z_ROT[5] = cAng * z;

          this.m_stack[this.c_stack] = mat4.multiply(Z_ROT,this.m_stack[this.c_stack]);
        }

        if (this.valid === this.c_stack && this.c_stack) {
          this.valid--;
        }

        return this;
      }
  };
  
  /* Quaternions */
  function Quaternion() {
    if (arguments.length === 1) {
      this.x = arguments[0][0];
      this.y = arguments[0][1];
      this.z = arguments[0][2];
      this.w = arguments[0][3];
    }
    if (arguments.length === 4) {
      this.x = arguments[0];
      this.y = arguments[1];
      this.z = arguments[2];
      this.w = arguments[3];
    }
  }

  Quaternion.prototype = {
  
    length: function() {
      return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    },

    normalize: function() {
      var n = Math.sqrt(this.length());
      this.x /= n;
      this.y /= n;
      this.z /= n;
      this.w /= n;
    },

    fromMatrix: function(mat) {
      var t = 1 + mat[0] + mat[5] + mat[10];
      var S,X,Y,Z,W;

      if ( t > 0.00000001 ) {
        S = Math.sqrt(t) * 2;
        X = ( mat[9] - mat[6] ) / S;
        Y = ( mat[2] - mat[8] ) / S;
        Z = ( mat[4] - mat[1] ) / S;
        W = 0.25 * S;
      } else {
        if ( mat[0] > mat[5] && mat[0] > mat[10] )  {	// Column 0: 
            S  = Math.sqrt( 1.0 + mat[0] - mat[5] - mat[10] ) * 2;
            X = 0.25 * S;
            Y = (mat[4] + mat[1] ) / S;
            Z = (mat[2] + mat[8] ) / S;
            W = (mat[9] - mat[6] ) / S;
        } else if ( mat[5] > mat[10] ) {			// Column 1: 
            S  = Math.sqrt( 1.0 + mat[5] - mat[0] - mat[10] ) * 2;
            X = (mat[4] + mat[1] ) / S;
            Y = 0.25 * S;
            Z = (mat[9] + mat[6] ) / S;
            W = (mat[2] - mat[8] ) / S;
        } else {						// Column 2:
            S  = Math.sqrt( 1.0 + mat[10] - mat[0] - mat[5] ) * 2;
            X = (mat[2] + mat[8] ) / S;
            Y = (mat[9] + mat[6] ) / S;
            Z = 0.25 * S;
            W = (mat[4] - mat[1] ) / S;
        }
     }

     this.x = X;
     this.y = Y;
     this.z = Z;
     this.w = W;        
    },

    fromEuler: function(bank, heading, pitch) // x,y,z
    {
      var c1 = Math.cos((Math.PI / 180.0) * heading / 2.0);
      var s1 = Math.sin((Math.PI / 180.0) * heading / 2.0);
      var c2 = Math.cos((Math.PI / 180.0) * pitch / 2.0);
      var s2 = Math.sin((Math.PI / 180.0) * pitch / 2.0);
      var c3 = Math.cos((Math.PI / 180.0) * bank / 2.0);
      var s3 = Math.sin((Math.PI / 180.0) * bank / 2.0);
      var c1c2 = c1 * c2;
      var s1s2 = s1 * s2;

      this.w = c1c2 * c3 - s1s2 * s3;
      this.x = c1c2 * s3 + s1s2 * c3;
      this.y = s1 * c2 * c3 + c1 * s2 * s3;
      this.z = c1 * s2 * c3 - s1 * c2 * s3;
    },

    toEuler: function() {
      var sqw = this.w * this.w;
      var sqx = this.x * this.x;
      var sqy = this.y * this.y;
      var sqz = this.z * this.z;

      var x = (180 / Math.PI) * ((Math.atan2(2.0 * (this.y * this.z + this.x * this.w), (-sqx - sqy + sqz + sqw))));
      var y = (180 / Math.PI) * ((Math.asin(-2.0 * (this.x * this.z - this.y * this.w))));
      var z = (180 / Math.PI) * ((Math.atan2(2.0 * (this.x * this.y + this.z * this.w), (sqx - sqy - sqz + sqw))));

      return [x, y, z];
    },

    multiply: function(q1, q2) {
      var selfSet = false;

      if (q2 === undef) {
        q2 = q1;
        q1 = this;
      }

      var x = q1.x * q2.w + q1.w * q2.x + q1.y * q2.z - q1.z * q2.y;
      var y = q1.y * q2.w + q1.w * q2.y + q1.z * q2.x - q1.x * q2.z;
      var z = q1.z * q2.w + q1.w * q2.z + q1.x * q2.y - q1.y * q2.x;
      var w = q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z;

      if (selfSet) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
      } else {
        return new Quaternion(x, y, z, w);
      }
    }
  };
  
  var aabb = {
    engulf: function (aabb, point) {
      if (aabb[0][0] > point[0]) {
        aabb[0][0] = point[0];
      }
      if (aabb[0][1] > point[1]) {
        aabb[0][1] = point[1];
      }
      if (aabb[0][2] > point[2]) {
        aabb[0][2] = point[2];
      }
      if (aabb[1][0] < point[0]) {
        aabb[1][0] = point[0];
      }
      if (aabb[1][1] < point[1]) {
        aabb[1][1] = point[1];
      }
      if (aabb[1][2] < point[2]) {
        aabb[1][2] = point[2];
      }
    },
    reset: function (aabb, point) {
      if (point === undefined) {
        point = [0,0,0];
      } //if
      aabb[0][0] = point[0];
      aabb[0][1] = point[1];
      aabb[0][2] = point[2];
      aabb[1][0] = point[0];
      aabb[1][1] = point[1];
      aabb[1][2] = point[2];
    },
    size: function (aabb) {
      var x = aabb[0][0] < aabb[1][0] ? aabb[1][0] - aabb[0][0] : aabb[0][0] - aabb[1][0];
      var y = aabb[0][1] < aabb[1][1] ? aabb[1][1] - aabb[0][1] : aabb[0][1] - aabb[1][1];
      var z = aabb[0][2] < aabb[1][2] ? aabb[1][2] - aabb[0][2] : aabb[0][2] - aabb[1][2];
      return [x,y,z];
    },
    /**
        Returns positive integer if intersect between A and B, 0 otherwise.
        For more detailed intersect result check value:
            CubicVR.enums.aabb.INTERSECT if AABBs intersect
            CubicVR.enums.aabb.A_INSIDE_B if boxA is inside boxB
            CubicVR.enums.aabb.B_INSIDE_A if boxB is inside boxA
            CubicVR.enums.aabb.DISJOINT if AABBs are disjoint (do not intersect)
    */
    intersects: function (boxA, boxB) {
      // Disjoint
      if( boxA[0][0] > boxB[1][0] || boxA[1][0] < boxB[0][0] ){
        return enums.aabb.DISJOINT;
      }
      if( boxA[0][1] > boxB[1][1] || boxA[1][1] < boxB[0][1] ){
        return enums.aabb.DISJOINT;
      }
      if( boxA[0][2] > boxB[1][2] || boxA[1][2] < boxB[0][2] ){
        return enums.aabb.DISJOINT;
      }

      // boxA is inside boxB.
      if( boxA[0][0] >= boxB[0][0] && boxA[1][0] <= boxB[1][0] &&
          boxA[0][1] >= boxB[0][1] && boxA[1][1] <= boxB[1][1] &&
          boxA[0][2] >= boxB[0][2] && boxA[1][2] <= boxB[1][2]) {
            return enums.aabb.A_INSIDE_B;
      }
      // boxB is inside boxA.
      if( boxB[0][0] >= boxA[0][0] && boxB[1][0] <= boxA[1][0] &&
          boxB[0][1] >= boxA[0][1] && boxB[1][1] <= boxA[1][1] &&
          boxB[0][2] >= boxA[0][2] && boxB[1][2] <= boxA[1][2]) {
            return enums.aabb.B_INSIDE_A;
      }
          
      // Otherwise AABB's intersect.
      return enums.aabb.INTERSECT;
    }
  };

  var plane = {
    classifyPoint: function (plane, pt) {
      var dist = (plane[0] * pt[0]) + (plane[1] * pt[1]) + (plane[2] * pt[2]) + (plane[3]);
      if (dist < 0) {
        return -1;
      }
      else if (dist > 0) {
        return 1;
      }
      return 0;
    },
    normalize: function (plane) {
      var mag = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
      plane[0] = plane[0] / mag;
      plane[1] = plane[1] / mag;
      plane[2] = plane[2] / mag;
      plane[3] = plane[3] / mag;
    }
  };

  var sphere = {
    intersects: function (sphere, other) {
      var vec3 = base.vec3,
          spherePos = [sphere[0], sphere[1], sphere[2]],
          otherPos = [other[0], other[1], other[2]],
          diff = vec3.subtract(spherePos, otherPos),
          mag = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2]),
          sum_radii = sphere[3] + other[3];
      if (mag * mag < sum_radii * sum_radii) {
        return true;
      }
      return false;
    }
  };

  
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
    planes[enums.frustum_plane.LEFT][0] = comboMatrix[3] + comboMatrix[0];
    planes[enums.frustum_plane.LEFT][1] = comboMatrix[7] + comboMatrix[4];
    planes[enums.frustum_plane.LEFT][2] = comboMatrix[11] + comboMatrix[8];
    planes[enums.frustum_plane.LEFT][3] = comboMatrix[15] + comboMatrix[12];
  
    // Right clipping plane
    planes[enums.frustum_plane.RIGHT][0] = comboMatrix[3] - comboMatrix[0];
    planes[enums.frustum_plane.RIGHT][1] = comboMatrix[7] - comboMatrix[4];
    planes[enums.frustum_plane.RIGHT][2] = comboMatrix[11] - comboMatrix[8];
    planes[enums.frustum_plane.RIGHT][3] = comboMatrix[15] - comboMatrix[12];
  
    // Top clipping plane
    planes[enums.frustum_plane.TOP][0] = comboMatrix[3] - comboMatrix[1];
    planes[enums.frustum_plane.TOP][1] = comboMatrix[7] - comboMatrix[5];
    planes[enums.frustum_plane.TOP][2] = comboMatrix[11] - comboMatrix[9];
    planes[enums.frustum_plane.TOP][3] = comboMatrix[15] - comboMatrix[13];
  
    // Bottom clipping plane
    planes[enums.frustum_plane.BOTTOM][0] = comboMatrix[3] + comboMatrix[1];
    planes[enums.frustum_plane.BOTTOM][1] = comboMatrix[7] + comboMatrix[5];
    planes[enums.frustum_plane.BOTTOM][2] = comboMatrix[11] + comboMatrix[9];
    planes[enums.frustum_plane.BOTTOM][3] = comboMatrix[15] + comboMatrix[13];
  
    // Near clipping plane
    planes[enums.frustum_plane.NEAR][0] = comboMatrix[3] + comboMatrix[2];
    planes[enums.frustum_plane.NEAR][1] = comboMatrix[7] + comboMatrix[6];
    planes[enums.frustum_plane.NEAR][2] = comboMatrix[11] + comboMatrix[10];
    planes[enums.frustum_plane.NEAR][3] = comboMatrix[15] + comboMatrix[14];
  
    // Far clipping plane
    planes[enums.frustum_plane.FAR][0] = comboMatrix[3] - comboMatrix[2];
    planes[enums.frustum_plane.FAR][1] = comboMatrix[7] - comboMatrix[6];
    planes[enums.frustum_plane.FAR][2] = comboMatrix[11] - comboMatrix[10];
    planes[enums.frustum_plane.FAR][3] = comboMatrix[15] - comboMatrix[14];
  
    for (var i = 0; i < 6; ++i) {
      plane.normalize(planes[i]);
    }
  
    //Sphere
    var fov = 1 / pMatrix[5];
    var near = -planes[enums.frustum_plane.NEAR][3];
    var far = planes[enums.frustum_plane.FAR][3];
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
      var distance = vec3.dot(normal, [sphere[0],sphere[1],sphere[2]]) + p[3];
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
        if (plane.classifyPoint(planes[i], points[j]) === -1) {
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


  var extend = {
    vec2:vec2,
    vec3:vec3,
    mat3:mat3,
    mat4:mat4,
    aabb:aabb,
    plane:plane,
    sphere:sphere,
    triangle:triangle,
    Transform: Transform,
    Quaternion: Quaternion,
    Frustum: Frustum
  };
  
  return extend;
});
