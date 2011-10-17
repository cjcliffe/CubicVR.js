var light = new CubicVR.Light({
    type: "point",
    method: "dynamic",
    diffuse:[1,1,1],
    specular:[1,1,1],
    position:[0,5,2],
    distance:20
});

scene.bind(light);
                
var sphereMesh = new CubicVR.Mesh({
    primitive: {
        type: "sphere",
        radius: 0.5,
        lat: 24,
        lon: 24,
        material: {
            color: [80/255, 200/255, 120/255],
            specular:[1,1,1],
            shininess: 0.9,
            env_amount: 1.0,
            textures: {
                color: "../images/2576-diffuse.jpg",
                normal: "../images/2576-normal.jpg",
                bump: "../images/2576-bump.jpg",
                envsphere: "../images/fract_reflections.jpg"
            }
        },
        uv: {
            projectionMode: "spherical",
            projectionAxis: "y",
            wrapW: 5,
            wrapH: 2.5
        }
    },
    compile: true
});

//sphereMesh.prepare();

scene.bind(new CubicVR.SceneObject({
    mesh:sphereMesh, 
    position:[0,0,0], 
    scale:[2,2,2]
    }));
