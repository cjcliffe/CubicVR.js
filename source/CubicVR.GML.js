CubicVR.RegisterModule("GML", function (base) {

    var undef = base.undef;
    var GLCore = base.GLCore;
    var enums = CubicVR.enums;

    function GML(srcUrl) {
        var util = CubicVR.util;
        this.strokes = [];
        this.bounds = [1, 1, 1];
        this.origin = [0, 0, 0];
        this.upvector = [0, 1, 0];
        this.viewvector = [0, 0, 1];
        this.manual_pos = 0;

        if (srcUrl === undef) {
            return;
        }

        var gml = util.getXML(srcUrl);

        var gml_header = gml.getElementsByTagName("header");

        if (!gml_header.length) {
            return null;
        }

        var header = gml_header[0];

        var gml_environment = gml.getElementsByTagName("environment");


        if (!gml_environment.length) {
            return null;
        }

        this.name = null;

        var gml_name = header.getElementsByTagName("name");

        if (gml_name.length) {
            this.name = util.collectTextNode(gml_name[0]);
        }

        var gml_screenbounds = gml_environment[0].getElementsByTagName("screenBounds");

        if (gml_screenbounds.length) {
            this.bounds = [
            parseFloat(util.collectTextNode(gml_screenbounds[0].getElementsByTagName("x")[0])), parseFloat(util.collectTextNode(gml_screenbounds[0].getElementsByTagName("y")[0])), parseFloat(util.collectTextNode(gml_screenbounds[0].getElementsByTagName("z")[0]))];
        }

        var gml_origin = gml_environment[0].getElementsByTagName("origin");

        if (gml_origin.length) {
            this.origin = [
            parseFloat(util.collectTextNode(gml_origin[0].getElementsByTagName("x")[0])), parseFloat(util.collectTextNode(gml_origin[0].getElementsByTagName("y")[0])), parseFloat(util.collectTextNode(gml_origin[0].getElementsByTagName("z")[0]))];
        }

        var gml_upvector = gml_environment[0].getElementsByTagName("up");

        if (gml_upvector.length) {
            this.upvector = [
            parseFloat(util.collectTextNode(gml_upvector[0].getElementsByTagName("x")[0])), parseFloat(util.collectTextNode(gml_upvector[0].getElementsByTagName("y")[0])), parseFloat(util.collectTextNode(gml_upvector[0].getElementsByTagName("z")[0]))];
        }

        var gml_drawings = gml.getElementsByTagName("drawing");

        var drawings = [];

        for (var dCount = 0, dMax = gml_drawings.length; dCount < dMax; dCount++) {
            var drawing = gml_drawings[dCount];
            var gml_strokes = drawing.getElementsByTagName("stroke");

            var xm = 0,
                ym = 0,
                zm = 0,
                tm = 0;

            for (var sCount = 0, sMax = gml_strokes.length; sCount < sMax; sCount++) {
                var gml_stroke = gml_strokes[sCount];
                var gml_points = gml_stroke.getElementsByTagName("pt");
                var plen = gml_points.length;

                var points = new Array(plen);
                var px, py, pz, pt;

                for (var pCount = 0, pMax = plen; pCount < pMax; pCount++) {
                    var gml_point = gml_points[pCount];

                    px = parseFloat(util.collectTextNode(gml_point.getElementsByTagName("x")[0]));
                    py = parseFloat(util.collectTextNode(gml_point.getElementsByTagName("y")[0]));
                    pz = parseFloat(util.collectTextNode(gml_point.getElementsByTagName("z")[0]));
                    pt = parseFloat(util.collectTextNode(gml_point.getElementsByTagName("time")[0]));

                    if (this.upvector[0] === 1) {
                        points[pCount] = [(py !== py) ? 0 : py, (px !== px) ? 0 : -px, (pz !== pz) ? 0 : pz, pt];
                    } else if (this.upvector[1] === 1) {
                        points[pCount] = [(px !== px) ? 0 : px, (py !== py) ? 0 : py, (pz !== pz) ? 0 : pz, pt];
                    } else if (this.upvector[2] === 1) {
                        points[pCount] = [(px !== px) ? 0 : px, (pz !== pz) ? 0 : -pz, (py !== py) ? 0 : py, pt];
                    }

                    if (xm < px) {
                        xm = px;
                    }
                    if (ym < py) {
                        ym = py;
                    }
                    if (zm < pz) {
                        zm = pz;
                    }
                    if (tm < pt) {
                        tm = pt;
                    }
                }

                if (zm > tm) { // fix swapped Z/Time
                    for (var i = 0, iMax = points.length; i < iMax; i++) {
                        var t = points[i][3];
                        points[i][3] = points[i][2];
                        points[i][2] = t / this.bounds[2];
                    }
                }

                this.strokes[sCount] = points;
            }
        }
    }

    GML.prototype = {
        addStroke: function (points, tstep) {
            var pts = [];

            if (tstep === undef) {
                tstep = 0.1;
            }

            for (var i = 0, iMax = points.length; i < iMax; i++) {
                var ta = [points[i][0], points[i][1], points[i][2]];
                this.manual_pos += tstep;
                ta.push(this.manual_pos);
                pts.push(ta);
            }

            this.strokes.push(pts);
        },


        recenter: function () {
            var vec3 = CubicVR.vec3;
            var min = [0, 0, 0];
            var max = [this.strokes[0][0][0], this.strokes[0][0][1], this.strokes[0][0][2]];

            var i, iMax, s, sMax;

            for (s = 0, sMax = this.strokes.length; s < sMax; s++) {
                for (i = 0, iMax = this.strokes[s].length; i < iMax; i++) {
                    if (min[0] > this.strokes[s][i][0]) {
                        min[0] = this.strokes[s][i][0];
                    }
                    if (min[1] > this.strokes[s][i][1]) {
                        min[1] = this.strokes[s][i][1];
                    }
                    if (min[2] > this.strokes[s][i][2]) {
                        min[2] = this.strokes[s][i][2];
                    }

                    if (max[0] < this.strokes[s][i][0]) {
                        max[0] = this.strokes[s][i][0];
                    }
                    if (max[1] < this.strokes[s][i][1]) {
                        max[1] = this.strokes[s][i][1];
                    }
                    if (max[2] < this.strokes[s][i][2]) {
                        max[2] = this.strokes[s][i][2];
                    }
                }
            }

            var center = vec3.multiply(vec3.subtract(max, min), 0.5);

            for (s = 0, sMax = this.strokes.length; s < sMax; s++) {
                for (i = 0, iMax = this.strokes[s].length; i < iMax; i++) {
                    this.strokes[s][i][0] = this.strokes[s][i][0] - center[0];
                    this.strokes[s][i][1] = this.strokes[s][i][1] - (this.upvector[1] ? center[1] : (-center[1]));
                    this.strokes[s][i][2] = this.strokes[s][i][2] - center[2];
                }
            }
        },

        generateObject: function (seg_mod, extrude_depth, pwidth, divsper, do_zmove) {
            var vec3 = CubicVR.vec3;

            if (seg_mod === undef) {
                seg_mod = 0;
            }
            if (extrude_depth === undef) {
                extrude_depth = 0;
            }
            if (do_zmove === undef) {
                do_zmove = false;
            }

            // temporary defaults
            var divs = 3;
            //  var divsper = 0.02;
            if (divsper === undef) divsper = 0.02;
            //  var pwidth = 0.015;
            if (pwidth === undef) pwidth = 0.015;

            var extrude = extrude_depth !== 0;

            var segCount = 0;
            var faceSegment = 0;

            var obj = new CubicVR.Mesh(this.name);

            var lx, ly, lz, lt;

            var i, iMax, pCount;

            for (var sCount = 0, sMax = this.strokes.length; sCount < sMax; sCount++) {
                var strokeEnvX = new CubicVR.Envelope();
                var strokeEnvY = new CubicVR.Envelope();
                var strokeEnvZ = new CubicVR.Envelope();

                var pMax = this.strokes[sCount].length;

                var d = 0;
                var len_set = [];
                var time_set = [];
                var start_time = 0;
                var strk = this.strokes[sCount];

                for (pCount = 0; pCount < pMax; pCount++) {
                    var pt = strk[pCount];

                    var k1 = strokeEnvX.addKey(pt[3], pt[0]);
                    var k2 = strokeEnvY.addKey(pt[3], pt[1]);
                    var k3;

                    if (do_zmove) {
                        k3 = strokeEnvZ.addKey(pt[3], pt[2]);
                    } else {
                        k3 = strokeEnvZ.addKey(pt[3], 0);
                    }

                    k1.tension = 0.5;
                    k2.tension = 0.5;
                    k3.tension = 0.5;

                    if (pCount !== 0) {
                        var dx = pt[0] - lx;
                        var dy = pt[1] - ly;
                        var dz = pt[2] - lz;
                        var dt = pt[3] - lt;
                        var dlen = Math.sqrt(dx * dx + dy * dy + dz * dz);

                        d += dlen;

                        len_set[pCount - 1] = dlen;
                        time_set[pCount - 1] = dt;
                    } else {
                        start_time = pt[3];
                    }

                    lx = pt[0];
                    ly = pt[1];
                    lz = pt[2];
                    lt = pt[3];
                }

                var dpos = start_time;
                var ptofs = obj.points.length;

                for (pCount = 0; pCount < len_set.length; pCount++) {
                    var segLen = len_set[pCount];
                    var segTime = time_set[pCount];
                    var segNum = Math.ceil((segLen / divsper) * divs);

                    for (var t = dpos, tMax = dpos + segTime, tInc = (segTime / segNum); t < (tMax - tInc); t += tInc) {
                        if (t === dpos) {
                            lx = strokeEnvX.evaluate(t);
                            ly = strokeEnvY.evaluate(t);
                            lz = strokeEnvZ.evaluate(t);
                        }

                        var px, py, pz;

                        px = strokeEnvX.evaluate(t + tInc);
                        py = strokeEnvY.evaluate(t + tInc);
                        pz = strokeEnvZ.evaluate(t + tInc);

                        var pdx = (px - lx),
                            pdy = py - ly,
                            pdz = pz - lz;
                        var pd = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
                        var a;

                        a = vec3.multiply(
                        vec3.normalize(
                        vec3.cross(this.viewvector, vec3.normalize([pdx, pdy, pdz]))), pwidth / 2.0);

                        obj.addPoint([lx - a[0], -(ly - a[1]), (lz - a[2]) + (extrude ? (extrude_depth / 2.0) : 0)]);
                        obj.addPoint([lx + a[0], -(ly + a[1]), (lz + a[2]) + (extrude ? (extrude_depth / 2.0) : 0)]);

                        lx = px;
                        ly = py;
                        lz = pz;
                    }

                    dpos += segTime;
                }

                var ptlen = obj.points.length;

                if (extrude) {
                    for (i = ptofs, iMax = ptlen; i < iMax; i++) {
                        obj.addPoint([obj.points[i][0], obj.points[i][1], obj.points[i][2] - (extrude ? (extrude_depth / 2.0) : 0)]);
                    }
                }

                for (i = 0, iMax = ptlen - ptofs; i <= iMax - 4; i += 2) {
                    if (segCount % seg_mod === 0) {
                        faceSegment++;
                    }

                    obj.setSegment(faceSegment);

                    var arFace = [ptofs + i, ptofs + i + 1, ptofs + i + 3, ptofs + i + 2];
                    // var ftest = vec3.dot(this.viewvector, triangle.normal(obj.points[arFace[0]], obj.points[arFace[1]], obj.points[arFace[2]]));
                    var faceNum = obj.addFace(arFace);

                    // if (ftest < 0) {
                    //   this.faces[faceNum].flip();
                    // }
                    if (extrude) {
                        var arFace2 = [arFace[3] + ptlen - ptofs, arFace[2] + ptlen - ptofs, arFace[1] + ptlen - ptofs, arFace[0] + ptlen - ptofs];
                        faceNum = obj.addFace(arFace2);

                        arFace2 = [ptofs + i, ptofs + i + 2, ptofs + i + 2 + ptlen - ptofs, ptofs + i + ptlen - ptofs];
                        faceNum = obj.addFace(arFace2);

                        arFace2 = [ptofs + i + 1 + ptlen - ptofs, ptofs + i + 3 + ptlen - ptofs, ptofs + i + 3, ptofs + i + 1];
                        faceNum = obj.addFace(arFace2);

                        if (i === 0) {
                            arFace2 = [ptofs + i + ptlen - ptofs, ptofs + i + 1 + ptlen - ptofs, ptofs + i + 1, ptofs + i];
                            faceNum = obj.addFace(arFace2);
                        }
                        if (i === iMax - 4) {
                            arFace2 = [ptofs + i + 2, ptofs + i + 3, ptofs + i + 3 + ptlen - ptofs, ptofs + i + 2 + ptlen - ptofs];
                            faceNum = obj.addFace(arFace2);
                        }
                    }

                    segCount++;
                }
            }


            obj.calcFaceNormals();

            obj.triangulateQuads();
            obj.calcNormals();
            obj.compile();

            return obj;
        }
    };

    var extend = {
        GML: GML
    };

    return extend;
});
