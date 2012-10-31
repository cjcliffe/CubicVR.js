var templates = [];
var inputFormGenerator = "";
var delay;
var pauseState = false;
var previewWaiting = false;
var autoState = true;
var style;
var editor;
var activeTool = "tabSplitMode";
var bhref = "";
var pauseViewState = false;


function collectTextNode(tn) {
    if (!tn) {
        return "";
    }

    var s = "";
    var textNodeChildren = tn.childNodes;
    for (var i = 0, tnl = textNodeChildren.length; i < tnl; i++) {
        s += textNodeChildren[i].nodeValue;
    }
    return s;
}


function loadSnippets() {
    srcUrl = "index.xml";
    try {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open('GET', srcUrl, false);
        xmlHttp.overrideMimeType("application/xml");
        xmlHttp.send(null);

        if (xmlHttp.status === 200 || xmlHttp.status === 0) {
            var xml = xmlHttp.responseXML;

            var elProj = document.getElementById("projSelector");
            var arFiles = xml.getElementsByTagName("samples")[0].getElementsByTagName("sample");

            elProj.options[elProj.options.length] = new Option("CubicVR.js Live Project", "");
            for (var i = 0; i < arFiles.length; i++) {
                var arFile = arFiles[i];
                var sampleFile = collectTextNode(arFile);
                var sampleName = arFile.getAttribute("name") || sampleFile;
                elProj.options[elProj.options.length] = new Option(sampleName, sampleFile);
            }

            var codeElem = document.getElementById("code");
            var defaultProject = collectTextNode(xml.getElementsByTagName("defaultproject")[0]);
            codeElem.value = defaultProject;
            inputFormGenerator = collectTextNode(xml.getElementsByTagName("inputFormGenerator")[0]);

            var snippets = xml.getElementsByTagName("snippet");
            var elSnippets = document.getElementById("snippets");
            elSnippets.options[elSnippets.options.length] = new Option("Code Snippets", "");

            for (var i = 0; i < snippets.length; i++) {
                var snippet = snippets[i];
                var snippetName = snippet.getAttribute("name");

                var template = collectTextNode(snippet.getElementsByTagName("template")[0]);
                var form = collectTextNode(snippet.getElementsByTagName("form")[0]);
                var jsform = eval("(" + form + ")");
                var jstemplate = {
                    generator: template,
                    title: snippetName,
                    form: jsform
                };
                templates[i] = jstemplate;
                elSnippets.options[elSnippets.options.length] = new Option(snippetName, i);
                elSnippets.addEventListener("change", function (p) {
                    return function (ev) {
                        if (this.selectedIndex === 0) {
                            return;
                        }
                        if (document.getElementById("dataForm")) {
                            document.body.removeChild(document.getElementById("dataForm"));
                        }
                        buildInputForm(templates[this.selectedIndex-1]);
                        this.selectedIndex = 0;
                    }
                }(i));
            }
        }
    } catch (e) {
        alert(srcUrl + " failed to load.\n" + e);
    }

    return null;
}


function getSelectedRange() {
    return {
        from: editor.getCursor(true),
        to: editor.getCursor(false)
    };
}

function autoFormatSelection() {
    var range = getSelectedRange();
    // editor.autoFormatRange(range.from, range.to);
    editor.autoIndentRange(range.from, range.to);
}

function closeSnippet() {
    if (document.getElementById("dataForm")) {
        document.body.removeChild(document.getElementById("dataForm"));
    }
}

function runDataForm(df, template) {
    var data = df.getElementsByTagName("input");
    var dataResult = {};

    if (data.length) for (var i = 0; i < data.length; i++) {
        var el = data[i];
        
        if (el.type && el.type == "button") {
            continue;
        }

        switch (el.type) {
            case "checkbox":
                dataResult[el.name] = el.checked?1:0;
            break;
            default:
                dataResult[el.name] = el.value;
            break;
        }
        // console.log(el.name,el.value);
    }

    data = df.getElementsByTagName("select");

    if (data.length) for (var i = 0; i < data.length; i++) {
        // console.log(data[i].name,data[i].options[data[i].selectedIndex].text,data[i].options[data[i].selectedIndex].value);
        dataResult[data[i].name] = data[i].options[data[i].selectedIndex].value;
    }

    // console.log(dataResult);

    editor.replaceSelection(tmpl(template.generator, dataResult));
    document.body.removeChild(df);
    autoFormatSelection();
}

function buildInputForm(template) {
    var formDiv = document.createElement("DIV");
    formDiv.className = "dataForm";
    formDiv.id = "dataForm";
    formDiv.innerHTML = tmplHTML(inputFormGenerator, {
        template: template
    });
    document.body.appendChild(formDiv);
    document.getElementById("dataSubmitButton").addEventListener("click",

    function (ev) {
        runDataForm(formDiv, template);
    });
}

function setSize(tool) {
    var el_preview = document.getElementById("preview");

    var newHeight = window.innerHeight - 46;
    var newWidth = window.innerWidth;

    if (tool) {
        document.getElementById(activeTool).className = "tool";
        activeTool = tool;
        document.getElementById(activeTool).className = "tool activeTool";
    }

    switch (activeTool) {
        case "tabSplitMode":
            el_preview.style.display = "none";
            editor.setSize(0, 0);
            editor.setSize(Math.floor(newWidth / 2), newHeight);
            el_preview.style.display = "";
            el_preview.style.height = newHeight + "px";
            el_preview.style.width = (newWidth / 2) + "px";
            if (pauseViewState) updatePreview();
            pauseViewState = false;
            break;
        case "tabPreviewMode":
            el_preview.style.display = "";
            el_preview.style.height = newHeight + "px";
            el_preview.style.width = newWidth + "px";
            editor.setSize(0, 0);
            if (pauseViewState) updatePreview();
            pauseViewState = false;
            break;
        case "tabCodeMode":
            el_preview.style.display = "none";
            editor.setSize(newWidth, newHeight);
            pauseViewState = true;
            break;
    }
}

var backupProj;
var initProj;

function loadProject(el) {
    if (el.value) {
        if (!backupProj) {
            backupProj = editor.getValue();
        }
        var arFile = el.value.split("/");
        bhref = "./" + arFile[1] + "/";

        var r = new XMLHttpRequest();
        r.open("GET", el.value, true);
        r.onreadystatechange = function () {
            if (r.readyState != 4 || (r.status != 200 && r.status != 0)) return;
            editor.setValue(r.responseText);
        };
        r.send();
    } else {
        if (backupProj) {
            editor.setValue(backupProj);
            backupProj = "";
        }
        bhref = "";
    }
}


// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
(function () {
    var cache = {};

    this.tmplHTML = function tmplHTML(str, data) {
        // Figure out if we're getting a template, or if we need to
        // load the template - and be sure to cache the result.
        var fn = !/\W/.test(str) ? cache[str] = cache[str] || tmplHTML(document.getElementById(str).innerHTML) :

        // Generate a reusable function that will serve as a template
        // generator (and which will be cached).
        new Function("obj", "var p=[],print=function(){p.push.apply(p,arguments);};" +

        // Introduce the data as local variables using with(){}
        "with(obj){p.push('" +

        // Convert the template into pure JavaScript
        str.replace(/[\r\t\n]/g, " ")
            .split("<%").join("\t")
            .replace(/((^|%>)[^\t]*)'/g, "$1\r")
            .replace(/\t=(.*?)%>/g, "',$1,'")
            .split("\t").join("');")
            .split("%>").join("p.push('")
            .split("\r").join("\\'") + "');}return p.join('');");

        // Provide some basic currying to the user
        return data ? fn(data) : fn;
    };
})();


// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
(function () {
    var cache = {};

    var tools = {
        parseColor: function( color ) {
            var colorMatch;
            if ( color.search(/^[a-f0-9]{6}$/) === 0 ) {
                return "[" +
                    parseInt( color[0] + color[1], 16 ) + ", " +
                    parseInt( color[2] + color[3], 16 ) + ", " +
                    parseInt( color[4] + color[5], 16 ) +
                "]";
            }
            else if ( colorMatch = color.match( /([0-9]+(\.[0-9]*)?),\s?([0-9]+(\.[0-9]*)?),\s?([0-9]+(\.[0-9]*)?)/ ) ) {
                var r = colorMatch[1];
                var g = colorMatch[3];
                var b = colorMatch[5];
                return "[" + r + ", " + g + ", " + b + "]";
            }

            return "[0, 0, 0]";
        }
    };

    this.tmpl = function tmpl(str, data) {
        // Figure out if we're getting a template, or if we need to
        // load the template - and be sure to cache the result.
        var fn = !/\W/.test(str) ? cache[str] = cache[str] || tmpl(document.getElementById(str).innerHTML) :

        // Generate a reusable function that will serve as a template
        // generator (and which will be cached).
        new Function("obj, tools", "var p=[],print=function(){p.push.apply(p,arguments);};" +

        // Introduce the data as local variables using with(){}
        "with(obj){p.push('" +

        // Convert the template into pure JavaScript
        str.replace(/[\r\t]/g, " ")
            .replace(/[\n]+/g, "/-LF-/")
            .split("<%").join("\t")
            .replace(/((^|%>)[^\t]*)'/g, "$1\r")
            .replace(/\t=(.*?)%>/g, "',$1,'")
            .split("\t").join("');")
            .split("%>").join("p.push('")
            .split("\r").join("\\'") + "');}return p.join('').replace(/\\/-LF-\\//g,'\\n').replace(/^\\s*\\n/gm,'').replace(/^\\s\\s*/, '').replace(/\\s\\s*$/, '');");

        // Provide some basic currying to the user
        return (data ? fn(data, tools) : fn);
    };
})();

function initialize() {
    loadSnippets();

    // Initialize CodeMirror editor with a nice html5 canvas demo.
    editor = CodeMirror.fromTextArea(document.getElementById('code'), {
        mode: 'text/html',
        tabMode: 'indent',
        onChange: function () {
            if (!backupProj && !window.onbeforeunload) {
                window.onbeforeunload = function () {
                    return "You will lose changes in your project, continue?";
                }
            }

            clearTimeout(delay);
            if (!pauseState && !pauseViewState && autoState) {
                delay = setTimeout(updatePreview, 3000);
                previewWaiting = false;
            } else {
                previewWaiting = true;
            }
        }
    });

    setTimeout(updatePreview, 300);
    setSize();
}


function updatePreview() {
    var previewFrame = document.getElementById('preview');
    var preview = previewFrame.contentDocument || previewFrame.contentWindow.document;
    preview.open();
    if (!initProj) {
        initProj = editor.getValue();
    }
    preview.write((bhref ? ("<base href='" + bhref + "' />") : "") + editor.getValue());
    preview.close();
}

function doAuto() {
    autoState = true;
    document.getElementById("autoButton").style.display = "";
    document.getElementById("manualButton").style.display = "none";
    document.getElementById("manualRunButton").style.display = "none";
}

function doManual() {
    autoState = false;
    document.getElementById("manualButton").style.display = "";
    document.getElementById("autoButton").style.display = "none";
    document.getElementById("manualRunButton").style.display = "";
}

function doManualRun() {
    updatePreview();
}

function doPause() {
    pauseState = true;
    document.getElementById("pauseButton").style.display = "none";
    document.getElementById("runButton").style.display = "";
}

function doRun() {
    pauseState = false;
    document.getElementById("pauseButton").style.display = "";
    document.getElementById("runButton").style.display = "none";
    updatePreview();
}

function tickHandler() {
    var preview = document.getElementById('preview');
    var icvr = preview.contentWindow.CubicVR;

    if (!icvr) return;
    if (!icvr.GLCore) return;

    if (icvr.GLCore.mainloop) {
        icvr.GLCore.mainloop_tmp = icvr.GLCore.mainloop;
    }

    if (icvr.GLCore.mainloop_tmp && icvr.GLCore.mainloop && (pauseState || pauseViewState)) {
        icvr.GLCore.mainloop = null;
    }
}

setInterval(tickHandler, 1000);