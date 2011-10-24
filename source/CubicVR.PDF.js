CubicVR.RegisterModule("PDF", function (base) {

    var undef = base.undef;
    var GLCore = base.GLCore;
    var enums = CubicVR.enums;

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
          width = width || page.width;
          height = height || page.height;

          return new CubicVR.PdfTexture(page, {width: width, height: height});
        };

        getPdf(
          {
            url: src,
            error: function() {
              console.log('PDF Error: error loading pdf `' + src + '`');
            }
          },
          function(data) {
            pdf = new PDFDoc(data);

            for (var i = 1, pp = pdf.numPages; i <= pp; i++) {
              var page = pdf.getPage(i);
              pages.push(page);
              thumbnails.push(page);
            }
            callback();
          }
        );
    }

    var extend = {
        PDF: PDF
    };

    return extend;
});
