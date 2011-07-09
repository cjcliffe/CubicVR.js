(function (window, document, $, CubicVR) {
  var lesson = new Lesson({
    onStart: function () {
      lesson.clearCode();
      var gl = CubicVR.GLCore.gl;
      gl.clearColor(1.0, 1.0, 1.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    onResume: function () {
    },
    onPause: function () {
    },
    onSeek: function () {
    }
  });

  document.addEventListener("DOMContentLoaded", function (e) {
    lesson.start();
    lesson.showCode();
    lesson.executeCode();
  }, false);
})(window, document, $, CubicVR);
