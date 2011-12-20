CubicVR.RegisterModule("Camera", function (base) {

    var undef = base.undef;
    var enums = base.enums;
    var GLCore = base.GLCore;


    var cubicvr_identity = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0];

    var cameraUUID = 0;

    function Camera(width, height, fov, nearclip, farclip) {
        var mat4 = base.mat4;
        this.frustum = new base.Frustum();

        if (typeof (width) == 'object') {
            var obj_init = width;
        
            this.position = obj_init.position || [0, 0, -1];
            this.rotation = obj_init.rotation || [0, 0, 0];
            this.target = obj_init.target || [0, 0, 0];
            this.fov = obj_init.fov || 60.0;
            this.nearclip = (obj_init.nearclip || obj_init.nearClip || obj_init.near || 0.1);
            this.farclip = (obj_init.farclip || obj_init.farClip || obj_init.far || 400.0);
            this.targeted = (obj_init.targeted !== undef) ? obj_init.targeted : true;
            this.calc_nmatrix = (obj_init.calcNormalMatrix !== undef) ? obj_init.calcNormalMatrix : true;
            this.name = obj_init.name || ("camera" + cameraUUID);
            
            height = obj_init.height ? obj_init.height : undef;
            width = obj_init.width ? obj_init.width : undef;
        } else {
            this.position = [0, 0, 0];
            this.rotation = [0, 0, 0];
            this.target = [0, 0, 0];
            this.fov = (fov !== undef) ? fov : 60.0;
            this.nearclip = (nearclip !== undef) ? nearclip : 0.1;
            this.farclip = (farclip !== undef) ? farclip : 400.0;
            this.targeted = true;
            this.calc_nmatrix = true;
            this.name = "camera" + cameraUUID;
        }

        this.targetSceneObject = null;
        this.motion = null;
        this.transform = new base.Transform();

        this.manual = false;

        this.setDimensions((width !== undef) ? width : 512, (height !== undef) ? height : 512);

        this.mvMatrix = mat4.identity();
        this.pMatrix = null;
        this.calcProjection();

        this.ortho = false;
        this.ortho_view = {
            left: -1,
            right: 1,
            bottom: -1,
            top: 1
        };
        this.parent = null;
        ++cameraUUID;
    }

    Camera.prototype = {
        trackTarget: function(targetPos, speed, safeDist) {
          this.position = base.vec3.trackTarget(this.position,targetPos,speed,safeDist);
        },
    
        setParent: function(camParent) {
          this.parent = camParent;
        },
        
        hasParent: function() {
          return !!this.parent;
        },
        
        getParent: function() {
          return this.parent;           
        },
        
        getParentedPosition: function() {
          if (this.parent !== null && this.mvMatrix && this.parent.tMatrix) {                
            return base.mat4.vec3_multiply(this.position,this.parent.tMatrix);
          } else {
            return this.position;            
          }
        },
    
        setOrtho: function (left, right, bottom, top) {
            this.ortho = true;
            this.ortho_view.left = left;
            this.ortho_view.right = right;
            this.ortho_view.bottom = bottom;
            this.ortho_view.top = top;
        },

        control: function (controllerId, motionId, value) {
            if (controllerId === enums.motion.ROT) {
                this.rotation[motionId] = value;
            } else if (controllerId === enums.motion.POS) {
                this.position[motionId] = value;
            } else if (controllerId === enums.motion.FOV) {
                this.setFOV(value);
            } else if (controllerId === enums.motion.LENS) {
                this.setLENS(value);
            } else if (controllerId === enums.motion.NEARCLIP) {
                this.setClip(value, this.farclip);
            } else if (controllerId === enums.motion.FARCLIP) {
                this.setClip(this.nearclip, value);
            }
        },

        makeFrustum: function (left, right, bottom, top, zNear, zFar) {
            var A = (right + left) / (right - left);
            var B = (top + bottom) / (top - bottom);
            var C = -(zFar + zNear) / (zFar - zNear);
            var D = -2.0 * zFar * zNear / (zFar - zNear);

            return [2.0 * zNear / (right - left), 0.0, 0.0, 0.0, 0.0, 2.0 * zNear / (top - bottom), 0.0, 0.0, A, B, C, -1.0, 0.0, 0.0, D, 0.0];
        },


        setTargeted: function (targeted) {
            this.targeted = targeted;
        },

        calcProjection: function () {
            var mat4 = base.mat4;
            var mat3 = base.mat3;
            var vec3 = base.vec3;
            var gl = GLCore.gl;

            if (this.ortho) {
                this.pMatrix = mat4.ortho(this.ortho_view.left, this.ortho_view.right, this.ortho_view.bottom, this.ortho_view.top, this.nearclip, this.farclip);
            } else {
                this.pMatrix = mat4.perspective(this.fov, this.aspect, this.nearclip, this.farclip);
            }

            if (!this.targeted && this.mvMatrix) {
                mat4.identity(this.mvMatrix);

                mat4.rotate(-this.rotation[0],-this.rotation[1],-this.rotation[2], this.mvMatrix);
                mat4.translate(-this.position[0], -this.position[1], -this.position[2], this.mvMatrix);

                if (this.parent) {                
                  mat4.multiply(this.mvMatrix.slice(0),mat4.inverse(this.parent.tMatrix),this.mvMatrix);
                }

                if (this.calc_nmatrix) {
                    this.nMatrix = mat4.inverse_mat3(this.mvMatrix);
                    mat3.transpose_inline(this.nMatrix);
                } else {
                    mat4.identity(this.nMatrix);
                }
            }

            this.frustum.extract(this, this.mvMatrix, this.pMatrix);
        },

        setClip: function (nearclip, farclip) {
            this.nearclip = nearclip;
            this.farclip = farclip;
            this.calcProjection();
        },

        setDimensions: function (width, height) {
            this.width = width;
            this.height = height;

            this.aspect = width / height;
            this.calcProjection();
        },

        resize: function (width, height) {
            this.setDimensions(width, height);
        },

        setFOV: function (fov) {
            this.fov = fov;
            this.ortho = false;
            this.calcProjection();
        },

        setLENS: function (lens) {
            this.setFOV(2.0 * Math.atan(16.0 / lens) * (180.0 / Math.PI));
        },

        lookat: function (eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ) {
            var mat4 = base.mat4;
            var mat3 = base.mat3;

            if (typeof (eyeX) == 'object') {
                this.lookat(this.position[0], this.position[1], this.position[2], eyeX[0], eyeX[1], eyeX[2], 0, 1, 0);
                return;
            }

            this.mvMatrix = mat4.lookat(eyeX, eyeY, eyeZ, lookAtX, lookAtY, lookAtZ, upX, upY, upZ);

            if (this.rotation[2]) {
                this.transform.clearStack();
                this.transform.rotate(-this.rotation[2], 0, 0, 1);
                this.transform.pushMatrix(this.mvMatrix);
                this.mvMatrix = this.transform.getResult();
            }

            if (this.parent !== null) {                
              mat4.multiply(this.mvMatrix.slice(0),mat4.inverse(this.parent.tMatrix),this.mvMatrix);
            }

            if (this.calc_nmatrix) {
                this.nMatrix = mat4.inverse_mat3(this.mvMatrix);
                mat3.transpose_inline(this.nMatrix);
            } else {
                this.nMatrix = cubicvr_identity;
            }

            this.frustum.extract(this, this.mvMatrix, this.pMatrix);
        },

        unProject: function (winx, winy, winz) {
            var mat4 = base.mat4;
            var vec3 = base.vec3;

            //    var tmpClip = this.nearclip;
            //    if (tmpClip < 1.0) { this.nearclip = 1.0; this.calcProjection(); }
            var viewport = [0, 0, this.width, this.height];

            var p = [(((winx - viewport[0]) / (viewport[2])) * 2) - 1, -((((winy - viewport[1]) / (viewport[3])) * 2) - 1), 1, 1.0];

            var invp = mat4.vec4_multiply(mat4.vec4_multiply(p, mat4.inverse(this.pMatrix)), mat4.inverse(this.mvMatrix));

            //    if (tmpClip < 1.0) { this.nearclip = tmpClip; this.calcProjection(); }
            var result = [invp[0] / invp[3], invp[1] / invp[3], invp[2] / invp[3]];
            
            if (winz !== undef) {
              var pos = this.getParentedPosition();
              return vec3.add(pos,vec3.multiply(vec3.normalize(vec3.subtract(result,pos)),winz));
            }
            
            return result;
        },

        project: function (objx, objy, objz) {
            var mat4 = base.mat4;

            var p = [objx, objy, objz, 1.0];

            var mp = mat4.vec4_multiply(mat4.vec4_multiply(p, this.mvMatrix), this.pMatrix);
            
            // depth hack, not sure why this broke..
            mp[2] = base.vec3.length(base.vec3.subtract([objx,objy,objz],this.position));

            return [((mp[0] / mp[3] + 1.0) / 2.0) * this.width, ((-mp[1] / mp[3] + 1.0) / 2.0) * this.height, mp[2]];
        }
    };


    /*** Auto-Cam Prototype ***/

    function AutoCameraNode(pos) {
        this.position = (pos !== undef) ? pos : [0, 0, 0];
    }

    AutoCameraNode.prototype = {
      control: function (controllerId, motionId, value) {
          if (controllerId === enums.motion.POS) {
              this.position[motionId] = value;
          }
      }
    };

    function AutoCamera(start_position, target, bounds) {
        this.camPath = new base.Motion();
        this.targetPath = new base.Motion();

        this.start_position = (start_position !== undef) ? start_position : [8, 8, 8];
        this.target = (target !== undef) ? target : [0, 0, 0];

        this.bounds = (bounds !== undef) ? bounds : [
            [-15, 3, -15],
            [15, 20, 15]
        ];

        this.safe_bb = [];
        this.avoid_sphere = [];

        this.segment_time = 3.0;
        this.buffer_time = 20.0;
        this.start_time = 0.0;
        this.current_time = 0.0;

        this.path_time = 0.0;
        this.path_length = 0;

        this.min_distance = 2.0;
        this.max_distance = 40.0;

        this.angle_min = 40;
        this.angle_max = 180;
    }


    AutoCamera.prototype = {

        inBounds: function (pt) {
            var vec3 = base.vec3;
            if (!(pt[0] > this.bounds[0][0] && pt[1] > this.bounds[0][1] && pt[2] > this.bounds[0][2] && pt[0] < this.bounds[1][0] && pt[1] < this.bounds[1][1] && pt[2] < this.bounds[1][2])) {
                return false;
            }

            for (var i = 0, iMax = this.avoid_sphere.length; i < iMax; i++) {
                var l = vec3.length(pt, this.avoid_sphere[i][0]);
                if (l < this.avoid_sphere[i][1]) {
                    return false;
                }
            }

            return true;
        },

        findNextNode: function (aNode, bNode) {
            var vec3 = base.vec3;
            var d = [this.bounds[1][0] - this.bounds[0][0], this.bounds[1][1] - this.bounds[0][1], this.bounds[1][2] - this.bounds[0][2]];

            var nextNodePos = [0, 0, 0];
            var randVector = [0, 0, 0];
            var l = 0.0;
            var loopkill = 0;
            var valid = false;

            do {
                randVector[0] = Math.random() - 0.5;
                randVector[1] = Math.random() - 0.5;
                randVector[2] = Math.random() - 0.5;

                randVector = vec3.normalize(randVector);

                var r = Math.random();

                l = (r * (this.max_distance - this.min_distance)) + this.min_distance;

                nextNodePos = vec3.add(bNode.position, vec3.multiply(randVector, l));

                valid = this.inBounds(nextNodePos);

                loopkill++;

                if (loopkill > 30) {
                    nextNodePos = bNode.position;
                    break;
                }
            } while (!valid);

            return nextNodePos;
        },

        run: function (timer) {
            this.current_time = timer;

            if (this.path_time === 0.0) {
                this.path_time = this.current_time;

                this.camPath.setKey(enums.motion.POS, enums.motion.X, this.path_time, this.start_position[0]);
                this.camPath.setKey(enums.motion.POS, enums.motion.Y, this.path_time, this.start_position[1]);
                this.camPath.setKey(enums.motion.POS, enums.motion.Z, this.path_time, this.start_position[2]);
            }

            while (this.path_time < this.current_time + this.buffer_time) {
                this.path_time += this.segment_time;

                var tmpNodeA = new AutoCameraNode();
                var tmpNodeB = new AutoCameraNode();

                if (this.path_length) {
                    this.camPath.apply(this.path_time - (this.segment_time * 2.0), tmpNodeA);
                }

                this.camPath.apply(this.path_time - this.segment_time, tmpNodeB);

                var nextPos = this.findNextNode(tmpNodeA, tmpNodeB);

                this.camPath.setKey(enums.motion.POS, enums.motion.X, this.path_time, nextPos[0]);
                this.camPath.setKey(enums.motion.POS, enums.motion.Y, this.path_time, nextPos[1]);
                this.camPath.setKey(enums.motion.POS, enums.motion.Z, this.path_time, nextPos[2]);

                this.path_length++;
            }

            var tmpNodeC = new AutoCameraNode();

            this.camPath.apply(timer, tmpNodeC);

            return tmpNodeC.position;
        },

        addSafeBound: function (min, max) {
            this.safe_bb.push([min, max]);
        },

        addAvoidSphere: function (center, radius) {
            this.avoid_sphere.push([center, radius]);
        }
    };

    var exports = {
        Camera: Camera,
        AutoCamera: AutoCamera
    };

    return exports;
});
