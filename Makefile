
CUBICVR := CubicVR
SRC_DIR := .
DIST_DIR := $(SRC_DIR)/dist
CUBICVR_DIST := $(DIST_DIR)/$(CUBICVR).js
CUBICVR_MIN := $(DIST_DIR)/$(CUBICVR).min.js
CUBICVR_VS :=  $(SRC_DIR)/$(CUBICVR)_Core.vs
CUBICVR_FS := $(SRC_DIR)/$(CUBICVR)_Core.fs
TOOLS_DIR := $(SRC_DIR)/tools
TESTS_DIR := $(DIST_DIR)/tests
SOURCE_DIR := $(SRC_DIR)/source

JS_SRCS := \
  $(SOURCE_DIR)/CubicVR.js \
  $(SOURCE_DIR)/CubicVR.COLLADA.js \
  $(SOURCE_DIR)/CubicVR.CVRXML.js \
  $(SOURCE_DIR)/CubicVR.Camera.js \
  $(SOURCE_DIR)/CubicVR.GML.js \
  $(SOURCE_DIR)/CubicVR.Landscape.js \
  $(SOURCE_DIR)/CubicVR.Layout.js \
  $(SOURCE_DIR)/CubicVR.Light.js \
  $(SOURCE_DIR)/CubicVR.MainLoop.js \
  $(SOURCE_DIR)/CubicVR.Material.js \
  $(SOURCE_DIR)/CubicVR.Math.js \
  $(SOURCE_DIR)/CubicVR.Mesh.js \
  $(SOURCE_DIR)/CubicVR.Motion.js \
  $(SOURCE_DIR)/CubicVR.Octree.js \
  $(SOURCE_DIR)/CubicVR.Particles.js \
  $(SOURCE_DIR)/CubicVR.PostProcess.js \
  $(SOURCE_DIR)/CubicVR.Primitives.js \
  $(SOURCE_DIR)/CubicVR.Renderer.js \
  $(SOURCE_DIR)/CubicVR.Scene.js \
  $(SOURCE_DIR)/CubicVR.Shader.js \
  $(SOURCE_DIR)/CubicVR.Texture.js \
  $(SOURCE_DIR)/CubicVR.UVMapper.js \
  $(SOURCE_DIR)/CubicVR.Utility.js

addheader = @@cat $(SRC_DIR)/HEADER > $(DIST_DIR)/header.tmp && \
            cat $(1) >> $(DIST_DIR)/header.tmp && \
            rm -f $(1) && \
            mv $(DIST_DIR)/header.tmp $(1)

compile = java -jar $(TOOLS_DIR)/closure/compiler.jar $(shell for js in $(JS_SRCS) ; do echo --js $$js ; done) \
	                  --compilation_level SIMPLE_OPTIMIZATIONS \
	                  --js_output_file $(1)

# Convert shader file into js string, removing comments, whitespace, empty lines, and attach to window.CubicVR
stringify = ( echo '/* Auto Embed $(2) */' ; \
              /bin/echo -n "window.CubicVR.$(1)=" ; \
              python $(TOOLS_DIR)/stringify_shader.py $(2) )

$(CUBICVR_DIST): $(DIST_DIR) $(JS_SRCS)
	@@echo "Building $(CUBICVR_DIST)"
	@@cat $(JS_SRCS) > $(CUBICVR_DIST)
	@@$(call stringify,CubicVRCoreVS,$(CUBICVR_VS)) >> $(CUBICVR_DIST)
	@@$(call stringify,CubicVRCoreFS,$(CUBICVR_FS)) >> $(CUBICVR_DIST)
	@@$(call addheader,$(CUBICVR_DIST))

all: $(DIST_DIR) $(CUBICVR_DIST) $(CUBICVR_MIN)
	@@echo "Finished, see $(DIST_DIR)"

$(DIST_DIR):
	@@echo "Creating $(DIST_DIR)"
	@@mkdir $(DIST_DIR)

$(CUBICVR_MIN): $(DIST_DIR) $(CUBICVR_DIST)
	@@echo "Building $(CUBICVR_MIN)"
	@@$(call compile,$(CUBICVR_MIN))
	@@$(call addheader,$(CUBICVR_MIN))
	@@$(call stringify,CubicVRCoreVS,$(CUBICVR_VS)) >> $(CUBICVR_MIN)
	@@$(call stringify,CubicVRCoreFS,$(CUBICVR_FS)) >> $(CUBICVR_MIN)

tests: $(DIST_DIR) $(CUBICVR_MIN)
	@@echo "Creating tests in $(TESTS_DIR)"
	@@mv $(CUBICVR_MIN) $(CUBICVR_DIST)
	@@cp -R $(SRC_DIR)/tests $(TESTS_DIR)
	@@echo "Starting web server in $(TESTS_DIR), browse to http://localhost:9914/ (ctrl+c to stop)..."
	@@cd $(DIST_DIR) && python ../$(TOOLS_DIR)/test_server.py

clean:
	@@rm -fr $(DIST_DIR)

check-lint:
	${TOOLSDIR}/jslint.py ${JSSHELL} CubicVR.js
