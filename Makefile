
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

compile = java -jar $(TOOLS_DIR)/closure/compiler.jar --js $(CUBICVR_SRC) \
	                  --compilation_level SIMPLE_OPTIMIZATIONS \
	                  --js_output_file $(1)

all: $(DIST_DIR) $(CUBICVR_DIST) $(CUBICVR_MIN)
	@@echo "Finished, see $(DIST_DIR)"

$(DIST_DIR):
	@@echo "Creating $(DIST_DIR)"
	@@mkdir $(DIST_DIR)

$(CUBICVR_DIST): $(DIST_DIR) $(CUBICVR_SRC)
	@@echo "Building $(CUBICVR_DIST)"
	@@cp $(CUBICVR_SRC) $(CUBICVR_DIST)

$(CUBICVR_MIN): $(DIST_DIR) $(CUBICVR_SRC)
	@@echo "Building $(CUBICVR_MIN)"
	@@$(call compile,$(CUBICVR_MIN))

tests: $(DIST_DIR) $(CUBICVR_SRC)
	@@echo "Creating tests in $(TESTS_DIR)"
	@@$(call compile,$(CUBICVR_DIST))
	@@cp -R $(SRC_DIR)/tests $(TESTS_DIR)
	@@cp $(CUBICVR_VS) $(DIST_DIR)
	@@cp $(CUBICVR_FS) $(DIST_DIR)
	@@echo "Starting web server in $(TESTS_DIR), browse to http://localhost:9914/ (ctrl+c to stop)..."
	@@cd $(DIST_DIR) && python -m SimpleHTTPServer 9914

clean:
	@@rm -fr $(DIST_DIR)

check-lint:
	${TOOLSDIR}/jslint.py ${JSSHELL} CubicVR.js
