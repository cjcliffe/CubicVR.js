CubicVR.RegisterModule("UVMapper",function(base) {
  
  var undef = base.undef;
  var GLCore = base.GLCore;
  var enums = base.enums;
  var util = base.util;
  
  var M_TWO_PI = 2.0 * Math.PI;
  var M_HALF_PI = Math.PI / 2.0;
  
  enums.uv = {
    /* UV Axis enums */
    axis: {
      X: 0,
      Y: 1,
      Z: 2
    },

    /* UV Projection enums */
    projection: {
      UV: 0,
      PLANAR: 1,
      CYLINDRICAL: 2,
      SPHERICAL: 3,
      CUBIC: 4,
      SKY: 5
    }
  };


  // convert XYZ space to longitude
  var xyz_to_h = function(x, y, z) {
    var h;

    if (x === 0 && z === 0) {
      h = 0;
    } else {
      if (z === 0) {
        h = (x < 0) ? M_HALF_PI : -M_HALF_PI;
      } else if (z < 0) {
        h = -Math.atan(x / z) + Math.PI;
      } else {
        h = -Math.atan(x / z);
      }
    }

    return h;
  };


  // convert XYZ space to latitude and longitude
  var xyz_to_hp = function(x, y, z) {
    var h, p;

    if (x === 0 && z === 0) {
      h = 0;

      if (y !== 0) {
        p = (y < 0) ? -M_HALF_PI : M_HALF_PI;
      } else {
        p = 0;
      }
    } else {
      if (z === 0) {
        h = (x < 0) ? M_HALF_PI : -M_HALF_PI;
      } else if (z < 0) {
        h = -Math.atan(x / z) + Math.PI;
      } else {
        h = -Math.atan(x / z);
      }

      x = Math.sqrt(x * x + z * z);

      if (x === 0) {
        p = (y < 0) ? -M_HALF_PI : M_HALF_PI;
      } else {
        p = Math.atan(y / x);
      }
    }

    return [h, p];
  };


  function UVMapper(obj_in) {
    obj_in = base.get(obj_in) || {};

    this.rotation = (obj_in.rotation===undef)?[0, 0, 0]:obj_in.rotation;
    this.scale = (obj_in.scale===undef)?[1, 1, 1]:obj_in.scale;
    this.center = (obj_in.center===undef)?[0, 0, 0]:obj_in.center;
    this.projection_mode = (obj_in.projectionMode===undef)?enums.uv.projection.PLANAR:base.parseEnum(enums.uv.projection,obj_in.projectionMode);
    this.projection_axis = (obj_in.projectionAxis===undef)?enums.uv.axis.X:base.parseEnum(enums.uv.axis,obj_in.projectionAxis);
    this.wrap_w_count = (obj_in.wrapW===undef)?1:obj_in.wrapW;
    this.wrap_h_count = (obj_in.wrapH===undef)?1:obj_in.wrapH;
  }

  UVMapper.prototype = {
    setRotation: function(rotation) {
      this.rotation = rotation;
    },
    
    setScale: function(scale) {
      this.scale = scale;
    },
    
    setCenter: function(center) {
      this.center = center;
    },
    
    setProjectionAxis: function(projection_axis) {
      this.projection_axis = projection_axis;
    },
    
    setProjectionMode: function(projection_mode) {
      this.projection_mode = projection_mode;
    },
    
    setWrapW: function(wrap_w) {
      this.wrap_w_count = wrap_w;
    },

    setWrapH: function(wrap_h) {
      this.wrap_h_count = wrap_h;
    },

    apply: function(obj, mat_num, seg_num, start_face, end_face) {
      var mat4 = base.mat4;
      var u, v, s, t, lat, lon;

      var trans = new base.Transform();
      var transformed = false;
      var t_result = null;

      if (this.center[0] || this.center[1] || this.center[2]) {
        trans.translate(-this.center[0], -this.center[1], -this.center[2]);
        transformed = true;
      }

      if (this.rotation[0] || this.rotation[1] || this.rotation[2]) {
        if (this.rotation[0]) {
          trans.rotate(this.rotation[2], 0, 0, 1);
        }
        if (this.rotation[1]) {
          trans.rotate(this.rotation[1], 0, 1, 0);
        }
        if (this.rotation[2]) {
          trans.rotate(this.rotation[0], 1, 0, 0);
        }
        transformed = true;
      }

      if (transformed) {
        t_result = trans.getResult();
      }

      if (typeof(mat_num) === 'object') {
        mat_num = obj.materials.indexOf(mat_num);
      }

      var i = 0, iMax = obj.faces.length;

      if (start_face) {
        i = start_face;
      }
      
      if (end_face) {
        iMax = end_face+1;
      }
      

      for (; i < iMax; i++) {
        if (obj.faces[i].material !== mat_num) {
          continue;
        }
        if (seg_num !== undef) {
          if (obj.faces[i].segment !== seg_num) {
            continue;
          }
        }

        var nx, ny, nz;

        if (this.projection_mode === enums.uv.projection.CUBIC || this.projection_mode === enums.uv.projection.SKY) {
          nx = Math.abs(obj.faces[i].normal[0]);
          ny = Math.abs(obj.faces[i].normal[1]);
          nz = Math.abs(obj.faces[i].normal[2]);
        }

        var latlon_cache = [];

        for (var j = 0, jMax = obj.faces[i].points.length; j < jMax; j++) {
          var pta = obj.faces[i].points[j],
            ptb = obj.faces[i].points[(j+1)%3],
            ptc = obj.faces[i].points[(j+2)%3],
            uvpoint = obj.points[pta],
            uvpointb = obj.points[ptb],
            uvpointc = obj.points[ptc],
            p_axis;

          if (transformed) {
            uvpoint = mat4.vec3_multiply(uvpoint, t_result);
          }

          /* calculate the uv for the points referenced by this face's pointref vector */
          var p_mode = this.projection_mode;
          //switch (this.projection_mode) {
          if (p_mode === enums.uv.projection.SKY) {
          //case enums.uv.projection.SKY:
            var mapping = obj.sky_mapping;
            /* see enums.uv.projection.CUBIC for normalization reasoning */
            if (nx >= ny && nx >= nz) {
              s = uvpoint[2] / (this.scale[2]) + this.scale[2] / 2;
              t = -uvpoint[1] / (this.scale[1]) + this.scale[1] / 2;
              if (obj.faces[i].normal[0] < 0) {
                //left
                s = (mapping[2][2] - mapping[2][0]) * (1-s);
                t = 1-((mapping[2][3] - mapping[2][1]) * (t));
                s += mapping[2][0];
                t += mapping[2][1];
              }
              else {
                //right
                s = (mapping[3][2] - mapping[3][0]) * (s);
                t = 1-((mapping[3][3] - mapping[3][1]) * (t));
                s += mapping[3][0];
                t += mapping[3][1];
              } //if
            } //if
            if (ny >= nx && ny >= nz) {
              s = uvpoint[0] / (this.scale[0]) + this.scale[0] / 2;
              t = -uvpoint[2] / (this.scale[2]) + this.scale[2] / 2;
              if (obj.faces[i].normal[1] < 0) {
                //down
                s = ((mapping[1][2] - mapping[1][0]) * (s));
                t = 1-((mapping[1][3] - mapping[1][1]) * (t));
                s += mapping[1][0];
                t -= mapping[1][1];
              }
              else {
                //up
                s = ((mapping[0][2] - mapping[0][0]) * (s));
                t = 1-((mapping[0][3] - mapping[0][1]) * (t));
                s += mapping[0][0];
                t -= mapping[0][1];
              } //if
            } //if
            if (nz >= nx && nz >= ny) {
              s = uvpoint[0] / (this.scale[0]) + this.scale[0] / 2;
              t = uvpoint[1] / (this.scale[1]) + this.scale[1] / 2;
              if (obj.faces[i].normal[2] < 0) {
                //front
                s = ((mapping[4][2] - mapping[4][0]) * (s));
                t = 1-((mapping[4][3] - mapping[4][1]) * (1-t));
                s += mapping[4][0];
                t -= mapping[4][1];
              }
              else {
                //back
                s = ((mapping[5][2] - mapping[5][0]) * (1-s));
                t = 1-((mapping[5][3] - mapping[5][1]) * (1-t));
                s += mapping[5][0];
                t += mapping[5][1];
              } //if
            } //if
            obj.faces[i].setUV([s, t], j);
            //break;
          }
          else if (p_mode === enums.uv.projection.CUBIC) {
          //case enums.uv.projection.CUBIC:
            /* cubic projection needs to know the surface normal */
            /* x portion of vector is dominant, we're mapping in the Y/Z plane */
            if (nx >= ny && nx >= nz) {
              /* we use a .5 offset because texture coordinates range from 0->1, so to center it we need to offset by .5 */
              s = uvpoint[2] / this.scale[2] + 0.5;
              /* account for scale here */
              t = uvpoint[1] / this.scale[1] + 0.5;
            }

            /* y portion of vector is dominant, we're mapping in the X/Z plane */
            if (ny >= nx && ny >= nz) {

              s = -uvpoint[0] / this.scale[0] + 0.5;
              t = uvpoint[2] / this.scale[2] + 0.5;
            }

            /* z portion of vector is dominant, we're mapping in the X/Y plane */
            if (nz >= nx && nz >= ny) {
              s = -uvpoint[0] / this.scale[0] + 0.5;
              t = uvpoint[1] / this.scale[1] + 0.5;
            }

            if (obj.faces[i].normal[0] > 0) {
              s = -s;
            }
            if (obj.faces[i].normal[1] < 0) {
              s = -s;
            }
            if (obj.faces[i].normal[2] > 0) {
              s = -s;
            }

            obj.faces[i].setUV([s, t], j);
            //break;
          }
          else if (p_mode === enums.uv.projection.PLANAR) {
          //case enums.uv.projection.PLANAR:
            s = ((this.projection_axis === enums.uv.axis.X) ? uvpoint[2] / this.scale[2] + 0.5 : -uvpoint[0] / this.scale[0] + 0.5);
            t = ((this.projection_axis === enums.uv.axis.Y) ? uvpoint[2] / this.scale[2] + 0.5 : uvpoint[1] / this.scale[1] + 0.5);

            obj.faces[i].setUV([s, t], j);
            //break;
          }
          else if (p_mode === enums.uv.projection.CYLINDRICAL) {
          //case enums.uv.projection.CYLINDRICAL:
            // Cylindrical is a little more tricky, we map based on the degree around the center point
            p_axis = this.projection_axis;
            //switch (this.projection_axis) {
            if (p_axis === enums.uv.axis.X) {
            //case enums.uv.axis.X:
              // xyz_to_h takes the point and returns a value representing the 'unwrapped' height position of this point
              lon = xyz_to_h(uvpoint[2], uvpoint[0], -uvpoint[1]);
              t = -uvpoint[0] / this.scale[0] + 0.5;
              //break;
            }
            else if (p_axis === enums.uv.axis.Y) {
            //case enums.uv.axis.Y:
              lon = xyz_to_h(-uvpoint[0], uvpoint[1], uvpoint[2]);
              t = -uvpoint[1] / this.scale[1] + 0.5;
              //break;
            }
            else if (p_axis === enums.uv.axis.Z) {
            //case enums.uv.axis.Z:
              lon = xyz_to_h(-uvpoint[0], uvpoint[2], -uvpoint[1]);
              t = -uvpoint[2] / this.scale[2] + 0.5;
              //break;
            } //if

            // convert it from radian space to texture space 0 to 1 * wrap, TWO_PI = 360 degrees
            lon = 1.0 - lon / (M_TWO_PI);

            if (this.wrap_w_count !== 1.0) {
              lon = lon * this.wrap_w_count;
            }

            u = lon;
            v = t;

            obj.faces[i].setUV([u, v], j);
            //break;
          }
          else if (p_mode === enums.uv.projection.SPHERICAL) {
          //case enums.uv.projection.SPHERICAL:
            var latlon,latlonb,latlonc;

            // spherical is similar to cylindrical except we also unwrap the 'width'
            p_axis = this.projection_axis;

            //switch (this.projection_axis) {
            if (p_axis === enums.uv.axis.X) {
            //case enums.uv.axis.X:
              // xyz to hp takes the point value and 'unwraps' the latitude and longitude that projects to that point
              if(latlon_cache[pta]) latlon = latlon_cache[pta]; else latlon = xyz_to_hp(uvpoint[2], uvpoint[0], -uvpoint[1]);
              if (!latlon_cache[pta]) latlon_cache[pta] = latlon;
              if(latlon_cache[ptb]) latlonb = latlon_cache[ptb]; else latlonb = xyz_to_hp(uvpointb[2], uvpointb[0], -uvpointb[1]);
              if (!latlon_cache[ptb]) latlon_cache[ptb] = latlonb;
              if(latlon_cache[ptc]) latlonc = latlon_cache[ptc]; else latlonc = xyz_to_hp(uvpointc[2], uvpointc[0], -uvpointc[1]);
              if (!latlon_cache[ptc]) latlon_cache[ptc] = latlonc;
              //break;
            }
            else if (p_axis === enums.uv.axis.Y) {
            //case enums.uv.axis.Y:
              if(latlon_cache[pta]) latlon = latlon_cache[pta]; else latlon = xyz_to_hp(uvpoint[0], -uvpoint[1], uvpoint[2]);
              if (!latlon_cache[pta]) latlon_cache[pta] = latlon;
              if(latlon_cache[ptb]) latlonb = latlon_cache[ptb]; else latlonb = xyz_to_hp(uvpointb[0], -uvpointb[1], uvpointb[2]);
              if (!latlon_cache[ptb]) latlon_cache[ptb] = latlonb;
              if(latlon_cache[ptc]) latlonc = latlon_cache[ptc]; else latlonc = xyz_to_hp(uvpointc[0], -uvpointc[1], uvpointc[2]);
              if (!latlon_cache[ptc]) latlon_cache[ptc] = latlonc;
              //break;
            }
            else if (p_axis === enums.uv.axis.Z) {
            //case enums.uv.axis.Z:
              if(latlon_cache[pta]) latlon = latlon_cache[pta]; else latlon = xyz_to_hp(-uvpoint[0], uvpoint[2], -uvpoint[1]);
              if (!latlon_cache[pta]) latlon_cache[pta] = latlon;
              if(latlon_cache[ptb]) latlonb = latlon_cache[ptb]; else latlonb = xyz_to_hp(-uvpointb[0], uvpointb[2], -uvpointb[1]);
              if (!latlon_cache[ptb]) latlon_cache[ptb] = latlonb;
              if(latlon_cache[ptc]) latlonc = latlon_cache[ptc]; else latlonc = xyz_to_hp(-uvpointc[0], uvpointc[2], -uvpointc[1]);
              if (!latlon_cache[ptc]) latlon_cache[ptc] = latlonc;
              //break;
            } //if

            if (Math.abs(latlon[0]-latlonb[0])>M_HALF_PI && Math.abs(latlon[0]-latlonc[0])>M_HALF_PI) {
              if (latlon[0]>latlonb[0] && latlon[0]>latlonc[0]) {
                latlon[0]-=M_TWO_PI;
              } else {
                latlon[0]+=M_TWO_PI;
              }
            }
            if (Math.abs(latlon[1]-latlonb[1])>M_HALF_PI && Math.abs(latlon[1]-latlonc[1])>M_HALF_PI) {
              if (latlon[1]>latlonb[1] && latlon[1]>latlonc[1]) {
                latlon[1]-=M_TWO_PI;
              } else {
                latlon[1]+=M_TWO_PI;
              }
            }

            // convert longitude and latitude to texture space coordinates, multiply by wrap height and width
            lon = 1.0 - latlon[0] / M_TWO_PI;
            lat = 0.5 - latlon[1] / Math.PI;

            if (this.wrap_w_count !== 1.0) {
              lon = lon * this.wrap_w_count;
            }
            if (this.wrap_h_count !== 1.0) {
              lat = lat * this.wrap_h_count;
            }

            u = lon;
            v = lat;

            obj.faces[i].setUV([u, v], j);
            //break;
          }
          else {

            // case enums.uv.projection.UV:
            //   // not handled here..
            // break;
          //default:
            // else mapping cannot be handled here, this shouldn't have happened :P
            u = 0;
            v = 0;
            obj.faces[i].setUV([u, v], j);
            //break;
          } //if
        } //for
      } //for - faces
      
      return this;
    }
  };


  var extend = {
    UVMapper: UVMapper
  };

  return extend;
});
