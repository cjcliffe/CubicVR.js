
CubicVR.RegisterModule("HeightField", function(base) {
    
    var undef = base.undef;
    var enums = base.enums;
    var GLCore = base.GLCore;

    var cubicvr_identity = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];

    var M_TWO_PI = 2.0 * Math.PI;
    var M_HALF_PI = Math.PI / 2.0;

    // Drawing Enums
    enums.heightfield = {
        brush: {
            SINE: 0,
            SQUARE: 1
        },
        op: {
            ADD: 0,
            REPLACE: 1,
            SUBTRACT: 2
        }
    };
    
    // Landscape has been forked into Landscape/HeightField/HeightFieldBrush/HeightFieldMesh
    
    var HeightFieldBrush = function(opt) {
        opt = opt || {};
        
        this.operation = base.parseEnum(enums.draw.op,opt.operation||opt.op)||enums.draw.op.REPLACE;
        this.brushType = base.parseEnum(enums.draw.brush,opt.brushType)||enums.draw.brush.SINE;
        this.brushSize = opt.size||5;
        this.strength = opt.strength||1;
    }
    
    HeightFieldBrush.prototype = {
        setOperation: function(brushOperation) {
            this.operation = base.parseEnum(enums.draw.op,brushOperation);
        },
        getOperation: function() {
            return this.operation;
        },
        setBrushType: function(brushType) {
            this.brushType = base.parseEnum(enums.draw.brush,brushType)||enums.draw.brush.SINE;
        },
        getBrushType: function() {
            return this.brushType;
        },
        setSize: function(brushSize) {
            this.brushSize = brushSize;
        },
        getSize: function() {
            return this.brushSize;
        },
        setStrength: function(strength) {
            this.strength = strength;
        },
        getStrength: function() {
            return this.strength;
        }
    };

    var HeightField = function(opt) {
        opt = opt||{};
        
        this.divX = opt.divX||null;
        this.divZ = opt.divZ||null;
        this.size = opt.size||null;
        
        this.hfBuffer = null;
        this.hfUInt8Buffer = null;
        this.hfFloatBuffer = null;
        this.cellSize = null;
        this.sizeX = null;
        this.sizeZ = null;
        this.cellSize = null;

        if (this.divX && this.divZ && this.size) {
            this.initBuffer(this.divX,this.divZ,this.size);
        }
        
    }
    
    HeightField.prototype = {
        initBuffer: function(divX,divZ,size) {
            this.hfBuffer = new ArrayBuffer(divX*divZ*4);
            this.hfUInt8Buffer = new Uint8Array(this.hfBuffer);
            this.hfFloatBuffer = new Float32Array(this.hfBuffer);

            this.divX = divX||null;
            this.divZ = divZ||null;
            this.size = size||null;
            
            if (this.divX > this.divZ) {
                this.sizeX = size;
                this.sizeZ = (size / this.divX) * this.divZ;
            } else if (this.divZ > this.divX) {
                this.sizeX = (size / this.divZ) * this.divX;
                this.sizeZ = size;
            } else {
                this.sizeX = size;
                this.sizeZ = size;
            }
            
            
            this.drawBuffer = [];
            this.cellSize = this.sizeX/this.divX;
        },
        setBrush: function(brush) {
            this.brush = brush;
        },
        getBrush: function() {
            return this.brush;
        },
        draw: function(x,z,brush_in) {
            var brush = this.brush||brush_in;
            var op = brush.getOperation();
            var size = brush.getSize();
            var btype = brush.getBrushType();
            var strength = brush.getStrength();
            
            this.drawBuffer.push([x,z,op,size,btype,strength]); 
        },
        flush: function() {
          if (!this.drawBuffer.length) {
              return false;
          }
          while (this.drawBuffer.length) {
              var ev = this.drawBuffer.pop();
              this.drawFunc(ev[0],ev[1],ev[2],ev[3],ev[4],ev[5]);
          }
          return true;
        },        
        needsFlush: function() {
            return this.drawBuffer.length!=0;
        },
        drawFunc: function(x,z,op,size,btype,strength) {
            var hfBuffer = this.hfFloatBuffer;
            var hfWidth = this.divX;
            var hfDepth = this.divZ;
            
            var sz = size/this.cellSize;
            var ofs_w = (this.sizeX / 2.0) - ((this.sizeX / (this.divX)) / 2.0);
            var ofs_h = (this.sizeZ / 2.0) - ((this.sizeZ / (this.divZ)) / 2.0);
            
            x += ofs_w;
            z += ofs_h;

            x /= this.cellSize;
            z /= this.cellSize;

            for (var i = parseInt(Math.floor(x - sz)), iMax = parseInt(Math.ceil(x + sz)); i < iMax; i++) {
                var dx = i - x;

                for (var j = parseInt(Math.floor(z - sz)), jMax = parseInt(Math.ceil(z + sz)); j < jMax; j++) {
                    if (i <= 0 || i >= hfWidth || j <= 0 || j >= hfDepth) continue;
                    var dz = j - z;
                    // todo: implement ops..
                    var val = strength * ((1.0 - Math.sqrt(dx * dx + dz * dz) / (sz)) / 2.0);
                    
                    if (val < 0 && strength >= 0) val = 0;
                    if (val > 0 && strength <= 0) val = 0;
                    hfBuffer[j * hfWidth + i] += val;
                }
            }
        },
        getUint8Buffer: function() {
            return this.hfUInt8Buffer;
        },
        getFloat32Buffer: function() {
            return this.hfFloatBuffer;
        },
        getDivX: function() {
            return this.divX;
        },
        getDivZ: function() {
            return this.divZ;
        },
        getSizeX: function() {
            return this.sizeX;  
        },        
        getSizeZ: function() {
            return this.sizeZ;  
        },        
        getCellSize: function() {
            return this.cellSize;
        },
        getSize: function() {
            return this.size;
        },
        setRect: function (opt) {
            opt = opt||{};
             var setvalue = opt.value||0;
             var w_func = opt.src||opt.func||null;
             var ipos = opt.startX||0;
             var jpos = opt.startZ||0;
             var ilen = opt.walkX;
             var jlen = opt.walkZ;
             var hfBuffer = this.hfFloatBuffer;

             var pt,i,imax;

             var ofs_w = (this.sizeX / 2.0) - ((this.sizeX / (this.divX)) / 2.0);
             var ofs_h = (this.sizeZ / 2.0) - ((this.sizeZ / (this.divZ)) / 2.0);

             if (ipos !== undef && jpos !== undef && ilen !== undef && jlen !== undef) {
                 if (ipos >= this.divX) return;
                 if (jpos >= this.divZ) return;
                 if (ipos + ilen >= this.divX) ilen = this.divX - 1 - ipos;
                 if (jpos + jlen >= this.divZ) jlen = this.divZ - 1 - jpos;
                 if (ilen <= 0 || jlen <= 0) return;

                 for (i = ipos, imax = ipos + ilen; i < imax; i++) {
                     for (var j = jpos, jmax = jpos + jlen; j < jmax; j++) {
                         var t = (i) + (j * this.divX);
                         
                         if (w_func===null) {
                             hfBuffer[t] = setvalue;
                         } else {
                             hfBuffer[t] = w_func(this.cellSize*i-ofs_w, this.cellSize*j-ofs_h, t);
                         }
                     }
                 }
             } else {
                 for (i = 0, imax = this.hfFloatBuffer.length; i < imax; i++) {
                     if (w_func===null) {
                         hfBuffer[i] = setvalue;
                     } else {
                         var val = w_func((i%this.divX)*this.cellSize-ofs_w, (Math.floor(i/this.divX))*this.cellSize-ofs_h, i);
                         hfBuffer[i] = val;
                     }
                 }
             }
         },

         getIndicesAt: function (x, z) {
             // pretend we have faces and construct the triangle that forms at x,z
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
             
             // todo: this seems a tad wasteful..
             var slope = Math.abs(z-ofs_h - (i*this.cellSize-ofs_h)) / Math.abs(x-ofs_w - (j*this.cellSize-ofs_h));

             var faceIndices;

             if (slope >= 1.0) {
                 faceIndices = [(i) + ((j + 1) * this.divX), (i + 1) + ((j) * this.divX), (i) + ((j) * this.divX)];
                 return [i,j,faceIndices,0];    // starting index + index tuple + offset (half quad indicator)
             } else {
                 faceIndices = [(i) + ((j + 1) * this.divX), (i + 1) + ((j + 1) * this.divX), (i + 1) + ((j) * this.divX)];
                 return [i,j,faceIndices,1];
             }             
         },

         getHeightValue: function (x, z) {
             var triangle = base.triangle;

             if (typeof (x) === 'object') {
                 return this.getHeightValue(x[0], x[2]);
             }

             var tmpFace;
             var tmpPoint;

             var faceLoc = this.getIndicesAt(x, z);

             if (faceLoc === -1) {
                 return 0;
             }

             var ofs_w = (this.sizeX / 2.0) - ((this.sizeX / (this.divX)) / 2.0);
             var ofs_h = (this.sizeZ / 2.0) - ((this.sizeZ / (this.divZ)) / 2.0);

             var pointLoc = faceLoc[2];
             var xpos = faceLoc[0]*this.cellSize-ofs_w;
             var zpos = faceLoc[1]*this.cellSize-ofs_h;
             var faceOfs = faceLoc[3];
             
             var tmpNorm;
             
             if (faceOfs === 0) {
                 tmpNorm = triangle.normal(
                      [xpos,this.hfFloatBuffer[pointLoc[0]],zpos+this.cellSize], 
                      [xpos+this.cellSize,this.hfFloatBuffer[pointLoc[1]],zpos], 
                      [xpos,this.hfFloatBuffer[pointLoc[2]],zpos]  
                  );
             } else {
                 tmpNorm = triangle.normal(
                      [xpos,this.hfFloatBuffer[pointLoc[0]],zpos+this.cellSize], 
                      [xpos+this.cellSize,this.hfFloatBuffer[pointLoc[1]],zpos+this.cellSize], 
                      [xpos+this.cellSize,this.hfFloatBuffer[pointLoc[2]],zpos]  
                  );
             } 
             
             var na = tmpNorm[0];
             var nb = tmpNorm[1];
             var nc = tmpNorm[2];

             var tmpPoint = [xpos,this.hfFloatBuffer[pointLoc[0]],zpos+this.cellSize];

             var d = -(na * tmpPoint[0]) - (nb * tmpPoint[1]) - (nc * tmpPoint[2]);

             return (((na * x) + (nc * z) + d) / (-nb)); // add height ofs here
         }
    };
    
    
    var HeightFieldMesh = base.extendClassGeneral(base.Mesh, function() {
        var opt = arguments[0]||{};

        opt.dynamic = true;
        opt.buildWireframe = true;
        
        this.material = opt.material;
        
        this._update = base.Mesh.prototype.update;
        base.Mesh.apply(this,[opt]);

        this.hField = opt.hField||null;
        this.divX = opt.divX||null;
        this.divZ = opt.divZ||null;
        this.viewX = opt.viewX||0;
        this.viewZ = opt.viewZ||0;
        this.ofsX = opt.ofsX||0;
        this.ofsZ = opt.ofsZ||0;
        
        
        this.genHeightfieldMesh();
        
    },{ // subclass functions

        setIndexedHeight: function (ipos, jpos, val) {
            this.points[(ipos) + (jpos * this.divX)][1] = val;
        },

        genHeightfieldMesh: function() {
            var i, j;
            
            var dx = this.divX;
            var dz = this.divZ;
            var cellSize = this.hField.getCellSize();
            var szx = cellSize*this.divX;
            var szz = cellSize*this.divZ;

            if (this.points.length!==0) {
                this.clean();
            }

            for (j = -(szz / 2.0); j < (szz / 2.0); j += (szz / dz)) {
                for (i = -(szx / 2.0); i < (szx / 2.0); i += (szx / dx)) {
                    this.addPoint([i + ((szx / (dx)) / 2.0)+this.ofsX, 0, j + ((szz / (dz)) / 2.0)+this.ofsZ]);
                }
            }

            var k, l;

            this.setFaceMaterial(this.material);

            for (l = 0; l < dz - 1; l++) {
                for (k = 0; k < dx - 1; k++) {
                    this.addFace([(k) + ((l + 1) * dx), (k + 1) + ((l) * dx), (k) + ((l) * dx)]);
                    this.addFace([(k) + ((l + 1) * dx), (k + 1) + ((l + 1) * dx), (k + 1) + ((l) * dx)]);
                }
            }
        },
        
        update: function () {
            var startPosX = this.viewX||0;
            var startPosZ = this.viewZ||0;

            var hfViewWidth = this.divX;
            var hfViewDepth = this.divZ;
            var hfWidth = this.hField.getDivX();
            var hfDepth = this.hField.getDivZ();
            var hField = this.hField.getFloat32Buffer();

            for (var j = startPosZ, jMax = startPosZ+hfViewDepth; j<jMax; j++) { 
                for (var i = startPosX, iMax = startPosX+hfViewWidth; i<iMax; i++) {
                    var idx = j*hfWidth+i;
                    var point_idx = (j-startPosZ) * hfViewWidth + (i-startPosX);
                    var height_val = hField[idx];
                    this.points[point_idx][1] = height_val;
                }
            }

            this._update();
        }
    });

    var exports = {
        HeightField: HeightField,
        HeightFieldBrush: HeightFieldBrush,
        HeightFieldMesh: HeightFieldMesh
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
        this.hField = new base.HeightField({
            size: arguments[0], 
            divX: arguments[1], 
            divZ: arguments[2]
        });
        this.hfMesh = new base.HeightFieldMesh({
            hField: this.hField,
            size: arguments[0], 
            divX: arguments[1], 
            divZ: arguments[2], 
            material: arguments[3]
        });
        this.hfMesh.prepare();
        
        base.SceneObject.apply(this,[{mesh:this.hfMesh,shadowCast:false}]);
    },{ // subclass functions        
        getHeightField: function() {
            return this.hField;
        },

        mapGen: function (w_func, ipos, jpos, ilen, jlen) {
           this.hField.setRect({
               src: w_func,
               startX: ipos,
               startZ: jpos,
               walkX: ilen,
               walkZ: jlen
           });
           this.hfMesh.update();
        },

        getFaceAt: function (x, z) {
            return this.hField.getFaceAt([x,0,z]);
        },

        getHeightValue: function (x, z, transform) {
           
            if (transform !== undef) {
                // TODO: perform transformation inverse of x,0,z coordinate
            }

            return this.hField.getHeightValue([x,0,z]);
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
