CubicVR.RegisterModule("PDF", function (base) {

    var undef = base.undef;
    var GLCore = base.GLCore;
    var enums = CubicVR.enums;

    function PDF(options) {
        if (!options.src) {
          throw("PDF Error: you must specify a src url for a PDF.");
        }

        var src = options.src,
          width = options.width || 1024,
          height = options.height || 1024,
          callback = options.callback || function() {},
          pdf,
          pages = [],
          thumbnails = [];

        /**
         * Number of pages, or 0 if not loaded yet.
         */
        this.__defineGetter__('pages', function() {
          return pdf ? pdf.numPages : 0;
        })

        this.getPage = function(n) {
//          // Need a better solution here...
//          if (!pages.length) {
//            console.log("PDF Error: pdf not loaded yet...");
//            return;
//          }

          // Normalize n
          n = n < 1 ? 1 : n;
          n = n > pdf.numPages ? pdf.numPages : n;
          n = n - 1;

          return pages[n];
        };

        getPdf(
          {
            url: src,
            error: function() {
              console.log('PDF Error: error loading pdf `' + src + '`');
            }
          },
          function(data) {
            pdf = new PDFDoc(data)

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
