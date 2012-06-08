
CubicVR.RegisterModule("HeightField", function(base) {
    
    // heightfield is a fork and simplification of Landscape, hopefully for use in larger dynamic structures :)
    var undef = base.undef;
    var enums = base.enums;
    var GLCore = base.GLCore;

    var cubicvr_identity = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];

    var M_TWO_PI = 2.0 * Math.PI;
    var M_HALF_PI = Math.PI / 2.0;

    var heightfield_enums = {
        
    };

    enums.heightfield = heightfield_enums;

    function HeightField(opt) {
        opt = opt||{};
        opt = base.get(opt);
        
        this.size = opt.size;
        this.material = opt.material||(new base.Material());
        this.divX = opt.divX|0;
        this.divZ = opt.divZ|0;
        
        this.obj = null;

        if (this.divX > this.divZ) {
            this.sizeX = this.size;
            this.sizeZ = (this.size / this.divX) * this.divZ;
        } else if (this.divZ > this.divX) {
            this.sizeX = (this.size / this.divZ) * this.divX;
            this.sizeZ = this.size;
        } else {
            this.sizeX = this.size;
            this.sizeZ = this.size;
        }
    }

    HeightField.prototype = {
        getMesh: function () {
            if (this.obj === null) {
                this.obj = this.genMesh();
            }
            return this.obj;
        },

        setIndexedHeight: function (ipos, jpos, val) {
            obj.points[(ipos) + (jpos * this.divX)][1] = val;
        },

        genMesh: function() {
            var obj = new base.Mesh({dynamic:true,buildWireframe:true});
            
            var i, j;

            for (j = -(this.sizeZ / 2.0); j < (this.sizeZ / 2.0); j += (this.sizeZ / this.divZ)) {
                for (i = -(this.sizeX / 2.0); i < (this.sizeX / 2.0); i += (this.sizeX / this.divX)) {
                    obj.addPoint([i + ((this.sizeX / (this.divX)) / 2.0), 0, j + ((this.sizeZ / (this.divZ)) / 2.0)]);
                }
            }

            var k, l;

            obj.setFaceMaterial(this.material);

            for (l = 0; l < this.divZ - 1; l++) {
                for (k = 0; k < this.divX - 1; k++) {
                    obj.addFace([(k) + ((l + 1) * this.divX), (k + 1) + ((l) * this.divX), (k) + ((l) * this.divX)]);
                    obj.addFace([(k) + ((l + 1) * this.divX), (k + 1) + ((l + 1) * this.divX), (k + 1) + ((l) * this.divX)]);
                }
            }
            
            return obj;
        },
        
        mapGen: function (opt) {

            var w_func = opt.src||function() { return 0; }; 
            var ipos = opt.startX||0;
            var jpos = opt.startZ||0;
            var ilen = opt.walkX;
            var jlen = opt.walkZ;
        
            var pt,i,imax;

            if (ipos !== undef && jpos !== undef && ilen !== undef && jlen !== undef) {
                if (ipos >= this.divX) return;
                if (jpos >= this.divZ) return;
                if (ipos + ilen >= this.divX) ilen = this.divX - 1 - ipos;
                if (jpos + jlen >= this.divZ) jlen = this.divZ - 1 - jpos;
                if (ilen <= 0 || jlen <= 0) return;

                for (i = ipos, imax = ipos + ilen; i < imax; i++) {
                    for (var j = jpos, jmax = jpos + jlen; j < jmax; j++) {
                        var t = (i) + (j * this.divX);
                        pt = this.obj.points[t];

                        pt[1] = w_func(pt[0], pt[2], t);
                    }
                }
            } else {
                for (i = 0, imax = this.obj.points.length; i < imax; i++) {
                    pt = this.obj.points[i];

                    pt[1] = w_func(pt[0], pt[2], i);
                }
            }
        },

        getFaceAt: function (x, z) {
            if (typeof (x) === 'object') {
                return this.getFaceAt(x[0], x[2]);
            }

            var ofs_w = (this.sizeX / 2.0) - ((this.sizeX / (this.divX)) / 2.0);
            var ofs_h = (this.sizeZ / 2.0) - ((this.sizeZ / (this.divZ)) / 2.0);

            var i = parseInt(Math.floor(((x + ofs_w) / this.sizeX) * (this.divX)), 10);
            var j = parseInt(Math.floor(((z + ofs_h) / this.sizeZ) * (this.divZ)), 10);

            if (i < 0) {
                return -1;
            }
            if (i >= this.divX - 1) {
                return -1;
            }
            if (j < 0) {
                return -1;
            }
            if (j >= this.divZ - 1) {
                return -1;
            }

            var faceNum1 = parseInt(i + (j * (this.divX - 1)), 10) * 2;
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
        }
    };

    var exports = {
        HeightField: HeightField
    };

    return exports;
 
});

CubicVR.RegisterModule("Landscape", function (base) {

    var undef = base.undef;
    var enums = base.enums;
    var GLCore = base.GLCore;

    var cubicvr_identity = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];


    var M_TWO_PI = 2.0 * Math.PI;
    var M_HALF_PI = Math.PI / 2.0;

    // Landscape extends SceneObject
    var Landscape = base.extendClassGeneral(base.SceneObject, function() {
        // args: [0]size, [1]divisions_w, [2]divisions_h, [3]matRef 
        // todo: fix examples for single argument constructor
        this.heightfield = new base.HeightField({
            size: arguments[0], 
            divX: arguments[1], 
            divZ: arguments[2], 
            material: arguments[3]
        });
        
        base.SceneObject.apply(this,[{mesh:this.heightfield.getMesh()}]);
    },{ // subclass functions
        setIndexedHeight: function (ipos, jpos, val) {
            var obj = this.obj;
            obj.points[(ipos) + (jpos * this.divisions_w)][1] = val;
        },

        mapGen: function (w_func, ipos, jpos, ilen, jlen) {
           this.heightfield.mapGen({
               src: w_func,
               startX: ipos,
               startZ: jpos,
               walkX: ilen,
               walkZ: jlen
           });
        },

        getFaceAt: function (x, z) {
            return this.heightfield.getFaceAt([x,0,z]);
        },

        getHeightValue: function (x, z, transform) {
           
            if (transform !== undef) {
                // TODO: perform transformation inverse of x,0,z coordinate
            }

            return this.heightfield.getHeightValue([x,0,z]);
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
    });

    var exports = {
        Landscape: Landscape
    };

    return exports;


});


CubicVR.RegisterModule("SpatMaterial", function (base) {

    var undef = base.undef;
    var enums = base.enums;
    var GLCore = base.GLCore;
        
    var vs = [
        "void main(void) {",
        "  vertexTexCoordOut = cubicvr_texCoord();",
        "  gl_Position =  matrixProjection * matrixModelView * cubicvr_transform();",
        "  #if !LIGHT_DEPTH_PASS  // not needed if shadowing ",
        "    vertexNormalOut = matrixNormal * cubicvr_normal();",
        "    cubicvr_lighting();",
        "  #endif // !LIGHT_DEPTH_PASS ",
        "}"].join("\n");

    var dummyTex;
    
    var fs = [
        "uniform sampler2D spatImage;",
        "uniform sampler2D spat0;",
        "uniform sampler2D spat1;",
        "uniform sampler2D spat2;",
        "uniform sampler2D spat3;",
        "uniform sampler2D spat4;",
        "void main(void) ",
        "{  ",
            "vec2 texCoord = cubicvr_texCoord();",
            "vec4 spatSource = texture2D(spatImage,texCoord);",
            "vec2 spatTexCoord = texCoord*10.0;",
            "vec4 color = texture2D(spat0,spatTexCoord);",

            "color = mix(color,texture2D(spat1,spatTexCoord),spatSource.r);",
            "color = mix(color,texture2D(spat2,spatTexCoord),spatSource.g);",
            "color = mix(color,texture2D(spat3,spatTexCoord),spatSource.b);",
            "color = mix(color,texture2D(spat4,spatTexCoord),spatSource.a);",

            "vec3 normal = cubicvr_normal(texCoord);",
            "color = cubicvr_environment(color,normal,texCoord);",
            "color = cubicvr_lighting(color,normal,texCoord);",
            "gl_FragColor = clamp(color,0.0,1.0);",
        "}"].join("\n");

    // SpatMaterial extends Material
    var SpatMaterial = base.extendClassGeneral(base.Material, function() {
        var opt = arguments[0]||{};
        
        if (!dummyTex) {
            dummyTex = new base.Texture();
        }

        this.spats = opt.spats||[dummyTex,dummyTex,dummyTex,dummyTex,dummyTex];
        this.sourceTex = opt.sourceTexture||dummyTex; 
                
        var spats = this.spats;
        var sourceTexture = this.sourceTex;
        
        for (var i in spats) {
            var tex = spats[i];
            if (typeof(tex) === "string") {
              spats[i] = (base.Textures_ref[tex] !== undef) ? base.Textures_obj[base.Textures_ref[tex]] : (new base.Texture(tex));
            }
        }
        
        this.spatShader = new base.CustomShader({
            vertex: vs,
            fragment: fs,
            init: function(shader) {    
                
            }, 
            update: function(shader,opt) {
                var material = opt.material;
                var texIndex = opt.textureIndex;
                
                shader.spatImage.set(texIndex++,sourceTexture);

                if (spats[0]) shader.spat0.set(texIndex++,spats[0]);
                if (spats[1]) shader.spat1.set(texIndex++,spats[1]);
                if (spats[2]) shader.spat2.set(texIndex++,spats[2]);
                if (spats[3]) shader.spat3.set(texIndex++,spats[3]);
                if (spats[4]) shader.spat4.set(texIndex++,spats[4]);
            }
        });
        
        opt.shader = this.spatShader;
        
        base.Material.apply(this,[opt]);
                
    },{ // subclass functions
        setSpats: function(spats) {
            this.spats = spats;
        },
        getSpats: function() {
            return this.spats;
        },
        setSource: function(sourceTex) {
            
        }
    });

    var exports = {
        SpatMaterial: SpatMaterial
    };

    return exports;
});
