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
var snippetsUrl = "index.json";
var defaultProject;

function loadXHR(url, type) {
    type = type || "text/plain";

    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open('GET', url, false);
    xmlHttp.overrideMimeType(type);
    xmlHttp.send(null);

    if (xmlHttp.status === 200 || xmlHttp.status === 0) {
        return xmlHttp.response || xmlHttp.responseXML || xmlHttp.responseText;
    }

    return null;
}

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
    try {
        var json = loadXHR(snippetsUrl, "application/json");

        if (json) {
            json = JSON.parse(json);

            var elProj = document.getElementById("projSelector");
            var elSnippets = document.getElementById("snippets");
            var elGenerateButton = document.getElementById("generate-snippet");
            var codeElem = document.getElementById("code");

            var snippets = json.snippets;
            var samples = json.samples;
            var defaultProjectName = json.defaultProject;
            var inputFormGeneratorUrl = json.inputFormGenerator;

            snippets.forEach(function (snippetUrl, index){
                var snippetJSON = JSON.parse( loadXHR(snippetUrl, "application/json") );

                var snippetName = snippetJSON.name;

                var templateXML = loadXHR(snippetJSON.template);

                var template = {
                    generator: templateXML,
                    title: snippetName,
                    form: snippetJSON.form
                };

                var option = new Option(snippetName, index);

                elSnippets.appendChild(option);
                elGenerateButton.addEventListener("click", function (e) {
                    if (option === elSnippets.item()) {
                        if (document.getElementById("dataForm")) {
                            document.body.removeChild(document.getElementById("dataForm"));
                        }
                        buildInputForm(template);
                    }
                }, false);
            });

            samples.forEach(function (sample){
                var sampleName;
                var sampleUrl;
                var sampleType = typeof sample;
                var option;

                if (sampleType === "string") {
                    sampleName = sampleUrl = sample;
                }
                else if (sampleType === "object") {
                    sampleUrl = sample.url;
                    sampleName = sample.name || sampleUrl;
                }

                option = new Option(sampleName, sampleUrl);

                if (sample.default) {
                    defaultProject = option;
                    elProj.insertBefore(option, elProj.firstChild);
                }
                else {
                    elProj.appendChild(option);
                }
            });

            inputFormGenerator = loadXHR(inputFormGeneratorUrl);
        }

    } catch (e) {
        try {
            alert(snippetsUrl + " failed to load.\n" + e);
        } catch (ex) {
            throw (e);
        }
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
        if (data[i].type && data[i].type == "button") {
            continue;
        }
        // console.log(data[i].name,data[i].value);
        dataResult[data[i].name] = data[i].value;
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

    this.tmpl = function tmpl(str, data) {
        // Figure out if we're getting a template, or if we need to
        // load the template - and be sure to cache the result.
        var fn = !/\W/.test(str) ? cache[str] = cache[str] || tmpl(document.getElementById(str).innerHTML) :

        // Generate a reusable function that will serve as a template
        // generator (and which will be cached).
        new Function("obj", "var p=[],print=function(){p.push.apply(p,arguments);};" +

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
        return (data ? fn(data) : fn);
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

    loadProject(defaultProject);
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