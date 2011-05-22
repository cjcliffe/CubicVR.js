
CUBICVR := CubicVR
SRC_DIR := .
DIST_DIR := $(SRC_DIR)/dist
CUBICVR_SRC := $(SRC_DIR)/$(CUBICVR).js
CUBICVR_DIST := $(DIST_DIR)/$(CUBICVR).js
CUBICVR_MIN := $(DIST_DIR)/$(CUBICVR).min.js
CUBICVR_VS :=  $(SRC_DIR)/$(CUBICVR)_Core.vs
CUBICVR_FS := $(SRC_DIR)/$(CUBICVR)_Core.fs
TOOLS_DIR := $(SRC_DIR)/tools
TESTS_DIR := $(DIST_DIR)/tests

compile = java -jar $(TOOLS_DIR)/closure/compiler.jar --js $(CUBICVR_DIST) \
	                  --compilation_level SIMPLE_OPTIMIZATIONS \
	                  --js_output_file $(1)

stringify = (echo '/* Auto Embed $(2) */' ; \
             echo 'window.CubicVR.$(1) = "\\n\\' ; \
             cat $(2) | sed 's/$$/\\n\\/' ; \
             echo '";')

all: $(DIST_DIR) $(CUBICVR_DIST) $(CUBICVR_MIN)
	@@echo "Finished, see $(DIST_DIR)"

$(DIST_DIR):
	@@echo "Creating $(DIST_DIR)"
	@@mkdir $(DIST_DIR)

$(CUBICVR_DIST): $(DIST_DIR) $(CUBICVR_SRC)
	@@echo "Building $(CUBICVR_DIST)"
	@@cp $(CUBICVR_SRC) $(CUBICVR_DIST)
	@@$(call stringify,CubicVRCoreVS,$(CUBICVR_VS)) >> $(CUBICVR_DIST)
	@@$(call stringify,CubicVRCoreFS,$(CUBICVR_FS)) >> $(CUBICVR_DIST)

$(CUBICVR_MIN): $(DIST_DIR) $(CUBICVR_SRC) $(CUBICVR_DIST)
	@@echo "Building $(CUBICVR_MIN)"
	@@$(call compile,$(CUBICVR_MIN))

tests: $(DIST_DIR) $(CUBICVR_MIN)
	@@echo "Creating tests in $(TESTS_DIR)"
	@@mv $(CUBICVR_MIN) $(CUBICVR_DIST)
	@@cp -R $(SRC_DIR)/tests $(TESTS_DIR)
	@@echo "Starting web server in $(TESTS_DIR), browse to http://localhost:9914/ (ctrl+c to stop)..."
	@@cd $(DIST_DIR) && python -m SimpleHTTPServer 9914

clean:
	@@rm -fr $(DIST_DIR)

check-lint:
	${TOOLSDIR}/jslint.py ${JSSHELL} CubicVR.js
