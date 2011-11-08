var obj_test;
var light_obj;
var lightMaterial;
var obj_torus;

light_obj = new CubicVR.Mesh();
lightMaterial = new CubicVR.Material("lightMat");

CubicVR.genBoxObject(light_obj,0.3,lightMaterial);
light_obj.calcNormals();

light_obj.triangulateQuads();
light_obj.compile();			

obj_torus = new CubicVR.Mesh();
				
// Make a material named test
objMaterial = new CubicVR.Material("test_material");
objMaterial.max_smooth = 89.9;
objMaterial.setTexture(new CubicVR.Texture("../images/1422-diffuse.jpg"),CubicVR.enums.texture.map.COLOR);
objMaterial.specular=[1,1,1];
objMaterial.shininess=0.5;

// Simple torus using lathe
var pointList = new Array();
var radius = 0.25;
var thick = 0.1;
var lat = 22.0;
var camera;

for (var i = Math.PI*2.0; i >= 0; i -= (Math.PI*2.0/lat)) 
{
    pointList.push([-radius+Math.cos(i)*thick,Math.sin(i)*thick,0]);
}
				
CubicVR.genLatheObject(obj_torus,pointList,16,objMaterial);				

obj_torus.calcNormals();

// Create a UV Mapper and apply it to objMaterial
objMaterialMap = new CubicVR.UVMapper();
objMaterialMap.projection_mode = CubicVR.enums.uv.projection.PLANAR;
objMaterialMap.projection_axis = CubicVR.enums.uv.axis.Y;
objMaterialMap.wrap_w_count = 5.0;
objMaterialMap.apply(obj_torus,objMaterial);

obj_torus.triangulateQuads();
obj_torus.compile();