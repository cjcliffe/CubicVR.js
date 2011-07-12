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

    lesson.popcorn.lessoninfo({
      start: 6,
      url: "https://github.com/cjcliffe/CubicVR.js/",
      title: "CubicVR.js on github",
      content: "CubicVR.js lives on github, along with documentation, live samples, and an issue tracker.",
    });

    lesson.popcorn.lessoncode({
      start: 71,
      label: 'init1'
    });

    lesson.popcorn.lessoncode({
      start: 100,
      label: 'initCheck'
    });

    lesson.popcorn.lessoncode({
      start: 126,
      label: 'init2'
    });

    lesson.popcorn.lessoncode({
      start: 193,
      label: 'mesh'
    });

    lesson.popcorn.lessoncode({
      start: 197,
      label: 'meshSize'
    });

    lesson.popcorn.lessoncode({
      start: 205,
      label: 'material'
    });

    lesson.popcorn.lessoncode({
      start: 220,
      label: 'prepareMesh'
    });

    lesson.popcorn.lessoncode({
      start: 238,
      label: 'cameraInit'
    });

    lesson.popcorn.lessoncode({
      start: 261,
      label: 'cameraSetup'
    });

    lesson.popcorn.lessoncode({
      start: 268,
      label: 'render',
      callback: function (code) {
        lesson.executeCode();
      }
    });

  }, false);
})(window, document, $, CubicVR);
