
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
    };
    
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
        
        this.areaBuffered = false;
        this.drawArea = {startX:0,startZ:0,endX:0,endZ:0};
    };
    
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
            this.cellSize = this.sizeX/(this.divX);
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
            
            if (!this.areaBuffered) {
                this.drawArea = { 
                    startX:x-(size),
                    startZ:z-(size),
                    endX:x+(size),
                    endZ:z+(size)
                };
                this.areaBuffered = true;
            } else {
                var startX = x-(size);
                var startZ = z-(size);
                var endX = x+(size);
                var endZ = z+(size);
                
                if (startX < this.drawArea.startX) {
                    this.drawArea.startX = startX;
                }
                if (startZ < this.drawArea.startZ) {
                    this.drawArea.startZ = startZ;
                }
                if (endX > this.drawArea.endX) {
                    this.drawArea.endX = endX;
                }
                if (endX > this.drawArea.endX) {
                    this.drawArea.endZ = endZ;
                }
            }
            
            this.drawBuffer.push([x,z,op,size,btype,strength]); 
        },
        getDrawArea: function() {
            if (!this.areaBuffered) {
                return false;
            }
            return this.drawArea;
        },
        clearDrawArea: function() {
            this.areaBuffered = false;
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
            return this.drawBuffer.length!==0;
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

            for (var i = parseInt(Math.floor(x - sz),10), iMax = parseInt(Math.ceil(x + sz),10); i < iMax; i++) {
                var dx = i - x;

                for (var j = parseInt(Math.floor(z - sz),10), jMax = parseInt(Math.ceil(z + sz),10); j < jMax; j++) {
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
                 return this.getIndicesAt(x[0], x[2]);
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
        this.edgeX = opt.edgeX||0;
        this.edgeZ = opt.edgeZ||0;
        this.normalBuffer = [];
        
        this.genHeightfieldMesh();
        
    },{ // subclass functions

        setIndexedHeight: function (ipos, jpos, val) {
            this.points[(ipos) + (jpos * this.divX)][1] = val;
        },

        genHeightfieldMesh: function() {
            var i, j;
            
            var dx = this.divX+this.edgeX;
            var dz = this.divZ+this.edgeZ;

            var cellSize = this.hField.getCellSize();

            var szx = cellSize*(this.divX);
            var szz = cellSize*(this.divZ);

            if (this.points.length!==0) {
                this.clean();
            }

            var zp = -(szz/2.0);

            for (j = 0; j < dz; j++) {
                var xp = -(szx/2.0);
                for (i = 0; i < dx; i++) {  
                    this.addPoint([xp+this.ofsX, 0, zp+this.ofsZ]);
                    xp += cellSize;
                }
                zp += cellSize;
            }

            var k, l;

            this.setFaceMaterial(this.material);

            var ustep = -1.0/(dx-1);
            var vstep = 1.0/(dz-1);
            var v = 0;
            
            for (l = 0; l < dz - 1; l++) {
                var u = 1;
                for (k = 0; k < dx - 1; k++) {
                    
                    f1 = this.addFace([(k) + ((l + 1) * dx), (k + 1) + ((l) * dx), (k) + ((l) * dx)]);
                    f2 = this.addFace([(k) + ((l + 1) * dx), (k + 1) + ((l + 1) * dx), (k + 1) + ((l) * dx)]);
                    
                    // dx=2;k=0;l=0;console.log([(k) + ((l + 1) * dx), (k + 1) + ((l) * dx), (k) + ((l) * dx)]);
                    // dx=2;k=0;l=0;console.log([(k) + ((l + 1) * dx), (k + 1) + ((l + 1) * dx), (k + 1) + ((l) * dx)]);

                    // 0 +---+ 1
                    //   | / |
                    // 2 +---+ 3
                    //
                    // 2,1,0
                    this.faces[f1].uvs = [
                        [u,v+vstep],
                        [u+ustep,v],
                        [u,v]
                    ];

                    // 2,3,1                    
                    this.faces[f2].uvs = [
                        [u,v+vstep],
                        [u+ustep,v+vstep],
                        [u+ustep,v]
                    ];
                    
                    u+=ustep;
                }
                v+=vstep;
            }
        },
        recalcNormals: function (normalMapRef,options) {
            var faceNum,faceMax,pointNum,pMax,i,l,n,a,b,c,nc,pn,oRef,oFace,face,faceMapRef,nCount;


            normalMapRef = normalMapRef||this.normalMapRef;

            if (!normalMapRef) return;
            
            var hasSegments = (options.segments!==undef)?true:false;
            var segments = options.segments;

            var dx = this.divX+this.edgeX;
            var dz = this.divZ+this.edgeZ;

            if (!this.normalBuffer.length) {
                for (i = 0; i < this.points.length; i++) {
                    this.normalBuffer.push([0,1,0]);
                }
                
                var f = 0;
                for (l = 0; l < dz - 1; l++) {
                    var u = 1;
                    for (k = 0; k < dx - 1; k++) {

                        this.faces[f++].point_normals = [this.normalBuffer[(k) + ((l + 1) * dx)], this.normalBuffer[(k + 1) + ((l) * dx)], this.normalBuffer[(k) + ((l) * dx)]];
                        this.faces[f++].point_normals = [this.normalBuffer[(k) + ((l + 1) * dx)], this.normalBuffer[(k + 1) + ((l + 1) * dx)], this.normalBuffer[(k + 1) + ((l) * dx)]];
                    }
                }
            }
            
            var hField = this.hField;
            
            
            var hBuffer = hField.getFloat32Buffer();
            
            var startPosX = this.viewX||0;
            var startPosZ = this.viewZ||0;            
            var startPos = startPosZ*hField.getDivX()+startPosX;
            
            for (i = 0; i < this.points.length; i++) {
                var xIdx = i % dx;
                var zIdx = Math.floor(i / dx);
                
                var up = startPos + (xIdx) + ((zIdx-1) * hField.getDivX());
                var dn = startPos + (xIdx) + ((zIdx+1) * hField.getDivX());
                var lf = startPos + (xIdx+1) + (zIdx * hField.getDivX());
                var rt = startPos + (xIdx-1) + (zIdx * hField.getDivX());
                var ct = startPos + (xIdx) + (zIdx * hField.getDivX());
                
                var up_y = hBuffer[up];
                var dn_y = hBuffer[dn];
                var lf_y = hBuffer[lf];
                var rt_y = hBuffer[rt];
                var ct_y = hBuffer[ct];

                if (up_y === undef) up_y = ct_y;
                if (dn_y === undef) dn_y = ct_y;
                if (lf_y === undef) lf_y = ct_y;
                if (rt_y === undef) rt_y = ct_y;

                var sl, sr, st, sb;

                sl = lf_y-ct_y;
                sr = ct_y-rt_y;

                st = up_y-ct_y;
                sb = ct_y-dn_y;

                var norm = base.vec3.normalize([(sl+sr)/2.0,2.0,(st+sb)/2.0]);
                
                this.normalBuffer[i][0] = norm[0];
                this.normalBuffer[i][1] = norm[1];
                this.normalBuffer[i][2] = norm[2];
            }
            
            return this;
        },       
        update: function () {
            var startPosX = this.viewX||0;
            var startPosZ = this.viewZ||0;

            var hfViewWidth = this.divX+this.edgeX;
            var hfViewDepth = this.divZ+this.edgeZ;
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
        if (arguments.length>1) {   // Transitional condition...
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
        } else {
            var opt = arguments[0]||{};
            
            this.size = opt.size||128;
            this.divX = opt.divX||128;
            this.divZ = opt.divZ||128;
            this.tiles = [];
            this.tileMeshes = [];
            this.tileMaterials = [];
            this.tileSpats = [];
            this.tileX = opt.tileX||this.divX;
            this.tileZ = opt.tileZ||this.divZ;
            this.tileChanged = [];
            this.tileSpatChanged = [];
            this.hField = new base.HeightField({
                size: this.size, 
                divX: this.divX, 
                divZ: this.divZ
            });
            
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

            this.cellSize = this.sizeX/(this.divX);
            this.tileSize = this.cellSize*(this.tileX);
            this.spatResolution = opt.spatResolution||1024;
            this.spats = opt.spats||[];

            base.SceneObject.apply(this,[{mesh:null,shadowCast:false}]);
            
            // var tileUV = new CubicVR.UVMapper({
            //     projectionMode: "planar",
            //     projectionAxis: "y",
            //     scale: [this.tileSize,0,this.tileSize],
            // });            

            
            var x=0, z=0;
            for (var j = 0; j < this.divZ; j+= this.tileZ) {
                x = 0;

                for (var i = 0; i < this.divX; i+=this.tileX) {
                    var spatImage = new CubicVR.DrawBufferTexture({width:this.spatResolution,height:this.spatResolution});

                    var edgeX = (i+1!=this.tileX)?1:0;
                    var edgeZ = (j+1!=this.tileZ)?1:0;

                    var spatMaterial = new CubicVR.SpatMaterial({
                       color: [1,1,1],
                       specular: [0.05,0.05,0.05],
                       spats: this.spats,
                       sourceTexture: spatImage
//                       spatOffset: [edgeX*(1.0+1.0/((this.spatResolution/this.tileX)/this.spatResolution)),0,edgeZ*(1.0+1.0/((this.spatResolution/this.tileZ)/this.spatResolution))]
                       // spatOffset: [1.0+edgeX*(1.0/this.cellSize/this.tileSize),0,1.0+edgeZ*(1.0/this.cellSize/this.tileSize)]
                       // spatOffset: (this.cellSize/th)
                    });
                    var tileMesh = new base.HeightFieldMesh({
                        hField: this.hField,
                        size: this.tileSize, 
                        divX: this.tileX,
                        divZ: this.tileZ,
                        viewX: i,
                        viewZ: j,
                        edgeX: edgeX,
                        edgeZ: edgeZ,
                        material: spatMaterial
                    });
 
                    // tileUV.apply(tileMesh, spatMaterial);
                    tileMesh.prepare();

                    var tile = new base.SceneObject({mesh:tileMesh});
                    
                    tile.position[0] = -(this.sizeX/2.0)+(this.tileSize*x)+(this.tileSize/2.0);
                    tile.position[2] = -(this.sizeZ/2.0)+(this.tileSize*z)+(this.tileSize/2.0);
                    this.bindChild(tile);
                    this.tiles.push(tile);
                    this.tileMeshes.push(tileMesh);
                    this.tileMaterials.push(spatMaterial);
                    this.tileSpats.push(spatImage);
                    this.tileChanged.push(false);
                    this.tileSpatChanged.push(false);
                    x++;
                    // this.tileSpats.push(spatMaterial?);
                }
                z++;
            }
        }
    },{ // subclass functions  
        update: function() {
            // if (this.tileMeshes && this.tileMeshes.length) {
            //     for (var i = 0, iMax = this.tileMeshes.length; i<iMax; i++) {
            //         if (Math.abs(this.tiles[i].position[0]-pos[0])<this.tileSize/2){
            //             if (Math.abs(this.tiles[i].position[1]-pos[1])<this.tileSize/2) 
            //             {
            //                 this.tileMeshes[i].update();
            //             }
            //         }
            //     }
            // }
            var i, iMax;
            
            if (this.hField.needsFlush()) {
              this.hField.flush();
            }
            
            var drawArea = this.hField.getDrawArea();
            if (drawArea !== false) {
                var drawTiles = this.getTileAt(drawArea.startX-this.cellSize,drawArea.startZ-this.cellSize,drawArea.endX-drawArea.startX+this.cellSize,drawArea.endZ-drawArea.startZ,this.cellSize);
                
                if (drawTiles !== false && drawTiles.length === undef) {
                    drawTiles = [drawTiles];
                }

                for (i = 0, iMax = drawTiles.length; i<iMax; i++) {
                    this.tileChanged[drawTiles[i]] = true;
                }
                
                this.hField.clearDrawArea();
            }
            
            for (i = 0, iMax = this.tiles.length; i < iMax; i++) {
                if (this.tileChanged[i]) {
                    this.tileMeshes[i].update();
                    this.tileChanged[i] = false;
                }
                if (this.tileSpatChanged[i]) {
                    this.tileSpats[i].update();
                    this.tileSpatChanged[i] = false;
                }
            }
        },
              
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
        },
        
        getTileAt: function(x,z,width,depth) {
            width=width||0;
            depth=depth||0;

            var tileRowSize = Math.floor(this.divX/this.tileX);
            var startTileX = Math.floor(((x+(this.sizeX/2.0))/(this.tileX*this.tileSize))*this.tileX);
            var startTileZ = Math.floor(((z+(this.sizeZ/2.0))/(this.tileZ*this.tileSize))*this.tileZ);
            var tileIdx = 0;          
                      
            if ((width===0)&&(depth===0)) {
                tileIdx = parseInt(startTileX+startTileZ*tileRowSize,10);
                return tileIdx;
            } else {
                var endTileX = Math.floor(((x+width+(this.sizeX/2.0))/(this.tileX*this.tileSize))*this.tileX);
                var endTileZ = Math.floor(((z+depth+(this.sizeZ/2.0))/(this.tileZ*this.tileSize))*this.tileZ);
                
                var tileList = [];
                
                // endTileX = endTileX % tileRowSize;
                // endTileZ = Math.floor(endTileZ / tileRowSize);

                for (var j = startTileZ; j <= endTileZ; j++) {
                    for (var i = startTileX; i <= endTileX; i++) {
                        tileIdx = j*(this.divX/this.tileX)+i;
                        if (tileIdx >= 0 && tileIdx < this.tiles.length) {
                            tileList.push(tileIdx);
                        }
                    }
                }

                return tileList;
            }
            // x, z, width, 
        },
        
        getSpatLocation: function(x,z,tileIdx) {
            var spatX, spatZ;
            
            if (tileIdx === undef) {
                spatX = ((1.0-(x / this.getHeightField().getSize() + 0.5)) *  this.spatResolution * (this.divX/this.tileX)) % this.spatResolution;
                spatZ = ((1.0-(z / this.getHeightField().getSize() + 0.5)) *  this.spatResolution * (this.divZ/this.tileZ)) % this.spatResolution;
            } else {
                var tileRowSize = (this.divX/this.tileX);
                var tileX = tileIdx % tileRowSize;
                var tileZ = Math.floor(tileIdx / tileRowSize);
                var posX = (-this.sizeX/2.0)+tileX*this.tileSize;
                var posZ = (-this.sizeZ/2.0)+tileZ*this.tileSize;

                spatX = (1.0-((x-posX) / this.tileSize)) *  this.spatResolution;
                spatZ = (1.0-((z-posZ) / this.tileSize)) *  this.spatResolution;
            }
            
            return {x: spatX, z: spatZ};
        },

        drawSpat: function(x,z,brush_in) {
            var brushSize = brush_in.getSize()*(this.size/this.spatResolution);

            var startX = x-(brushSize/2.0);
            var startZ = z-(brushSize/2.0);
            var endX = x+(brushSize/2.0);
            var endZ = z+(brushSize/2.0);
            
            var drawTiles = this.getTileAt(startX,startZ,endX-startX,endZ-startZ);
            
            if (drawTiles !== false && drawTiles.length===undef) {
                drawTiles = [drawTiles];
            }

            if (drawTiles !== false) {
                for (var i = 0, iMax = drawTiles.length; i<iMax; i++) {
                    var tileIdx = drawTiles[i];
                    var spatLoc = this.getSpatLocation(x,z,tileIdx);
                    
                    if (tileIdx >= 0 && tileIdx < this.tileSpats.length) {
                        this.tileSpats[tileIdx].draw(spatLoc.x,spatLoc.z,brush_in);
                        this.tileSpatChanged[tileIdx] = true;
                    }
                }
            }
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
        "uniform vec3 spatOffset;",
        "void main(void) ",
        "{  ",
            "vec2 texCoord = cubicvr_texCoord();",
            "vec2 spatTexCoord = texCoord*30.0;",
            "vec4 color = texture2D(spat0,spatTexCoord);",

            "vec2 spatSourceCoord = vec2(texCoord.x*spatOffset.x,texCoord.y*spatOffset.z);",
            "if (spatSourceCoord.s<=0.01) {",   // might need to set this based on spat resolution
            "   spatSourceCoord.s=0.01;",
            "}",
            "if (spatSourceCoord.t>=0.99) {",
            "   spatSourceCoord.t=0.99;",
            "}",

            "vec4 spatSource = texture2D(spatImage,spatSourceCoord);",

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
        
        this.spatOffset = opt.spatOffset||[1,0,1];
        this.spatResolution = opt.spatResolution||[1,0,1];
        
        var context = this;
        
        this.spatShader = new base.CustomShader({
            vertex: vs,
            fragment: fs,
            init: function(shader) {    
                
            }, 
            update: function(context) { return function(shader,opt) {
                var material = opt.material;
                var texIndex = opt.textureIndex;
                
                shader.spatImage.set(texIndex++,context.sourceTex);
                shader.spatOffset.set(context.spatOffset);

                if (spats[0]) shader.spat0.set(texIndex++,spats[0]);
                if (spats[1]) shader.spat1.set(texIndex++,spats[1]);
                if (spats[2]) shader.spat2.set(texIndex++,spats[2]);
                if (spats[3]) shader.spat3.set(texIndex++,spats[3]);
                if (spats[4]) shader.spat4.set(texIndex++,spats[4]);
            }; }(this)
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
            this.sourceTexture = sourceTex;
        }
    });

    var exports = {
        SpatMaterial: SpatMaterial
    };

    return exports;
});
