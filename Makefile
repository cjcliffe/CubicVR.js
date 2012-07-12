#############################################################################################
# NOTES:
#
# This Makefile assumes that you have the following installed, setup:
#
#  * Java
#  * Unixy shell (use msys on Windows)
#  * SpiderMonkey JavaScript Shell (jsshell), binaries available at:
#      https://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-mozilla-central/
#  * $JSSHELL environment variable in .profile or .bashrc pointing to a SpiderMonkey binary.
#    For example: export JSSHELL=/Users/dave/moz/jsshell/js
#
#############################################################################################

CUBICVR := CubicVR
SRC_DIR := .
DIST_DIR := $(SRC_DIR)/dist
CUBICVR_DIST := $(DIST_DIR)/$(CUBICVR).js
CUBICVR_MIN := $(DIST_DIR)/$(CUBICVR).min.js
CUBICVR_CORE := $(SRC_DIR)/CubicVR.js
CUBICVR_VS :=  $(SRC_DIR)/$(CUBICVR)_Core.vs
CUBICVR_FS := $(SRC_DIR)/$(CUBICVR)_Core.fs
TOOLS_DIR := $(SRC_DIR)/tools
TESTS_DIR := $(DIST_DIR)/tests
SOURCE_DIR := $(SRC_DIR)/source

# Though tempting to alphabetize the source list, there's a dependency order
# Don't re-arrange unless you need to.
# This list should match the module order near the end of CubicVR.js

JS_SRCS := \
  $(SOURCE_DIR)/CubicVR.Math.js \
  $(SOURCE_DIR)/CubicVR.Utility.js \
  $(SOURCE_DIR)/CubicVR.Shader.js \
  $(SOURCE_DIR)/CubicVR.MainLoop.js \
  $(SOURCE_DIR)/CubicVR.Texture.js \
  $(SOURCE_DIR)/CubicVR.Material.js \
  $(SOURCE_DIR)/CubicVR.Mesh.js \
  $(SOURCE_DIR)/CubicVR.UVMapper.js \
  $(SOURCE_DIR)/CubicVR.Renderer.js \
  $(SOURCE_DIR)/CubicVR.Light.js \
  $(SOURCE_DIR)/CubicVR.Camera.js \
  $(SOURCE_DIR)/CubicVR.Motion.js \
  $(SOURCE_DIR)/CubicVR.Event.js \
  $(SOURCE_DIR)/CubicVR.Scene.js \
  $(SOURCE_DIR)/CubicVR.PostProcess.js \
  $(SOURCE_DIR)/CubicVR.Layout.js \
  $(SOURCE_DIR)/CubicVR.Primitives.js \
  $(SOURCE_DIR)/CubicVR.COLLADA.js \
  $(SOURCE_DIR)/CubicVR.GML.js \
  $(SOURCE_DIR)/CubicVR.PDF.js \
  $(SOURCE_DIR)/CubicVR.Particles.js \
  $(SOURCE_DIR)/CubicVR.Landscape.js \
  $(SOURCE_DIR)/CubicVR.Octree.js \
  $(SOURCE_DIR)/CubicVR.CVRXML.js \
  $(SOURCE_DIR)/CubicVR.Worker.js \
  $(SOURCE_DIR)/CubicVR.Polygon.js \
  $(SOURCE_DIR)/CubicVR.ScenePhysics.js \
  $(SOURCE_DIR)/CubicVR.CollisionMap.js \
  $(SOURCE_DIR)/CubicVR.RigidVehicle.js


cutcore = ( python $(TOOLS_DIR)/cutter.py $(1) )

addheader = @@cat $(SRC_DIR)/HEADER > $(DIST_DIR)/header.tmp && \
            cat $(1) >> $(DIST_DIR)/header.tmp && \
            rm -f $(1) && \
            mv $(DIST_DIR)/header.tmp $(1)

compile = java -jar $(TOOLS_DIR)/closure/compiler.jar \
                    --js $(CUBICVR_DIST) \
	                  --compilation_level SIMPLE_OPTIMIZATIONS \
			  --language_in ECMASCRIPT5 \
	                  --js_output_file $(1)

# Convert shader file into js string, removing comments, whitespace, empty lines, and attach to window.CubicVR
stringify = ( echo '/* Auto Embed $(2) */' ; \
              /bin/echo -n "window.CubicVRShader.$(1)=" ; \
              python $(TOOLS_DIR)/stringify_shader.py $(2) )

jshint = echo "Linting $(1)" ; $$JSSHELL -f $(TOOLS_DIR)/jshint.js $(TOOLS_DIR)/jshint-cmdline.js < $(1)

all: $(DIST_DIR) $(CUBICVR_DIST) $(CUBICVR_MIN)
	@@echo "Finished, see $(DIST_DIR)"

$(CUBICVR_DIST): $(DIST_DIR) $(JS_SRCS)
	@@echo "Building $(CUBICVR_DIST)"
	@@$(call cutcore, $(CUBICVR_CORE)) > $(CUBICVR_DIST)
	@@cat $(JS_SRCS) >> $(CUBICVR_DIST)
	@@$(call cutfile,$(CUBICVR_DIST))
	@@$(call stringify,CubicVRCoreVS,$(CUBICVR_VS)) >> $(CUBICVR_DIST)
	@@$(call stringify,CubicVRCoreFS,$(CUBICVR_FS)) >> $(CUBICVR_DIST)
	@@$(call addheader,$(CUBICVR_DIST))

$(DIST_DIR):
	@@echo "Creating $(DIST_DIR)"
	@@mkdir $(DIST_DIR)

$(CUBICVR_MIN): $(DIST_DIR) $(CUBICVR_DIST)
	@@echo "Building $(CUBICVR_MIN)"
	@@$(call compile,$(CUBICVR_MIN))

tests: $(DIST_DIR) $(CUBICVR_DIST) $(CUBICVR_MIN)
	@@echo "Creating tests in $(TESTS_DIR)"
	@@mv $(CUBICVR_MIN) $(CUBICVR_DIST)
	@@cp -R $(SRC_DIR)/tests $(TESTS_DIR)
	@@echo "Starting web server in $(TESTS_DIR), browse to http://localhost:9914/ (ctrl+c to stop)..."
	@@cd $(DIST_DIR) && python ../$(TOOLS_DIR)/test_server.py

testserver: 
	@@echo "Starting web server browse to http://localhost:9914/ (ctrl+c to stop)..."
	@@python $(TOOLS_DIR)/test_server.py



clean:
	@@rm -fr $(DIST_DIR)

check-lint: check-lint-core check-lint-subsystems

check-lint-core:
	@@$(call jshint,$(CUBICVR_CORE))

check-lint-subsystems:
	@@$(foreach subsystem,$(JS_SRCS),echo "-----" ; $(call jshint,$(subsystem)) ; )
