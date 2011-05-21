

CUBICVR := CubicVR
SRC_DIR := .
DIST_DIR := $(SRC_DIR)/dist
CUBICVR_SRC := $(SRC_DIR)/$(CUBICVR).js
CUBICVR_DIST := $(DIST_DIR)/$(CUBICVR).js
CUBICVR_MIN := $(DIST_DIR)/$(CUBICVR).min.js
TOOLS_DIR := $(SRC_DIR)/tools

CLOSURE := java -jar $(TOOLS_DIR)/closure/compiler.jar

all: $(DIST_DIR) $(CUBICVR_DIST) $(CUBICVR_MIN)
	@@echo "Finished, see $(DIST_DIR)"

$(DIST_DIR):
	@@mkdir -p $(DIST_DIR)

$(CUBICVR_DIST): $(DIST_DIR)
	@@echo "Building $(CUBICVR_DIST)"
	@@cp $(CUBICVR_SRC) $(CUBICVR_DIST)

$(CUBICVR_MIN): $(DIST_DIR)
	@@echo "Building $(CUBICVR_MIN)"
	@@$(CLOSURE) --js $(CUBICVR_SRC) \
	             --compilation_level SIMPLE_OPTIMIZATIONS \
	             --js_output_file $(CUBICVR_MIN)

clean:
	@@rm -fr $(DIST_DIR)

check-lint:
	${TOOLSDIR}/jslint.py ${JSSHELL} CubicVR.js
