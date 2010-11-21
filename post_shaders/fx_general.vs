attribute vec3 aVertex;
attribute vec2 aTex;
varying vec2 vTex;

void main(void)
{
	vTex = aTex;
	vec4 vPos = vec4(aVertex.xyz,1.0);
	gl_Position = vPos;
}
