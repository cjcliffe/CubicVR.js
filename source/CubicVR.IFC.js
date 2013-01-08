CubicVR.RegisterModule("IFC", function(base) {

  var undef = base.undef;
  var util = base.util;
  var vec3 = base.vec3;
  var enums = base.enums;

  enums.ifc = { 
    parts: {
      WALLS:1,
      COLUMNS:2,
      BEAMS:3,
      ROOFS:4,
      SLABS:5,
      COVERINGS:6,
      RAILINGS:7,
      STAIRS:8,
      SPACES:9,
      DOORS:10,
      WINDOWS:11,
      STORIES:12
    }
  }

  var ifc_cmd = {
    IFCUNSUPPORTED: -1,
    IFCARBITRARYCLOSEDPROFILEDEF: 1,
    IFCAXIS2PLACEMENT2D: 2,
    IFCAXIS2PLACEMENT3D: 3,
    IFCBEAM: 4,
    IFCBOOLEANCLIPPINGRESULT: 5,
    IFCBOUNDINGBOX: 6,
    IFCCARTESIANPOINT: 7,
    IFCCARTESIANTRANSFORMATIONOPERATOR3D: 8,
    IFCCLOSEDSHELL: 9,
    IFCCOLUMN: 10,
    IFCCOVERING: 11,
    IFCDIRECTION: 12,
    IFCDOOR: 13,
    IFCEXTRUDEDAREASOLID: 14,
    IFCFACE: 15,
    IFCFACEOUTERBOUND: 16,
    IFCFACETEDBREP: 17,
    IFCGEOMETRICREPRESENTATIONCONTEXT: 18,
    IFCGEOMETRICREPRESENTATIONCONTEXT: 19,
    IFCHALFSPACESOLID: 20,
    IFCLOCALPLACEMENT: 21,
    IFCMAPPEDITEM: 22,
    IFCPOLYGONALBOUNDEDHALFSPACE: 23,
    IFCPOLYLINE: 24,
    IFCPOLYLOOP: 25,
    IFCPRODUCTDEFINITIONSHAPE: 26,
    IFCRAILING: 27,
    IFCRECTANGLEPROFILEDEF: 28,
    IFCREPRESENTATIONMAP: 29,
    IFCROOF: 30,
    IFCSHAPEREPRESENTATION: 31,
    IFCSLAB: 32,
    IFCWALLSTANDARDCASE: 33,
    IFCWINDOW: 34,
    IFCSPACE: 35,
    IFCBUILDINGSTOREY: 36,
    IFCFACEBASEDSURFACEMODEL: 37,
    IFCCONNECTEDFACESET: 38,
    IFCSTAIR: 39
  };


  function parseCSV(s, sep) {
    for (var f = s.split(sep = sep || ","), x = f.length - 1, tl; x >= 0; x--) {
      if (f[x].replace(/"\s+$/, '"').charAt(f[x].length - 1) == '"') {
        if ((tl = f[x].replace(/^\s+"/, '"')).length > 1 && tl.charAt(0) == '"') {
          f[x] = f[x].replace(/^\s*"|"\s*$/g, '').replace(/""/g, '"');
        } else if (x) {
          f.splice(x - 1, 2, [f[x - 1], f[x]].join(sep));
        } else f = f.shift().split(sep).concat(f);
      } else if (f[x].replace(/'\s+$/, '\'').charAt(f[x].length - 1) == '\'') {
        if ((tl = f[x].replace(/^\s+'/, '\'')).length > 1 && tl.charAt(0) == '\'') {
          f[x] = f[x].replace(/^\s*'|'\s*$/g, '').replace(/''/g, '\'');
        } else if (x) {
          f.splice(x - 1, 2, [f[x - 1], f[x]].join(sep));
        } else f = f.shift().split(sep).concat(f);
      } else f[x].replace(/""/g, '"').replace(/''/g, '\'');

      if (f[x]) f[x] = f[x].replace(/^\s+|\s+$/g, '')
    }
    return f;
  }


  var IFC = function() {
      this.command = null;
      this.param = null;
      this.axis2Placement2DCache = {};
      this.axis2Placement3DCache = {};
      this.localPlacementCache = {};
      this.repContextCache = {};
  };


  IFC.prototype = {
    load: function(fn) {
      var s = base.util.getScriptContents(fn);
      var src_data;

      if (s.indexOf("\r\n") !== -1) {
        src_data = s.split("\r\n");
      } else {
        src_data = s.split("\n");
      }

      s = null;

      this.parse(src_data);
      this.process();
    },
    parse: function(src_data) {
      this.command = [];
      this.param = [];

      for (var i = 0, iMax = src_data.length; i < iMax; i++) {
        var line = src_data[i];
        if (line.indexOf("=") == -1) {
          continue;
        }
        if (line[0] == "#") {
          line = line.substr(1);

          var idx = parseInt(line.substr(0, line.indexOf("=")), 10);
          var cmd_start = line.indexOf("=") + 1;
          var cmd_end = line.indexOf("(");
          var cmd_length = cmd_end - cmd_start;
          var cmd = line.substr(cmd_start, cmd_length).replace(/^\s\s*/, '').replace(/\s\s*$/, '');
          var cmd_id;

          if (cmd_id = ifc_cmd[cmd]) {
            this.command[idx] = cmd_id;
          }
          switch (cmd_id) {
          case ifc_cmd.IFCFACE:
            var face_data = line.split("((#");
            face_data = face_data[1].split("))");
            this.param[idx] = parseInt(face_data[0], 10);
            break;
          case ifc_cmd.IFCCLOSEDSHELL:
          case ifc_cmd.IFCPOLYLOOP:
          case ifc_cmd.IFCPOLYLINE:
          case ifc_cmd.IFCFACEBASEDSURFACEMODEL:
          case ifc_cmd.IFCCONNECTEDFACESET:
            var loop_data = line.split("((");
            loop_data = loop_data[1].split("))");
            loop_data = loop_data[0].split(",");
            for (var j = 0, jMax = loop_data.length; j < jMax; j++) {
              loop_data[j] = parseInt(loop_data[j].replace("#", ""), 10);
            }
            this.param[idx] = loop_data;
            break;
            // #22 = IFCDIRECTION ((0., 0., 1.));
          case ifc_cmd.IFCCARTESIANPOINT:
          case ifc_cmd.IFCDIRECTION:
            var point_data = line.split("((");
            point_data = point_data[1].split("))");
            point_data = point_data[0].split(",");
            for (var j = 0, jMax = point_data.length; j < jMax; j++) {
              point_data[j] = parseFloat(point_data[j]);
            }

            this.param[idx] = point_data;
            break;
            //#24 = IFCAXIS2PLACEMENT3D (#23, #22, #20);                            
          case ifc_cmd.IFCAXIS2PLACEMENT2D:
          case ifc_cmd.IFCAXIS2PLACEMENT3D:
          case ifc_cmd.IFCLOCALPLACEMENT:
            var point_data = line.split("(");
            point_data = point_data[1].split(")");
            point_data = point_data[0].split(",");
            // for (var j = 0, jMax = point_data.length; j<jMax; j++) {
            //     point_data[j] = parseInt(point_data[j].replace("#",""),10);
            // }
            if (cmd_id = ifc_cmd.IFCLOCALPLACEMENT && idx==36062) {
              console.log(point_data);
            }
            
            this.param[idx] = point_data;
            break;
          case ifc_cmd.IFCWALLSTANDARDCASE:
          case ifc_cmd.IFCARBITRARYCLOSEDPROFILEDEF:
          case ifc_cmd.IFCBEAM:
          case ifc_cmd.IFCBOOLEANCLIPPINGRESULT:
          case ifc_cmd.IFCBOUNDINGBOX:
          case ifc_cmd.IFCCARTESIANTRANSFORMATIONOPERATOR3D:
          case ifc_cmd.IFCCOLUMN:
          case ifc_cmd.IFCCOVERING:
          case ifc_cmd.IFCSPACE:
          case ifc_cmd.IFCSTAIR:
          case ifc_cmd.IFCBUILDINGSTOREY:
          case ifc_cmd.IFCDOOR:
          case ifc_cmd.IFCEXTRUDEDAREASOLID:
          case ifc_cmd.IFCFACEOUTERBOUND:
          case ifc_cmd.IFCFACETEDBREP:
          case ifc_cmd.IFCGEOMETRICREPRESENTATIONCONTEXT:
          case ifc_cmd.IFCHALFSPACESOLID:
          case ifc_cmd.IFCMAPPEDITEM:
          case ifc_cmd.IFCPOLYGONALBOUNDEDHALFSPACE:
          case ifc_cmd.IFCRAILING:
          case ifc_cmd.IFCRECTANGLEPROFILEDEF:
          case ifc_cmd.IFCREPRESENTATIONMAP:
          case ifc_cmd.IFCROOF:
          case ifc_cmd.IFCSLAB:
          case ifc_cmd.IFCWINDOW:
            var param_data = line.substr(line.indexOf("(")+1);
            param_data = param_data.substr(0,param_data.lastIndexOf(")"));
            this.param[idx] = parseCSV(param_data, ",");
            break;
            //#192 = IFCPRODUCTDEFINITIONSHAPE ($, $, (#177, #186, #191));
          case ifc_cmd.IFCPRODUCTDEFINITIONSHAPE:
          case ifc_cmd.IFCSHAPEREPRESENTATION:
            var param_data = line.split("(");
            var param_left = parseCSV(param_data[1]);
            param_left.pop();
            var param_right = parseCSV(param_data[2]);
            while (param_right[param_right.length - 1] == ";" || param_right[param_right.length - 1] == "") {
              param_right.pop();
            }
            param_right[prl = param_right.length - 1] = param_right[prl = param_right.length - 1].split(")")[0];
            param_left = param_left;
            param_left.push(param_right);
            this.param[idx] = param_left;
            break;
          default:
            this.param[idx] = src_data[i];
            break;
          }
        }
      }
    },
    process: function() {
      var mesh = new base.Mesh();
      var command, c, cMax, t, tMax, param;
      var p = 0;

      this.data = {
        walls: [],
        columns: [],
        beams: [],
        roofs: [],
        slabs: [],
        windows: [],
        doors: [],
        coverings: [],
        railings: [],
        spaces: [],
        stories: [],
        stairs: []
      };
      var data = this.data;

/*
        ENTITY IfcBuildingElement
        (* SCHEMA IFC2X3; *)
        
        Not Yet Parsed:
            IfcBuildingElementComponent
            IfcBuildingElementProxy            
            IfcCurtainWall            
            IfcFooting
            IfcMember
            IfcPile
            IfcPlate
            IfcRamp
            IfcRampFlight            
            IfcStair
            IfcStairFlight
            IfcRoof
        
        Parsed:
            IfcWall
            IfcColumn
            IfcBeam
            IfcSlab
            IfcWindow
            IfcDoor
            IfcCovering
            IfcRailing

        */

      for (var c = 0, cMax = this.command.length; c < cMax; c++) {
        command = this.command[c];
        if (!command) continue;
        param = this.param[c];
        switch (command) {
        case ifc_cmd.IFCWALLSTANDARDCASE:
          data.walls.push(this.getIfcBuildingElement(c));
          break;
        case ifc_cmd.IFCCOLUMN:
          data.columns.push(this.getIfcBuildingElement(c));
          break;
        case ifc_cmd.IFCBEAM:
          data.beams.push(this.getIfcBuildingElement(c));
          break;
          // case ifc_cmd.IFCROOF:
          //   data.roofs.push(this.getIfcBuildingElement(c));
          // break;
        case ifc_cmd.IFCSLAB:
          data.slabs.push(this.getIfcBuildingElement(c));
          break;
        case ifc_cmd.IFCWINDOW:
          data.windows.push(this.getIfcBuildingElement(c));
          break;
        case ifc_cmd.IFCDOOR:
          data.doors.push(this.getIfcBuildingElement(c));
          break;
        case ifc_cmd.IFCCOVERING:
          data.coverings.push(this.getIfcBuildingElement(c));
          break;
        case ifc_cmd.IFCRAILING:
          data.railings.push(this.getIfcBuildingElement(c));
          break;
        case ifc_cmd.IFCSPACE:
          data.spaces.push(this.getIfcBuildingElement(c));
          break;
        case ifc_cmd.IFCBUILDINGSTOREY:
          data.stories.push(this.getIfcBuildingElement(c));
          break;          
        case ifc_cmd.IFCSTAIR:
          data.stairs.push(this.getIfcBuildingElement(c));
          break;          
          // case ifc_cmd.IFCFACE:
          //    ... ?
          // break;
          // case ifc_cmd.IFCPOLYLOOP:
          //     var points_in = param.slice(0);
          //     var point_list = [];
          //     for (t = 0, tMax = points_in.length; t<tMax; t++) {
          //       var pin = points_in[t];
          //       if (!ifc_mesh_point_map[pin]) {
          //         ifc_mesh_point_map[pin] = mesh.addPoint(this.param[pin]);
          //       }
          //       point_list[t] = ifc_mesh_point_map[pin];
          //       if (!point_list[t]) {
          //         point_list = null;
          //         break;
          //       }
          //     }
          //     if (point_list && point_list) {
          //       ifc_face_map[c] = mesh.addFace(point_list);
          //       if (point_list.length>4) {
          //         mesh.faces[ifc_face_map[c]].flip();
          //       }
          //     }
          //   break;
          // case ifc_cmd.IFCLOCALPLACEMENT:
          //   var loc = getIFCLocalPlacement(c);
          //   // p++; if (p<100) console.log(loc);                          
          // break;
          // case ifc_cmd.IFCAXIS2PLACEMENT3D:
          //   p++;
          //   if (p<100) console.log("IFCAXIS2PLACEMENT3D",this.param[this.param[c][0]],this.param[this.param[c][1]],this.param[this.param[c][2]]);
          // break;
        }
      }

      console.log(this.data);
    },
    getIfcBuildingElement: function(c) {
      // (
      // GlobalId: IfcGloballyUniqueId (STRING),
      // OwnerHistory: IfcOwnerHistory (ENTITY),
      // Name: IfcLabel (STRING),
      // Description: IfcText (STRING),
      // ObjectType: IfcLabel (STRING),
      // ObjectPlacement: IfcObjectPlacement (ENTITY),
      // Representation: IfcProductRepresentation (ENTITY),
      // Tag: IfcIdentifier (STRING))
      // )
      // ('1aBW6nDyn6yur7aHmgkMJu', #6, '2006', $, $, #14608, #14604, $);
      var param = this.param[c];
      var v = {
        guid: this.getIfcString(param[0]),
        owner: this.getIfcOwnerHistory(param[1]),
        name: this.getIfcString(param[2]),
        description: this.getIfcString(param[3]),
        type: this.getIfcString(param[4]),
        placement: this.getIfcLocalPlacement(param[5]),
        representation: this.getIfcProductRepresentation(param[6]),
        tag: this.getIfcString(param[7])
      };

      return v;
    },
    getIfcPointer: function(s) {
      if (typeof(s) == "number") { // already an integer
        return s;
      }

      s = s.replace(/^\s+|\s+$/g, '');
      s = s.replace(/^#/g, '');
      if (s == "$") return null; // $ = null will do for now
      return parseInt(s, 10); // else parse the integer, NaN on fail
    },
    getIfcString: function(s) {
      if (s === undef) {
        return "";
      }
      s = s.replace(/^\s+|\s+$/g, '');
      if (s == "$") return null;
      return s.replace(/^'|'+$/g, '');
    },
    getIfcOwnerHistory: function(p) {
      return null;
    },
    getIfcObjectPlacement: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      var v = null;

      if (isNaN(c)) {
        return null;
      }

      switch (this.command[c]) {
      case ifc_cmd.IFCLOCALPLACEMENT:
        v = this.getIfcLocalPlacement(c);
        break;
      default:
        console.log("getIfcObjectPlacement??", this.command[c], param);
        break;
      }

      return v;
    },
    getIfcAxis2Placement: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      var v = null;

      switch (this.command[c]) {
      case ifc_cmd.IFCAXIS2PLACEMENT2D:
        v = this.getIfcAxis2Placement2D(c);
        break;
      case ifc_cmd.IFCAXIS2PLACEMENT3D:
        v = this.getIfcAxis2Placement3D(c);
        break;
      }

      return v;
    },
    getIfcAxis2Placement3D: function(p) {
      var c = this.getIfcPointer(p);
      if (this.axis2Placement3DCache[c] !== undef) {
        return this.axis2Placement3DCache[c];
      }
      var param = this.param[c];

      var v = {
        location: this.param[this.getIfcPointer(param[0])],
        axis: this.param[this.getIfcPointer(param[1])],
        direction: this.param[this.getIfcPointer(param[2])]
      };

      this.axis2Placement3DCache[c] = v;

      return v;
    },
    getIfcAxis2Placement2D: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      if (this.axis2Placement2DCache[c] !== undef) {
        return this.axis2Placement2DCache[c];
      }

      var v = {
        location: this.getIfcCartesianPoint(param[0]),
        direction: this.getIfcDirection(param[1])
      }
      // console.log("getIfcAxis2Placement2D",v,param);
      this.axis2Placement2DCache[c] = v;

      return v;
    },
    getIfcLocalPlacement: function(p) {
      var c = this.getIfcPointer(p);
      if (this.localPlacementCache[c] !== undef) {
        return this.localPlacementCache[c];
      }
      var param = this.param[c];
      // IfcLocalPlacement( PlacementRelTo: IfcObjectPlacement, RelativePlacement: IfcAxis2Placement )
      var lp = {
        placementRelTo: this.getIfcObjectPlacement(param[0]),
        relativePlacement: this.getIfcAxis2Placement(param[1])
      }
      this.localPlacementCache[c] = lp;
      return lp;
    },
    getIfcBoundingBox: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];

      // IfcBoundingBox ( 
      //  Corner: IfcCartesianPoint, 
      //  XDim: IfcPositiveLengthMeasure, 
      //  YDim: IfcPositiveLengthMeasure, 
      //  ZDim: IfcPositiveLengthMeasure )
      var v = {
        corner: this.getIfcCartesianPoint(param[0]),
        x: parseFloat(param[1]),
        y: parseFloat(param[2]),
        z: parseFloat(param[3])
      };

      // console.log("getIfcBoundingBox",param,v);
      return v;
    },
    getIfcDirection: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      return param;
    },
    getIfcFaceOuterbound: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];

      var v = null;
      switch (this.command[c]) {
      case ifc_cmd.IFCPOLYLOOP:
        v = this.getIfcPolyLoop(c);
        break;
      case ifc_cmd.IFCFACE:
        v = this.getIfcFace(c);
        break;
      default:
        console.log("Unknown outer face bound", p);
      break;
      }
      // console.log(c,v);
      return v;
    },
    getIfcCartesianPoint: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      return param;
    },
    getIfcCurve: function(p) {
      var c = this.getIfcPointer(p);
      var l = [];
      var param = this.param[c];
      for (var i = 0; i < param.length; i++) {
        l[i] = this.getIfcCartesianPoint(param[i]);
      }
      return l;
    },
    getIfcProfileDef: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      var v = null;

      switch (this.command[c]) {
      case ifc_cmd.IFCARBITRARYCLOSEDPROFILEDEF:
        v = {
          type: param[0],
          typeName: "ArbitraryClosedProfile",
          name: this.getIfcString(param[1]),
          curve: this.getIfcCurve(param[2])
        }
        break;
      case ifc_cmd.IFCRECTANGLEPROFILEDEF:
        // ProfileType: IfcProfileTypeEnum
        // ProfileName: IfcLabel
        // Position: IfcAxis2Placement2D
        // XDim: IfcPositiveLengthMeasure
        // YDim: IfcPositiveLengthMeasure
        v = {
          type: param[0],
          typeName: "RectangleProfile",
          name: this.getIfcString(param[1]),
          position: this.getIfcAxis2Placement(param[2]),
          x: parseFloat(param[3]),
          y: parseFloat(param[4])
        };
        // console.log("IFCRECTANGLEPROFILEDEF",v);
        break;
      default:
        console.log("IfcProfileDef", this.command[c], param, v);
        break;
      }

      return v;
    },
    getIfcExtrudedAreaSolid: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      // #1186 = IFCEXTRUDEDAREASOLID (#1184, #1185, #22, 2403.);
      // ENTITY IfcExtrudedAreaSolid
      // SweptArea: IfcProfileDef (param[0]),
      // Position: IfcAxis2Placement3D (param[1]),
      // ExtrudedDirection : this.getIfcDirection(param[2]);
      // Depth : this.getIfcPositiveLengthMeasure(param[3]);
      //}
      var eas = {
        area: this.getIfcProfileDef(param[0]),
        position: this.getIfcAxis2Placement(param[1]),
        direction: this.getIfcDirection(param[2]),
        depth: parseFloat(param[3])
      };

      // console.log("getIfcExtrudedAreaSolid",this.command[c],eas);
      return eas;
    },
    getIfcPolyLine: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      return param;
    },
    getIfcPolyLoop: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      // console.log("getIfcPolyLoop",param);
      return param;
    },
    getIfcHalfSpaceSolid: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      // console.log("getIfcHalfSpaceSolid",param);
      return param;
    },
    getIfcPolygonalBoundedHalfspace: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      // console.log("getIfcPolygonalBoundedHalfspace",param);
      return param;
    },
    getIfcFace: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      param = this.param[param];
      var v = this.getIfcFaceOuterbound(param[0]);
      // console.log(v);
      return v;
      // console.log(this.command[this.getIfcPointer(param[0])]);
      // return this.param[this.getIfcPointer(param[0])];
      // var l = [];
      // for (var i = 0; i < param.length; i++) {
      //   l[i] = this.getIfcFace(param[i]);
      // }
      // return l;
      // return param;
    },
    getIfcClosedShell: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      var l = [];
      for (var i = 0; i < param.length; i++) {
        l[i] = this.getIfcFaceOuterbound(param[i]);
      }
      // console.log("getIfcClosedShell",param,l);
      return l;
    },
    getIfcFacetedBrep: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      var v = null;

      switch (this.command[this.getIfcPointer(param[0])]) {
      case ifc_cmd.IFCCLOSEDSHELL:
        v = {
          type: this.command[c],
          typeName: "ClosedShell",
          value: this.getIfcClosedShell(param[0])
        }
        break;
      default:
        console.log("getIfcFacetedBrep??", param);
        break;
      }

      // console.log("getIfcFacetedBrep",v);
      return v;
    },
    getIfcConnectedFaceSet: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      var l = [];
      
      for (var i = 0, iMax=param.length; i<iMax; i++) {
        l[i] = this.getIfcFace(param[i]);
      }

      // console.log("getIfcConnectedFaceSet",l);
      return l;
    },
    getIfcFaceBasedSurfaceModel: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      var l = [];
      
      for (var i = 0, iMax=param.length; i<iMax; i++) {
        l[i] = this.getIfcConnectedFaceSet(param[i]);
      }

      
      // switch (this.command[this.getIfcPointer(param[0])]) {
      // case ifc_cmd.IFCCLOSEDSHELL:
      //   v = {
      //     type: this.command[c],
      //     typeName: "ClosedShell",
      //     value: this.getIfcClosedShell(param[0])
      //   }
      //   break;
      // default:
      //   console.log("getIfcFacetedBrep??", param);
      //   break;
      // }

      // console.log("getIfcFaceBasedSurfaceModel",param,l);
      return l;
    },
    getIfcBooleanOperand: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];

      var v = null;

      switch (this.command[c]) {
      case ifc_cmd.IFCHALFSPACESOLID:
        v = {
          type: this.command[c],
          typeName: "HalfSpaceSolid",
          value: this.getIfcHalfSpaceSolid(this.command[c])
        };
        break;
      case ifc_cmd.IFCPOLYGONALBOUNDEDHALFSPACE:
        v = {
          type: this.command[c],
          typeName: "PolyBoundHalfSpace",
          value: this.getIfcPolygonalBoundedHalfspace(this.command[c])
        };
        break;
      case ifc_cmd.IFCBOOLEANCLIPPINGRESULT:
        v = {
          type: this.command[c],
          typeName: "BooleanClippingResult",
          value: this.getIfcBooleanClippingResult(c)
        };
        break;
      case ifc_cmd.IFCEXTRUDEDAREASOLID:
        v = {
          type: this.command[c],
          typeName: "ExtrudedAreaSolid",
          value: this.getIfcExtrudedAreaSolid(c)
        };
        break;
      default:
        console.log("IfcBooleanOperand??", this.command[c], param);
        break;
      }

      return v;
    },
    getIfcBooleanClippingResult: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      var v = {
        operator: param[0],
        first: this.getIfcBooleanOperand(param[1]),
        second: this.getIfcBooleanOperand(param[2])
      };

      // console.log("getIfcBooleanClippingResult",c,this.command[c],v,param);
      return v;
    },
    getIfcCartesianTransformationOperator3D: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];

      var v = {
        axis1: this.getIfcDirection(param[0]),
        axis2: this.getIfcDirection(param[1]),
        localOrigin: this.getIfcCartesianPoint(param[2]),
        scale: param[3] ? parseFloat(param[3]) : 1.0,
        axis3: param[4] ? this.getIfcDirection(param[4]) : null
      };

      // console.log("getIfcCartesianTransformationOperator3D",param,v);
      return v;
    },
    getIfcRepresentation: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];

      console.log("getIfcRepresentation", param);
      return param;
    },
    getIfcRepresentationMap: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];

      var v = {
        origin: this.getIfcCartesianTransformationOperator3D(param[0]),
        representation: this.getIfcShapeRepresentation(param[1])
      };

      // console.log("getIfcRepresentationMap",param,v);
      return v;
    },
    getIfcCartesianTransformationOperator: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];
      var v = {
        axis1: this.getIfcDirection(param[0]),
        axis2: this.getIfcDirection(param[1]),
        localOrigin: this.getIfcCartesianPoint(param[2]),
        scale: param[3] ? parseFloat(param[3]) : 1.0
      };

      // console.log("getIfcCartesianTransformationOperator",param,v);
      return v;
    },
    getIfcMappedItem: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];

      var v = {
        source: this.getIfcRepresentationMap(param[0]),
        target: this.getIfcCartesianTransformationOperator(param[1])
      }
      // console.log("getIfcMappedItem",param,v);
      // IFCMAPPEDITEM
      return v;
    },
    getIfcRepresesentationItemSet: function(p) {
      var l = [];

      for (var i = 0; i < p.length; i++) {
        var c = this.getIfcPointer(p[i]);
        switch (this.command[c]) {
        case ifc_cmd.IFCBOUNDINGBOX:
          l[i] = this.getIfcBoundingBox(c);
          break;
        case ifc_cmd.IFCEXTRUDEDAREASOLID:
          l[i] = this.getIfcExtrudedAreaSolid(c);
          break;
        case ifc_cmd.IFCPOLYLINE:
          l[i] = this.getIfcPolyLine(c);
          break;
        case ifc_cmd.IFCBOOLEANCLIPPINGRESULT:
          l[i] = this.getIfcBooleanClippingResult(c);
          break;
        case ifc_cmd.IFCFACETEDBREP:
          l[i] = this.getIfcFacetedBrep(c);
          break;
        case ifc_cmd.IFCMAPPEDITEM:
          l[i] = this.getIfcMappedItem(c);
          break;
        case ifc_cmd.IFCFACEBASEDSURFACEMODEL:
          l[i] = this.getIfcFaceBasedSurfaceModel(c);
          break;
        default:
          console.log("getIfcRepresesentationItemSet-Unhandled",c,this.command[c]);//, "=", this.param[this.getIfcPointer(l[i])])
          break;
        }
      }

      return l;
    },
    getIfcRepresentationContext: function(p) {
      var c = this.getIfcPointer(p);
      if (this.repContextCache[c] !== undef) {
        return this.repContextCache[c];
      }
      
      var param = this.param[c];

      var v = null;

      switch (this.command[c]) {
      case ifc_cmd.IFCGEOMETRICREPRESENTATIONCONTEXT:
        v = this.getIfcGeometricRepresentationContext(c);
        break;
      }

      this.repContextCache[c] = v;
      return v;
    },
    getIfcGeometricRepresentationContext: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];

      var wc = this.param[this.getIfcPointer(param[4])];

      var rcontext = {
        id: this.getIfcString(param[0]),
        type: this.getIfcString(param[1]),
        coordSpace: parseInt(this.getIfcString(param[2]), 10),
        precision: parseFloat(param[3]),
        worldCoord: [this.param[this.getIfcPointer(wc[0])], this.param[this.getIfcPointer(wc[1])], this.param[this.getIfcPointer(wc[2])]],
        trueNorth: this.param[this.getIfcPointer(param[5])]
      };

      return rcontext;
    },
    getIfcShapeRepresentation: function(p) {
      var c = this.getIfcPointer(p);
      var param = this.param[c];

if (!param || param.length<4 || !param[2].replace) {
  console.log("param",param);
  return;
}
      var context = {
        contextOfItems: this.getIfcRepresentationContext(param[0]),
        representationId: this.getIfcString(param[1]),
        representationType: this.getIfcString(param[2]),
        items: this.getIfcRepresesentationItemSet(param[3])
      };
      // console.log(param);

      // console.log(context);
      return context;
    },
    getIfcRepresentationContextList: function(list) {
      var l = [];
      for (var i = 0; i < list.length; i++) {
        l[i] = this.getIfcShapeRepresentation(list[i]);
      }
      return l;
    },
    getIfcProductRepresentation: function(p) {
      var c = this.getIfcPointer(p);

      if (!c) return null;
      
      // console.log("IfcProductRepresentation",this.param[c],this.command[c]);
      var param = this.param[c];
      var product_rep = {
        name: this.getIfcString(param[0]),
        description: this.getIfcString(param[1]),
        contexts: this.getIfcRepresentationContextList(param[2])
      }
      // console.log(product_rep);
      return product_rep;
    },
    build: function(obj_init) {
      obj_init = obj_init || {};
      var transform = obj_init.transform||undef;
      
      var parts = obj_init.parts;
      
      if (typeof(parts)=="object" && !parts.length) {
        parts = [parts];
      }

      var mesh = new base.Mesh({buildWireframe:true});      
      
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        var part_type = base.parseEnum(enums.ifc.parts,part.type)||0;
        
        if (!part_type) {
          console.log("Part type unspecified, skipped.");
          continue;
        }
        
        var tempMesh = new base.Mesh({buildWireframe:true});
        var partName = "";
        
        for (partName in enums.ifc.parts) {
          if (enums.ifc.parts[partName] === part_type) break;
        }
        partName = partName.toLowerCase();
        
        this.buildElements(tempMesh,this.data[partName]);
        
        if (part.material) {
          var mat = base.get(part.material,base.Material)||null;
          
          if (mat) {
            tempMesh.materials[0] = mat;
          }
        }
        
        mesh.booleanAdd(tempMesh,part.transform||transform);
      }
      
      if (obj_init.compile) {
        mesh.prepare();
      }
      
      return mesh;
    },
    
    localPlacementToTransform: function(placement) {
      var pstack = [placement];
      var mat4 = base.mat4;
      var vec3 = base.vec3;
      var p = placement;
      
      while (p = p.placementRelTo) {        
        pstack.push(p);
      }

      var m = mat4.identity();
      
      var loc = [0,0,0];
      
      var lastx = [1,0,0];
      var lasty = [0,1,0];
      var lastz = [0,0,1];
      var newx, newy, newz;
      
      while (pstack.length) {
        var t = pstack.pop();

        newz = t.relativePlacement.axis||[0,0,1];
        newx = t.relativePlacement.direction||[1,0,0];
        newy = vec3.cross(newz,newx);
        
        var ax = [vec3.angle(lastx,newx),vec3.angle(lastx,newy),vec3.angle(lastx,newz)];
        var ay = [vec3.angle(lasty,newx),vec3.angle(lasty,newy),vec3.angle(lasty,newz)];
        var az = [vec3.angle(lastz,newx),vec3.angle(lastz,newy),vec3.angle(lastz,newz)];
        
        var mrot = [Math.cos(ax[0]),Math.cos(ax[1]),Math.cos(ax[2]),0,
          Math.cos(ay[0]),Math.cos(ay[1]),Math.cos(ay[2]),0,
          Math.cos(az[0]),Math.cos(az[1]),Math.cos(az[2]),0,
          0,0,0,1
        ];
        
        m = mat4.multiply(mrot,m);

        loc = vec3.add(loc,t.relativePlacement.location);

        lastx = newx;
        lasty = newy;
        lastz = newz;
      }

      var q = new base.Quaternion();
      q.fromMatrix(mrot);
      
     return {position:loc,rotation:q.toEuler()};// mat4.transform(loc,null,null);
    },
    placementToTransform: function(placement) {
      var mat4 = base.mat4;
      var vec3 = base.vec3;
      
      var m = mat4.identity();
      
      var loc = [0,0,0];
      
      var lastx = [1,0,0];
      var lasty = [0,1,0];
      var lastz = [0,0,1];
      var newx, newy, newz;

      newz = placement.axis||[0,0,1];
      newx = placement.direction||[1,0,0];
      newy = vec3.cross(newz,newx);
      
      var ax = [vec3.angle(lastx,newx),vec3.angle(lastx,newy),vec3.angle(lastx,newz)];
      var ay = [vec3.angle(lasty,newx),vec3.angle(lasty,newy),vec3.angle(lasty,newz)];
      var az = [vec3.angle(lastz,newx),vec3.angle(lastz,newy),vec3.angle(lastz,newz)];
      
      var mrot = [Math.cos(ax[0]),Math.cos(ax[1]),Math.cos(ax[2]),0,
        Math.cos(ay[0]),Math.cos(ay[1]),Math.cos(ay[2]),0,
        Math.cos(az[0]),Math.cos(az[1]),Math.cos(az[2]),0,
        0,0,0,1
      ];
      
      m = mat4.multiply(mrot,m);

      loc = vec3.add(loc,placement.location);

      var q = new base.Quaternion();
      q.fromMatrix(mrot);
      
     return {position:loc,rotation:q.toEuler()};
    },
    buildRepresentation: function(representation,type) {
      type = type||"BoundingBox";
      
      this.cubeMesh = this.cubeMesh||new base.Mesh({
        primitive: {
          type: "box",
          size: 1.0,
          transform: { position: [0.5,0.5,0.5] }
        }
      });
      var cubeMesh = this.cubeMesh;
      
      function getContext(contexts,repType) {
        if (!contexts) {
          return null;
        }
        for (var i = 0; i < contexts.length; i++) {
          if (contexts[i].representationType == repType) {
            return contexts[i];
          }
        }
      }

      var tMesh = new base.Mesh();
      var vec2 = base.vec2;

      if (!representation||!representation.contexts&&!representation.items) {
        console.log("representation",representation);
        return null;
      }
      if (type=="BoundingBox") {
        var boundingBox = getContext(representation.contexts||representation.items,"BoundingBox");
        if (!boundingBox) return null;
        var bbox = boundingBox.items[0];
        tMesh.booleanAdd(cubeMesh,{position:bbox.corner,scale:[bbox.x,bbox.y,bbox.z]});
      } else if (type=="SweptSolid") {
        var sweptSolid = getContext(representation.contexts||representation.items,"SweptSolid");
        if (!sweptSolid) {
        //   console.log("NH",representation,representation.contexts);
          return null;
        }
        var curve = sweptSolid.items[0];
        var t = this.placementToTransform(curve.position);
        var p;
        if (curve.area && curve.area.x !== undef) {
          var hx = curve.area.x/2;
          var hy = curve.area.y/2;
          var cloc = curve.area.position.location;
          p = new base.Polygon([[-hx+cloc[0],hy+cloc[1]],[-hx+cloc[0],-hy+cloc[1]],[hx+cloc[0],-hy+cloc[1]],[hx+cloc[0],hy+cloc[1]]]);
        } else if (curve.area) {
          var c = [];
          var lastpt = null;
          for (var k = 0, kMax=curve.area.curve.length-1; k < kMax; k++) {
            if ((lastpt===null) || (lastpt && !vec2.equal(lastpt,curve.area.curve[k]))) {
              c.push(curve.area.curve[k]);
            }
            lastpt = curve.area.curve[k];
          }
          
          p = new base.Polygon(c);
        } else {
          return null;
        }
        // console.log(c);
        try {
          // console.log(p.toMesh(null));
          tMesh.booleanAdd(p.toExtrudedMesh(null,0,curve.depth),t);
        } catch (e) {
          console.log(e,sweptSolid);
          return null;
        }
        // console.log(tMesh);
      } else if (type=="Brep") {
        var brep = getContext(representation.contexts,"Brep");
        if (!brep) return null;
        var ifc_mesh_point_map = {};
        var ifc_face_map = {};
        
        for (var b = 0, bMax = brep.items.length; b<bMax; b++) {
          var bitem = brep.items[b];
          if (bitem.typeName=="ClosedShell") {
            for(var c = 0, cMax = bitem.value.length; c<cMax; c++) {
              var point_list = [];
              var points_in = bitem.value[c];
              for (t = 0, tMax = points_in.length; t<tMax; t++) {
                var pin = points_in[t];
                if (!ifc_mesh_point_map[pin]) {
                  ifc_mesh_point_map[pin] = tMesh.addPoint(this.param[pin]);
                }
                point_list[t] = ifc_mesh_point_map[pin];
              }
              if (point_list && point_list.length) {
                tMesh.addFace(point_list);
                // tMesh.addFace(point_list.slice(0).reverse());
                // if (point_list.length>4) {
                //   tMesh.faces[ifc_face_map[c]].flip();
                // }
              }
            }
          }
        }
      } else if (type == "MappedRepresentation") {
        var mrep = null;
        var ret = null;
                
        if (mrep = getContext(representation.contexts,"MappedRepresentation")) {
          ret = this.buildRepresentation({contexts:[mrep.items[0].source.representation]},"Brep");
          if (!ret) {
            ret = this.buildRepresentation({contexts:[mrep.items[0].source.representation]},"SweptSolid");
          }
        }
        
        if (mrep && !ret) {
          console.log("NH",representation,representation.contexts);
          return null;
        }
        
        tMesh = ret;
      } else if (type=="SurfaceModel") {
        var surf = getContext(representation.contexts,"SurfaceModel");
        if (!surf) return null;
        var ifc_mesh_point_map = {};
        var ifc_face_map = {};

        for (var b = 0, bMax = surf.items[0].length; b<bMax; b++) {
          var bitem = surf.items[0][b];
          for(var c = 0, cMax = bitem.length; c<cMax; c++) {
            var point_list = [];
            var points_in = bitem[c];
            for (t = 0, tMax = points_in.length; t<tMax; t++) {
              var pin = points_in[t];
              if (!ifc_mesh_point_map[pin]) {
                ifc_mesh_point_map[pin] = tMesh.addPoint(this.param[pin]);
              }
              point_list[t] = ifc_mesh_point_map[pin];
            }
            if (point_list && point_list.length) {
              tMesh.addFace(point_list);
              tMesh.addFace(point_list.slice(0).reverse());
              // if (point_list.length>4) {
              //   tMesh.faces[ifc_face_map[c]].flip();
              // }
            }
          }
        }
      }
      if (tMesh) {
        tMesh.removeDoubles();
      }
      
      return tMesh;
    },
    buildElements: function(mesh,elems) {
      var elemCount = elems.length;
      
      // var bbmat = new base.Material({
      //   color:[1,0,1],
      //   diffuse:[1,1,1],
      //   max_smooth: 30
      // });
      // 
      // var sweepmat = new base.Material({
      //   color:[0,1,0],
      //   diffuse:[1,1,1],
      //   max_smooth: 30        
      // });
      // 
      // var mrepmat = new base.Material({
      //   color:[0,0,1],
      //   diffuse:[1,1,1],
      //   max_smooth: 30        
      // });
      // 
      // var msurf = new base.Material({
      //   color:[0,1,1],
      //   diffuse:[1,1,1],
      //   max_smooth: 30        
      // });
      // 
      // var mat = new base.Material({
      //   color:[1,1,1],
      //   diffuse:[1,1,1],
      //   max_smooth: 30        
      // });
      
      // mesh.setFaceMaterial(bbmat);
      
      for (var i = 0; i < elemCount; i++) {
        var elem = elems[i];
        var elemMesh = this.buildRepresentation(elem.representation,"SweptSolid");
        // if (elemMesh) elemMesh.materials[0] = sweepmat;
        // var elemMesh = null;
        if (!elemMesh) {
          elemMesh = this.buildRepresentation(elem.representation,"Brep");
          // if (elemMesh) elemMesh.materials[0] = mat;
        }
        if (!elemMesh) {
          elemMesh = this.buildRepresentation(elem.representation,"MappedRepresentation");
          // if (elemMesh) elemMesh.materials[0] = mrepmat;
        }
        if (!elemMesh) {
          elemMesh = this.buildRepresentation(elem.representation,"SurfaceModel");
          // if (elemMesh) elemMesh.materials[0] = msurf;
        }
        if (!elemMesh) {
          elemMesh = this.buildRepresentation(elem.representation,"BoundingBox");
          // if (elemMesh) elemMesh.materials[0] = bbmat;
        }
        if (!elemMesh) {
          continue;
        }
        var t = this.localPlacementToTransform(elem.placement);
        mesh.booleanAdd(elemMesh,t);
      }
      
    }
  };


  var extend = {
    IFC: IFC
  };

  return extend;
});
