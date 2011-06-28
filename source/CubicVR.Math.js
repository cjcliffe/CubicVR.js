CubicVR.RegisterModule("Math",function (base) {

  var undef = base.undef;

  var cubicvr_identity = [1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0];

  var M_TWO_PI = 2.0 * Math.PI;
  var M_HALF_PI = Math.PI / 2.0;

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
    }
  };

  var vec3 = {
    length: function(pt) {
      return Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1] + pt[2] * pt[2]);
    },
    normalize: function(pt) {
      var d = Math.sqrt((pt[0] * pt[0]) + (pt[1] * pt[1]) + (pt[2] * pt[2]));
      if (d === 0) {
        return [0, 0, 0];
      }
      return [pt[0] / d, pt[1] / d, pt[2] / d];
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
    normal: function(pt1, pt2, pt3) {
      
      var v10 = pt1[0] - pt2[0];
      var v11 = pt1[1] - pt2[1];
      var v12 = pt1[2] - pt2[2];
      var v20 = pt2[0] - pt3[0];
      var v21 = pt2[1] - pt3[1];
      var v22 = pt2[2] - pt3[2];
      
      return [v11 * v22 - v12 * v21, v12 * v20 - v10 * v22, v10 * v21 - v11 * v20];
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
    vec3_multiply: function (m1, m2) {
        var mOut = [];


        mOut[0] = m2[0] * m1[0] + m2[3] * m1[1] + m2[6] * m1[2] ;
        mOut[1] = m2[1] * m1[0] + m2[4] * m1[1] + m2[7] * m1[2] ;
        mOut[2] = m2[2] * m1[0] + m2[5] * m1[1] + m2[8] * m1[2];

        return mOut;
    }
  }

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
          var side = vec3.cross(forward, up);
          side = vec3.normalize(side);

          /* Recompute up as: up = side x forward */
          up = vec3.cross(side, forward);

          var m = [ side[0], up[0], -forward[0], 0, side[1], up[1], -forward[1], 0, side[2], up[2], -forward[2], 0, 0, 0, 0, 1];

          var t = new CubicVR.Transform(m);
          t.translate([-eyex,-eyey,-eyez]);

          return t.getResult();
      },
      multiply: function (m1, m2) {
          var mOut = [];

          mOut[0] = m2[0] * m1[0] + m2[4] * m1[1] + m2[8] * m1[2] + m2[12] * m1[3];
          mOut[1] = m2[1] * m1[0] + m2[5] * m1[1] + m2[9] * m1[2] + m2[13] * m1[3];
          mOut[2] = m2[2] * m1[0] + m2[6] * m1[1] + m2[10] * m1[2] + m2[14] * m1[3];
          mOut[3] = m2[3] * m1[0] + m2[7] * m1[1] + m2[11] * m1[2] + m2[15] * m1[3];
          mOut[4] = m2[0] * m1[4] + m2[4] * m1[5] + m2[8] * m1[6] + m2[12] * m1[7];
          mOut[5] = m2[1] * m1[4] + m2[5] * m1[5] + m2[9] * m1[6] + m2[13] * m1[7];
          mOut[6] = m2[2] * m1[4] + m2[6] * m1[5] + m2[10] * m1[6] + m2[14] * m1[7];
          mOut[7] = m2[3] * m1[4] + m2[7] * m1[5] + m2[11] * m1[6] + m2[15] * m1[7];
          mOut[8] = m2[0] * m1[8] + m2[4] * m1[9] + m2[8] * m1[10] + m2[12] * m1[11];
          mOut[9] = m2[1] * m1[8] + m2[5] * m1[9] + m2[9] * m1[10] + m2[13] * m1[11];
          mOut[10] = m2[2] * m1[8] + m2[6] * m1[9] + m2[10] * m1[10] + m2[14] * m1[11];
          mOut[11] = m2[3] * m1[8] + m2[7] * m1[9] + m2[11] * m1[10] + m2[15] * m1[11];
          mOut[12] = m2[0] * m1[12] + m2[4] * m1[13] + m2[8] * m1[14] + m2[12] * m1[15];
          mOut[13] = m2[1] * m1[12] + m2[5] * m1[13] + m2[9] * m1[14] + m2[13] * m1[15];
          mOut[14] = m2[2] * m1[12] + m2[6] * m1[13] + m2[10] * m1[14] + m2[14] * m1[15];
          mOut[15] = m2[3] * m1[12] + m2[7] * m1[13] + m2[11] * m1[14] + m2[15] * m1[15];

          return mOut;
      },
      vec4_multiply: function (m1, m2) {
          var mOut = [];

          mOut[0] = m2[0] * m1[0] + m2[4] * m1[1] + m2[8] * m1[2] + m2[12] * m1[3];
          mOut[1] = m2[1] * m1[0] + m2[5] * m1[1] + m2[9] * m1[2] + m2[13] * m1[3];
          mOut[2] = m2[2] * m1[0] + m2[6] * m1[1] + m2[10] * m1[2] + m2[14] * m1[3];
          mOut[3] = m2[3] * m1[0] + m2[7] * m1[1] + m2[11] * m1[2] + m2[15] * m1[3];

          return mOut;
      },
      vec3_multiply: function (m1, m2) {
          var mOut = [];

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

      // not sure which is faster yet..
      
      inverse$1: function (m) {
          var tmp = [];
          var src = [];
          var dst = [];  

          // Transpose matrix
          for (var i = 0; i < 4; i++) {
            src[i +  0] = m[i*4 + 0];
            src[i +  4] = m[i*4 + 1];
            src[i +  8] = m[i*4 + 2];
            src[i + 12] = m[i*4 + 3];
          }

          // Calculate pairs for first 8 elements (cofactors) 
          tmp[0] = src[10] * src[15];
          tmp[1] = src[11] * src[14];
          tmp[2] = src[9]  * src[15];
          tmp[3] = src[11] * src[13];
          tmp[4] = src[9]  * src[14];
          tmp[5] = src[10] * src[13];
          tmp[6] = src[8]  * src[15];
          tmp[7] = src[11] * src[12];
          tmp[8] = src[8]  * src[14];
          tmp[9] = src[10] * src[12];
          tmp[10] = src[8] * src[13];
          tmp[11] = src[9] * src[12];

          // Calculate first 8 elements (cofactors)
          dst[0]  = tmp[0]*src[5] + tmp[3]*src[6] + tmp[4]*src[7];
          dst[0] -= tmp[1]*src[5] + tmp[2]*src[6] + tmp[5]*src[7];
          dst[1]  = tmp[1]*src[4] + tmp[6]*src[6] + tmp[9]*src[7];
          dst[1] -= tmp[0]*src[4] + tmp[7]*src[6] + tmp[8]*src[7];
          dst[2]  = tmp[2]*src[4] + tmp[7]*src[5] + tmp[10]*src[7];
          dst[2] -= tmp[3]*src[4] + tmp[6]*src[5] + tmp[11]*src[7];
          dst[3]  = tmp[5]*src[4] + tmp[8]*src[5] + tmp[11]*src[6];
          dst[3] -= tmp[4]*src[4] + tmp[9]*src[5] + tmp[10]*src[6];
          dst[4]  = tmp[1]*src[1] + tmp[2]*src[2] + tmp[5]*src[3];
          dst[4] -= tmp[0]*src[1] + tmp[3]*src[2] + tmp[4]*src[3];
          dst[5]  = tmp[0]*src[0] + tmp[7]*src[2] + tmp[8]*src[3];
          dst[5] -= tmp[1]*src[0] + tmp[6]*src[2] + tmp[9]*src[3];
          dst[6]  = tmp[3]*src[0] + tmp[6]*src[1] + tmp[11]*src[3];
          dst[6] -= tmp[2]*src[0] + tmp[7]*src[1] + tmp[10]*src[3];
          dst[7]  = tmp[4]*src[0] + tmp[9]*src[1] + tmp[10]*src[2];
          dst[7] -= tmp[5]*src[0] + tmp[8]*src[1] + tmp[11]*src[2];

          // Calculate pairs for second 8 elements (cofactors)
          tmp[0]  = src[2]*src[7];
          tmp[1]  = src[3]*src[6];
          tmp[2]  = src[1]*src[7];
          tmp[3]  = src[3]*src[5];
          tmp[4]  = src[1]*src[6];
          tmp[5]  = src[2]*src[5];
          tmp[6]  = src[0]*src[7];
          tmp[7]  = src[3]*src[4];
          tmp[8]  = src[0]*src[6];
          tmp[9]  = src[2]*src[4];
          tmp[10] = src[0]*src[5];
          tmp[11] = src[1]*src[4];

          // Calculate second 8 elements (cofactors)
          dst[8]   = tmp[0] * src[13]  + tmp[3] * src[14]  + tmp[4] * src[15];
          dst[8]  -= tmp[1] * src[13]  + tmp[2] * src[14]  + tmp[5] * src[15];
          dst[9]   = tmp[1] * src[12]  + tmp[6] * src[14]  + tmp[9] * src[15];
          dst[9]  -= tmp[0] * src[12]  + tmp[7] * src[14]  + tmp[8] * src[15];
          dst[10]  = tmp[2] * src[12]  + tmp[7] * src[13]  + tmp[10]* src[15];
          dst[10] -= tmp[3] * src[12]  + tmp[6] * src[13]  + tmp[11]* src[15];
          dst[11]  = tmp[5] * src[12]  + tmp[8] * src[13]  + tmp[11]* src[14];
          dst[11] -= tmp[4] * src[12]  + tmp[9] * src[13]  + tmp[10]* src[14];
          dst[12]  = tmp[2] * src[10]  + tmp[5] * src[11]  + tmp[1] * src[9];
          dst[12] -= tmp[4] * src[11]  + tmp[0] * src[9]   + tmp[3] * src[10];
          dst[13]  = tmp[8] * src[11]  + tmp[0] * src[8]   + tmp[7] * src[10];
          dst[13] -= tmp[6] * src[10]  + tmp[9] * src[11]  + tmp[1] * src[8];
          dst[14]  = tmp[6] * src[9]   + tmp[11]* src[11]  + tmp[3] * src[8];
          dst[14] -= tmp[10]* src[11 ] + tmp[2] * src[8]   + tmp[7] * src[9];
          dst[15]  = tmp[10]* src[10]  + tmp[4] * src[8]   + tmp[9] * src[9];
          dst[15] -= tmp[8] * src[9]   + tmp[11]* src[10]  + tmp[5] * src[8];

          // Calculate determinant
          var det = src[0]*dst[0] + src[1]*dst[1] + src[2]*dst[2] + src[3]*dst[3];
          
          var ret = [];

          // Calculate matrix inverse
          det = 1.0 / det;
          for (var i = 0; i < 16; i++) {
            ret[i] = dst[i] * det;
          }
            
            return ret;
      },

      inverse$2: function (m) {
        var inv = [];

        inv[0] =   m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15]
        + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
        inv[4] =  -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15]
        - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
        inv[8] =   m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15]
        + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
        inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14]
        - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
        inv[1] =  -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15]
        - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
        inv[5] =   m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15]
        + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
        inv[9] =  -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15]
        - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
        inv[13] =  m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14]
        + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
        inv[2] =   m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15]
        + m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6];
        inv[6] =  -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15]
        - m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6];
        inv[10] =  m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15]
        + m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5];
        inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14]
        - m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5];
        inv[3] =  -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11]
        - m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6];
        inv[7] =   m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11]
        + m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6];
        inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11]
        - m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5];
        inv[15] =  m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10]
        + m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5];

        det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];

        if (det == 0) return null;

        inverse_det = 1.0 / det;

        inv[0] *= inverse_det;
        inv[1] *= inverse_det;
        inv[2] *= inverse_det;
        inv[3] *= inverse_det;
        inv[4] *= inverse_det;
        inv[5] *= inverse_det;
        inv[6] *= inverse_det;
        inv[7] *= inverse_det;
        inv[8] *= inverse_det;
        inv[9] *= inverse_det;
        inv[10] *= inverse_det;
        inv[11] *= inverse_det;
        inv[12] *= inverse_det;
        inv[13] *= inverse_det;
        inv[14] *= inverse_det;
        inv[15] *= inverse_det;

        return inv;
      },
      
      inverse: function (m) {
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

          if (determinant != 0) {
              var m_inv = [];
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
      }
  };
  
  /* Transform Controller */

  function Transform(init_mat) {
    return this.clearStack(init_mat);
  }

  Transform.prototype.setIdentity = function() {
    this.m_stack[this.c_stack] = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
    if (this.valid === this.c_stack && this.c_stack) {
      this.valid--;
    }
    return this;
  };


  Transform.prototype.getIdentity = function() {
    return [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
  };

  Transform.prototype.invalidate = function() {
    this.valid = 0;
    this.result = null;
    return this;
  };

  
  Transform.prototype.getResult = function() {
    var mat4 = CubicVR.mat4;
    if (!this.c_stack) {
      return this.m_stack[0];
    }
    
    var m = cubicvr_identity;
    
    if (this.valid > this.c_stack-1) this.valid = this.c_stack-1;
                
    for (var i = this.valid; i < this.c_stack+1; i++) {
      m = mat4.multiply(this.m_stack[i],m);
      this.m_cache[i] = m;
    }
      
    this.valid = this.c_stack-1;
      
    this.result = this.m_cache[this.c_stack];
    
    return this.result;
  };
  
  Transform.prototype.pushMatrix = function(m) {
    this.c_stack++;
    this.m_stack[this.c_stack] = (m ? m : cubicvr_identity);
    return this;
  };

  Transform.prototype.popMatrix = function() {
    if (this.c_stack === 0) {
      return;
    }
    this.c_stack--;
    return this;
  };

  Transform.prototype.clearStack = function(init_mat) {
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
  };

  Transform.prototype.translate = function(x, y, z) {
    var mat4 = CubicVR.mat4;
    if (typeof(x) === 'object') {
      return this.translate(x[0], x[1], x[2]);
    }

    var m = this.getIdentity();

    m[12] = x;
    m[13] = y;
    m[14] = z;

    this.m_stack[this.c_stack] = mat4.multiply(m,this.m_stack[this.c_stack]);
    if (this.valid === this.c_stack && this.c_stack) {
      this.valid--;
    }

    return this;
  };


  Transform.prototype.scale = function(x, y, z) {
    var mat4 = CubicVR.mat4;
    if (typeof(x) === 'object') {
      return this.scale(x[0], x[1], x[2]);
    }


    var m = this.getIdentity();

    m[0] = x;
    m[5] = y;
    m[10] = z;

    this.m_stack[this.c_stack] = mat4.multiply(m,this.m_stack[this.c_stack]);
    if (this.valid === this.c_stack && this.c_stack) {
      this.valid--;
    }

    return this;
  };


  Transform.prototype.rotate = function(ang, x, y, z) {
    var mat4 = CubicVR.mat4;
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

    if (z) {
      var Z_ROT = this.getIdentity();

      Z_ROT[0] = cAng * z;
      Z_ROT[4] = sAng * z;
      Z_ROT[1] = -sAng * z;
      Z_ROT[5] = cAng * z;

      this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack],Z_ROT);
    }

    if (y) {
      var Y_ROT = this.getIdentity();

      Y_ROT[0] = cAng * y;
      Y_ROT[8] = -sAng * y;
      Y_ROT[2] = sAng * y;
      Y_ROT[10] = cAng * y;

      this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack],Y_ROT);
    }


    if (x) {
      var X_ROT = this.getIdentity();

      X_ROT[5] = cAng * x;
      X_ROT[9] = sAng * x;
      X_ROT[6] = -sAng * x;
      X_ROT[10] = cAng * x;

      this.m_stack[this.c_stack] = mat4.multiply(this.m_stack[this.c_stack],X_ROT);
    }

    if (this.valid === this.c_stack && this.c_stack) {
      this.valid--;
    }

    return this;
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

  Quaternion.prototype.length = function() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  };

  Quaternion.prototype.normalize = function() {
    var n = Math.sqrt(this.length());
    this.x /= n;
    this.y /= n;
    this.z /= n;
    this.w /= n;
  };

  Quaternion.prototype.fromEuler = function(bank, heading, pitch) // x,y,z
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
  };


  Quaternion.prototype.toEuler = function() {
    var sqw = this.w * this.w;
    var sqx = this.x * this.x;
    var sqy = this.y * this.y;
    var sqz = this.z * this.z;

    var x = (180 / Math.PI) * ((Math.atan2(2.0 * (this.y * this.z + this.x * this.w), (-sqx - sqy + sqz + sqw))));
    var y = (180 / Math.PI) * ((Math.asin(-2.0 * (this.x * this.z - this.y * this.w))));
    var z = (180 / Math.PI) * ((Math.atan2(2.0 * (this.x * this.y + this.z * this.w), (sqx - sqy - sqz + sqw))));

    return [x, y, z];
  };

  Quaternion.prototype.multiply = function(q1, q2) {
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
  };
  

  var extend = {
    vec2:vec2,
    vec3:vec3,
    mat3:mat3,
    mat4:mat4,
    triangle:triangle,
    Transform: Transform,
    Quaternion: Quaternion
  };
  
  return extend;
});
