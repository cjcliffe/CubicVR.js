CubicVR.RegisterModule("Texture",function(base) {
 
  var GLCore = base.GLCore;
  var enums = CubicVR.enums;
  var undef = base.undef;

  /* Textures */
  var DeferredLoadTexture = function(img_path, filter_type) {
    this.img_path = img_path;
    this.filter_type = filter_type;
  } //DefferedLoadTexture

  DeferredLoadTexture.prototype.getTexture = function(deferred_bin, binId) {
    return new Texture(this.img_path, this.filter_type, deferred_bin, binId);
  } //getTexture

  var Texture = function(img_path,filter_type,deferred_bin,binId,ready_func) {
    var gl = GLCore.gl;

    this.tex_id = base.Textures.length;
    this.filterType = -1;
    this.onready = ready_func;
    this.loaded = false;
    base.Textures[this.tex_id] = gl.createTexture();
    base.Textures_obj[this.tex_id] = this;

    if (img_path) {
      if (typeof(img_path) === 'string') {
        base.Images[this.tex_id] = new Image();
      }
      else if (typeof(img_path) === 'object' && img_path.nodeName === 'IMG') {
        base.Images[this.tex_id] = img_path;
      } //if
      base.Textures_ref[img_path] = this.tex_id;
    }

    gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.tex_id]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    if (img_path) {
      var texId = this.tex_id;
      var filterType = (filter_type!==undef)?filter_type:GLCore.default_filter;
      
      var that = this;

      base.Images[this.tex_id].onload = function(e) {
        gl.bindTexture(gl.TEXTURE_2D, base.Textures[texId]);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

        var img = base.Images[texId];

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        var tw = img.width, th = img.height;
        
        var isPOT = true;
        
        if (tw===1||th===1) {
          isPOT = false;
        } else {
          if (tw!==1) { while ((tw % 2) === 0) { tw /= 2; } }
          if (th!==1) { while ((th % 2) === 0) { th /= 2; } }
          if (tw>1) { isPOT = false; }
          if (th>1) { isPOT = false; }        
        }

        if (!isPOT) {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        if (base.Textures_obj[texId].filterType===-1) {
          if (!isPOT) {
            if (filterType === enums.texture.filter.LINEAR_MIP) {
              filterType = enums.texture.filter.LINEAR;
            }
          }

          if (base.Textures_obj[texId].filterType===-1) {
            base.Textures_obj[texId].setFilter(filterType);      
          }
        }  
        else
        {
          base.Textures_obj[texId].setFilter(base.Textures_obj[texId].filterType);
        }        

        gl.bindTexture(gl.TEXTURE_2D, null);

        if (that.onready) {
          that.onready();
        } //if
        that.loaded = true;
      };

      if (!deferred_bin) {
        if (typeof(img_path) === 'string') {
          base.Images[this.tex_id].src = img_path;
        } //if
      }
      else {
        base.Images[this.tex_id].deferredSrc = img_path;
        //console.log('adding image to binId=' + binId + ' img_path=' + img_path);
        deferred_bin.addImage(binId,img_path,base.Images[this.tex_id]);
      }
    }

    this.active_unit = -1;
  };


  Texture.prototype.setFilter = function(filterType) {
    var gl = CubicVR.GLCore.gl;

    gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.tex_id]);

    if (filterType === enums.texture.filter.LINEAR) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    } else if (filterType === enums.texture.filter.LINEAR_MIP) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        gl.generateMipmap(gl.TEXTURE_2D);      
    } else if (filterType === enums.texture.filter.NEAREST) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);  
    } else if (filterType === enums.texture.filter.NEAREST_MIP) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);      
    }

    this.filterType = filterType;
  };

  Texture.prototype.use = function(tex_unit) {
    GLCore.gl.activeTexture(tex_unit);
    GLCore.gl.bindTexture(GLCore.gl.TEXTURE_2D, base.Textures[this.tex_id]);
    this.active_unit = tex_unit;
  };

  Texture.prototype.clear = function() {
    if (this.active_unit !== -1) {
      GLCore.gl.activeTexture(this.active_unit);
      GLCore.gl.bindTexture(GLCore.gl.TEXTURE_2D, null);
      this.active_unit = -1;
    }
  };

  function CanvasTexture(options) {
    var gl = CubicVR.GLCore.gl;

    if ( options.nodeName === 'CANVAS' || options.nodeName === 'IMG' ) {
      this.canvasSource = options;
    }
    else {
      this.canvasSource = document.createElement('CANVAS');
      if (options.width === undefined || options.height === undefined) {
        throw new Error('Width and height must be specified for generating a new CanvasTexture.');
      } //if
      this.canvasSource.width = options.width;
      this.canvasSource.height = options.height;
      this.canvasContext = this.canvasSource.getContext('2d');
    } //if

    var c = this.canvasSource, tw = c.width, th = c.height;
    
    var isPOT = true;
    
    if (tw===1||th===1) {
      isPOT = false;
    } else {
      if (tw !== 1) { while ((tw % 2) === 0) { tw /= 2; } }
      if (th !== 1) { while ((th % 2) === 0) { th /= 2; } }
      if (tw > 1) { isPOT = false; }
      if (th > 1) { isPOT = false; }       
    }

    this.updateFunction = options.update;

    this.texture = new CubicVR.Texture();

    this.setFilter=this.texture.setFilter;
    this.clear=this.texture.clear;
    this.use=this.texture.use;
    this.tex_id=this.texture.tex_id;
    this.filterType=this.texture.filterType;

    if (!isPOT) {
      this.setFilter(enums.texture.filter.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);    
    } else {
      this.setFilter(enums.texture.filter.LINEAR_MIP);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);    
    }

    if ( options.nodeName === 'IMG' ) {
      this.update();
    } //if
  }; //CanvasTexture

  CanvasTexture.prototype.update = function() {
    if (this.updateFunction) {
      this.updateFunction(this.canvasSource, this.canvasContext);
    } //if

    var gl = CubicVR.GLCore.gl;
    gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.texture.tex_id]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvasSource);
    if (this.filterType === enums.texture.filter.LINEAR_MIP) {
      gl.generateMipmap(gl.TEXTURE_2D);          
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
  }; //CanvasTexture.update

  function TextTexture(text, options) {
    var color = (options && options.color) || '#fff';
    var bgcolor = (options && options.bgcolor);
    var font = (options && options.font) || '18pt Arial';
    var align = (options && options.align) || 'start';
    var y = (options && options.y) || 0;
    var width = (options && options.width) || undef;
    var height = (options && options.height) || undef;
    
    var canvas = document.createElement('CANVAS');
    var ctx = canvas.getContext('2d');

    var lines = 0;
    if (typeof(text) === 'string') {
      lines = 1;
    }
    else {
      lines = text.length;
    } //if

    ctx.font = font;

    // This approximation is awful. There has to be a better way to find the height of a text block
    var lineHeight = (options && options.lineHeight) || ctx.measureText('OO').width;
    var widest;
    if (lines === 1) {
      widest = ctx.measureText(text).width;
    }
    else {
      widest = 0;
      for (var i=0; i<lines; ++i) {
        var w = ctx.measureText(text[i]).width;
        if (w > widest) {
          widest = w;
        } //if
      } //for
    } //if

    canvas.width = width || widest;
    canvas.height = height || lineHeight * lines;

    if (bgcolor) {
      ctx.fillStyle = bgcolor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } //if
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    if (lines === 1) {
      var x = (options && options.x) || align === 'center' ? canvas.width/2 : align === 'right' ? canvas.width : 0;
      ctx.fillText(text, x, y);
    }
    else {
      for (var i=0; i<lines; ++i) {
        var x = (options && options.x) || align === 'center' ? canvas.width/2 : align === 'right' ? canvas.width : 0;
        ctx.fillText(text[i], x, y+i*lineHeight);
      } //for
    } //if
    ctx.fill();

    this.use = CanvasTexture.prototype.use;
    this.clear = CanvasTexture.prototype.clear;
    this.update = CanvasTexture.prototype.update;
    CanvasTexture.apply(this, [canvas]);

    this.update();
    this.canvasSource = canvas = ctx = null;
  }; //TextTexture

  function PJSTexture(pjsURL, width, height) {
    var util = CubicVR.util;
    var gl = CubicVR.GLCore.gl;
    this.texture = new CubicVR.Texture();
    this.canvas = document.createElement("CANVAS");
    this.canvas.width = width;
    this.canvas.height = height;
    
    // this assumes processing is already included..
    this.pjs = new Processing(this.canvas,CubicVR.util.getURL(pjsURL));
    this.pjs.noLoop();
    this.pjs.redraw();
    
    var tw = this.canvas.width, th = this.canvas.height;
    
    var isPOT = true;
    
    if (tw===1||th===1) {
      isPOT = false;
    } else {
      if (tw !== 1) { while ((tw % 2) === 0) { tw /= 2; } }
      if (th !== 1) { while ((th % 2) === 0) { th /= 2; } }
      if (tw > 1) { isPOT = false; }
      if (th > 1) { isPOT = false; }       
    }
    
    // bind functions to "subclass" a texture
    this.setFilter=this.texture.setFilter;
    this.clear=this.texture.clear;
    this.use=this.texture.use;
    this.tex_id=this.texture.tex_id;
    this.filterType=this.texture.filterType;


    if (!isPOT) {
      this.setFilter(enums.texture.filter.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);    
    } else {
      this.setFilter(enums.texture.filter.LINEAR_MIP);
    }
  }

  PJSTexture.prototype.update = function() {
    var gl = CubicVR.GLCore.gl;

    this.pjs.redraw();
   
    gl.bindTexture(gl.TEXTURE_2D, base.Textures[this.texture.tex_id]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    
    if (this.filterType === enums.texture.filter.LINEAR_MIP) {
      gl.generateMipmap(gl.TEXTURE_2D);          
    }
    
    gl.bindTexture(gl.TEXTURE_2D, null); 
  };

  var extend = {
    Texture: Texture,
    DeferredLoadTexture: DeferredLoadTexture,
    CanvasTexture: CanvasTexture,
    TextTexture: TextTexture,
    PJSTexture: PJSTexture
  };
 
  return extend; 
});
