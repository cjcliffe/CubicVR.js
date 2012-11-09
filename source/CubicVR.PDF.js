CubicVR.RegisterModule("PDF", function (base) {

    var undef = base.undef;
    var GLCore = base.GLCore;
    var enums = CubicVR.enums;

    // Variant of pdf.js's getPdf
    function getPdf(arg, callback) {
      var params = arg;
      if (typeof arg === 'string')
        params = { url: arg };
    //#if !B2G
      var xhr = new XMLHttpRequest();
    //#else
    //var xhr = new XMLHttpRequest({mozSystem: true});
    //#endif
      xhr.open('GET', params.url);

      var headers = params.headers;
      if (headers) {
        for (var property in headers) {
          if (typeof headers[property] === 'undefined')
            continue;

          xhr.setRequestHeader(property, params.headers[property]);
        }
      }

      xhr.mozResponseType = xhr.responseType = 'arraybuffer';

      var protocol = params.url.substring(0, params.url.indexOf(':') + 1);

      //XXXsecretrobotron: Need to interject here. Protocol could be '', but still need 200 status to continue
      xhr.expected = (['http:', 'https:', ''].indexOf(protocol) > -1) ? 200 : 0;

      if ('progress' in params)
        xhr.onprogress = params.progress || undefined;

      var calledErrorBack = false;

      if ('error' in params) {
        xhr.onerror = function errorBack() {
          if (!calledErrorBack) {
            calledErrorBack = true;
            params.error();
          }
        };
      }

      xhr.onreadystatechange = function getPdfOnreadystatechange(e) {
        if (xhr.readyState === 4) {
          if (xhr.status === xhr.expected) {
            var data = (xhr.mozResponseArrayBuffer || xhr.mozResponse ||
                        xhr.responseArrayBuffer || xhr.response);
            callback(data);
          } else if (params.error && !calledErrorBack) {
            calledErrorBack = true;
            params.error(e);
          }
        }
      };
      xhr.send(null);
    }

    function PDF(options) {
        if (!options.src) {
          throw("PDF Error: you must specify a src url for a PDF.");
        }

        var src = options.src,
          width = options.width || null,
          height = options.height || null,
          callback = options.callback || function() {},
          pdf,
          pages = [],
          thumbnails = [];

        /**
         * Number of pages, or 0 if not loaded yet.
         */
        this.__defineGetter__('pages', function() {
          return pdf ? pdf.numPages : 0;
        });

        this.getPage = function(n) {
//          // Need a better solution here...
//          if (!pages.length) {
//            console.log("PDF Error: pdf not loaded yet...");
//            return;
//          }

          var pageCount = pdf.numPages;

          // Normalize n
          n = n < 1 ? 1 : n;
          n = n > pageCount ? pageCount : n;
          n = n - 1;

          return pages[n];
        };

        /**
         * Get a PdfTexture for the given page.  The texture is either
         * page.width x page.height or width x height (width and height
         * are optional).
         */
        this.getPageTexture = function(n, width, height) {
          var page = this.getPage(n);
          var viewport = page.getViewport(1);
          width = width || viewport.width;
          height = height || viewport.height;
          return new CubicVR.PdfTexture(page, {width: width, height: height, viewport: viewport});
        };


        var pdfParams = {
          url: src,
          progress: function(e){
          },
          error: function(e) {
            console.log('PDF Error: error loading pdf `' + src + '`');
          }
        };

        getPdf(pdfParams, function successCallback(data) {
          PDFJS.getDocument({
            data: data  
          }).then(
            function(doc){
              pdf = doc;

              var i = 0;

              // get pages in order
              function getNextPage() {
                if ( i++ >= doc.numPages ) {
                  callback();
                }
                else {
                  doc.getPage(i).then(function(page){
                    pages.push(page);
                    thumbnails.push(page);
                    getNextPage();
                  });
                }
              }

              getNextPage();
            },
            function(msg, e){
              console.warn(msg, e);
              callback();
            });
        });

    }

    var extend = {
        PDF: PDF
    };

    return extend;
});
