
# CubicVR 3D Engine #

Javascript Port of the [CubicVR 3D Engine](http://www.cubicvr.org) by Charles J. Cliffe


## Contributors (@twitter) ##

 * Charles J. Cliffe [@ccliffe](http://twitter.com/ccliffe)
 * Corban Brook [@corban](http://twitter.com/corban)
 * Bobby Richter [@secretrobotron](http://twitter.com/secretrobotron)
 * David Humphrey [@humphd](http://twitter.com/humphd)

## License ##

 * [MIT License](http://www.opensource.org/licenses/mit-license.php)


## GIT Layout ##

### Folders ###

    /               ->  core library and shaders
    /source         ->  source modules
    /editor         ->  web-based 3D editor (work in progress)
    /samples        ->  sample projects, useful as a starting point
    /tests          ->  tests and prototypes for various core features
    /lib            ->  external dependencies for any tests/examples
    /post_shaders   ->  post-process shader library
    /tools          ->  code and distribution tools
    /utility        ->  utilities such as import/export, model conversion

### Branches ###

    master          ->  main branch

### Building / Minification ###

    To build the consolidated and minified versions of CubicVR.js simply run "make" in the repository root.  

    The resulting CubicVR.js and CubicVR.min.js builds with self-contained core shaders will be placed in dist/

    Minification requires Python and Java to be installed, please review installation instructions for your platform.    

