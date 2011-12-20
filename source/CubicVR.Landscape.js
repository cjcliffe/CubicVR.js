CubicVR.RegisterModule("Landscape", function (base) {

    var undef = base.undef;
    var enums = base.enums;
    var GLCore = base.GLCore;

    var cubicvr_identity = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];


    var M_TWO_PI = 2.0 * Math.PI;
    var M_HALF_PI = Math.PI / 2.0;

    function Landscape(size_in, divisions_in_w, divisions_in_h, matRef_in) {
        this.doTransform = function () {};
        this.tMatrix = cubicvr_identity;

        this.parent = null;
        this.position = [0, 0, 0];
        this.scale = [1, 1, 1];
        this.rotation = [0, 0, 0];
        this.size = size_in;
        this.divisions_w = divisions_in_w;
        this.divisions_h = divisions_in_h;
        this.matRef = matRef_in;
        this.children = null;
        this.visible = true;

        this.obj = new base.Mesh({dynamic:true,buildWireframe:true});

        var i, j;

        if (this.divisions_w > this.divisions_h) {
            this.size_w = size_in;
            this.size_h = (size_in / this.divisions_w) * this.divisions_h;
        } else if (this.divisions_h > this.divisions_w) {
            this.size_w = (size_in / this.divisions_h) * this.divisions_w;
            this.size_h = size_in;
        } else {
            this.size_w = size_in;
            this.size_h = size_in;
        }

        for (j = -(this.size_h / 2.0); j < (this.size_h / 2.0); j += (this.size_h / this.divisions_h)) {
            for (i = -(this.size_w / 2.0); i < (this.size_w / 2.0); i += (this.size_w / this.divisions_w)) {
                this.obj.addPoint([i + ((this.size_w / (this.divisions_w)) / 2.0), 0, j + ((this.size_h / (this.divisions_h)) / 2.0)]);
            }
        }

        var k, l;

        this.obj.setFaceMaterial(this.matRef);

        for (l = 0; l < this.divisions_h - 1; l++) {
            for (k = 0; k < this.divisions_w - 1; k++) {
                this.obj.addFace([(k) + ((l + 1) * this.divisions_w), (k + 1) + ((l) * this.divisions_w), (k) + ((l) * this.divisions_w)]);

                this.obj.addFace([(k) + ((l + 1) * this.divisions_w), (k + 1) + ((l + 1) * this.divisions_w), (k + 1) + ((l) * this.divisions_w)]);
            }
        }
    }

    Landscape.prototype = {
        isWireframe: function() {
            return false;
        },
        getMesh: function () {
            return this.obj;
        },
        getEventHandler: function() {
            return undef;
        },
        setIndexedHeight: function (ipos, jpos, val) {
            obj.points[(ipos) + (jpos * this.divisions_w)][1] = val;
        },

        mapGen: function (w_func, ipos, jpos, ilen, jlen) {
            var pt;

            if (ipos !== undef && jpos !== undef && ilen !== undef && jlen !== undef) {
                if (ipos >= this.divisions_w) return;
                if (jpos >= this.divisions_h) return;
                if (ipos + ilen >= this.divisions_w) ilen = this.divisions_w - 1 - ipos;
                if (jpos + jlen >= this.divisions_h) jlen = this.divisions_h - 1 - jpos;
                if (ilen <= 0 || jlen <= 0) return;

                for (var i = ipos, imax = ipos + ilen; i < imax; i++) {
                    for (var j = jpos, jmax = jpos + jlen; j < jmax; j++) {
                        var t = (i) + (j * this.divisions_w);
                        pt = this.obj.points[t];

                        pt[1] = w_func(pt[0], pt[2], t);
                    }
                }
            } else {
                for (var x = 0, xmax = this.obj.points.length; x < xmax; x++) {
                    pt = this.obj.points[x];

                    pt[1] = w_func(pt[0], pt[2], x);
                }
            }
        },

        getFaceAt: function (x, z) {
            if (typeof (x) === 'object') {
                return this.getFaceAt(x[0], x[2]);
            }

            var ofs_w = (this.size_w / 2.0) - ((this.size_w / (this.divisions_w)) / 2.0);
            var ofs_h = (this.size_h / 2.0) - ((this.size_h / (this.divisions_h)) / 2.0);

            var i = parseInt(Math.floor(((x + ofs_w) / this.size_w) * (this.divisions_w)), 10);
            var j = parseInt(Math.floor(((z + ofs_h) / this.size_h) * (this.divisions_h)), 10);

            if (i < 0) {
                return -1;
            }
            if (i >= this.divisions_w - 1) {
                return -1;
            }
            if (j < 0) {
                return -1;
            }
            if (j >= this.divisions_h - 1) {
                return -1;
            }

            var faceNum1 = parseInt(i + (j * (this.divisions_w - 1)), 10) * 2;
            var faceNum2 = parseInt(faceNum1 + 1, 10);

            var testPt = this.obj.points[this.obj.faces[faceNum1].points[0]];

            var slope = Math.abs(z - testPt[2]) / Math.abs(x - testPt[0]);

            if (slope >= 1.0) {
                return (faceNum1);
            } else {
                return (faceNum2);
            }
        },

        getHeightValue: function (x, z) {
            var triangle = base.triangle;

            if (typeof (x) === 'object') {
                return this.getHeightValue(x[0], x[2]);
            }

            var tmpFace;
            var tmpPoint;

            var faceNum = this.getFaceAt(x, z);

            if (faceNum === -1) {
                return 0;
            }

            tmpFace = this.obj.faces[faceNum];
            tmpPoint = this.obj.points[this.obj.faces[faceNum].points[0]];

            var tmpNorm = triangle.normal(this.obj.points[this.obj.faces[faceNum].points[0]], this.obj.points[this.obj.faces[faceNum].points[1]], this.obj.points[this.obj.faces[faceNum].points[2]]);

            var na = tmpNorm[0];
            var nb = tmpNorm[1];
            var nc = tmpNorm[2];

            var d = -(na * tmpPoint[0]) - (nb * tmpPoint[1]) - (nc * tmpPoint[2]);

            return (((na * x) + (nc * z) + d) / (-nb)); // add height ofs here
        },

        orient: function (x, z, width, length, heading, center) {
            if (center === undef) {
                center = 0;
            }

            var xpos, zpos;
            var xrot, zrot;
            var heightsample = [];
            var xyzTmp;

            var halfw = width / 2.0;
            var halfl = length / 2.0;

            var mag = Math.sqrt(halfl * halfl + halfw * halfw);
            var ang = Math.atan2(halfl, halfw);

            heading *= (Math.PI / 180.0);

            xpos = x + (Math.sin(heading) * center);
            zpos = z + (Math.cos(heading) * center);

            heightsample[0] = this.getHeightValue([xpos + mag * Math.cos(-ang - M_HALF_PI + heading), 0, zpos + mag * -Math.sin(-ang - M_HALF_PI + heading)]);
            heightsample[1] = this.getHeightValue([xpos + mag * Math.cos(ang - M_HALF_PI + heading), 0, zpos + mag * (-Math.sin(ang - M_HALF_PI + heading))]);
            heightsample[2] = this.getHeightValue([xpos + mag * Math.cos(-ang + M_HALF_PI + heading), 0, zpos + mag * (-Math.sin(-ang + M_HALF_PI + heading))]);
            heightsample[3] = this.getHeightValue([xpos + mag * Math.cos(ang + M_HALF_PI + heading), 0, zpos + mag * (-Math.sin(ang + M_HALF_PI + heading))]);

            xrot = -Math.atan2((heightsample[1] - heightsample[2]), width);
            zrot = -Math.atan2((heightsample[0] - heightsample[1]), length);

            xrot += -Math.atan2((heightsample[0] - heightsample[3]), width);
            zrot += -Math.atan2((heightsample[3] - heightsample[2]), length);

            xrot /= 2.0; // average angles
            zrot /= 2.0;


            return [[x, ((heightsample[2] + heightsample[3] + heightsample[1] + heightsample[0])) / 4.0, z], //
            [xrot * (180.0 / Math.PI), heading, zrot * (180.0 / Math.PI)]];
        }
    };

    var exports = {
        Landscape: Landscape
    };

    return exports;


});
