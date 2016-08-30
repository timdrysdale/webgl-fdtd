/* WebGL FDTD rendering
 * Adaptations by Tim Drysdale
 *
 * Adapted from:
 * WebGL Water
 * http://madebyevan.com/webgl-water/
 *
 * Copyright 2011 Evan Wallace
 * Released under the MIT license
 */

var helperFunctions = '\
  const float IOR_AIR = 1.0;\
  const float IOR_WATER = 1.333;\
  const vec3 abovewaterColor = vec3(0.25, 1.0, 1.25);\
  const vec3 underwaterColor = vec3(0.25, 1.0, 1.25);\
  const vec3 dielectricColor = vec3(1.25,0.25,0.25);\
  const vec3 pecColor = vec3(1.0,1.0,1.0);\
  const float poolHeight = 1.0;\
  uniform vec3 light;\
  uniform vec3 sphereCenter;\
  uniform float sphereRadius;\
  uniform vec3 sphereCenter2;\
  uniform float sphereRadius2;\
  uniform sampler2D tiles;\
  uniform sampler2D causticTex;\
  uniform sampler2D water;\
  uniform vec3 colorSphere1;\
  uniform vec3 colorSphere2;\
  \
  vec2 intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax) {\
    vec3 tMin = (cubeMin - origin) / ray;\
    vec3 tMax = (cubeMax - origin) / ray;\
    vec3 t1 = min(tMin, tMax);\
    vec3 t2 = max(tMin, tMax);\
    float tNear = max(max(t1.x, t1.y), t1.z);\
    float tFar = min(min(t2.x, t2.y), t2.z);\
    return vec2(tNear, tFar);\
  }\
  \
  float intersectSphere(vec3 origin, vec3 ray, vec3 sphereCenter, float sphereRadius) {\
    vec3 toSphere = origin - sphereCenter;\
    float a = dot(ray, ray);\
    float b = 2.0 * dot(toSphere, ray);\
    float c = dot(toSphere, toSphere) - sphereRadius * sphereRadius;\
    float discriminant = b*b - 4.0*a*c;\
    if (discriminant > 0.0) {\
      float t = (-b - sqrt(discriminant)) / (2.0 * a);\
      if (t > 0.0) return t;\
    }\
    return 1.0e6;\
  }\
  \
  vec3 getSphereColor(vec3 point) {\
    vec3 color = colorSphere1;\
    \
    /* ambient occlusion with walls */\
    color *= 1.0 - 0.9 / pow((1.0 + sphereRadius - abs(point.x)) / sphereRadius, 3.0);\
    color *= 1.0 - 0.9 / pow((1.0 + sphereRadius - abs(point.z)) / sphereRadius, 3.0);\
    color *= 1.0 - 0.9 / pow((point.y + 1.0 + sphereRadius) / sphereRadius, 3.0);\
    \
    /* caustics */\
    vec3 sphereNormal = (point - sphereCenter) / sphereRadius;\
    vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);\
    float diffuse = max(0.0, dot(-refractedLight, sphereNormal)) * 0.5;\
    vec4 info = texture2D(water, point.xz * 0.5 + 0.5);\
    if (point.y < info.r) {\
      vec4 caustic = texture2D(causticTex, 0.75 * (point.xz - point.y * refractedLight.xz / refractedLight.y) * 0.5 + 0.5);\
      diffuse *= caustic.r * 4.0;\
    }\
    color += diffuse;\
    \
    return color;\
  }\
    vec3 getSphere2Color(vec3 point) {\
    vec3 color = colorSphere2;\
    \
    /* ambient occlusion with walls */\
    color *= 1.0 - 0.9 / pow((1.0 + sphereRadius2 - abs(point.x)) / sphereRadius2, 3.0);\
    color *= 1.0 - 0.9 / pow((1.0 + sphereRadius2 - abs(point.z)) / sphereRadius2, 3.0);\
    color *= 1.0 - 0.9 / pow((point.y + 1.0 + sphereRadius2) / sphereRadius2, 3.0);\
    \
    /* caustics */\
    vec3 sphereNormal = (point - sphereCenter2) / sphereRadius2;\
    vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);\
    float diffuse = max(0.0, dot(-refractedLight, sphereNormal)) * 0.5;\
    vec4 info = texture2D(water, point.xz * 0.5 + 0.5);\
    if (point.y < info.r) {\
      vec4 caustic = texture2D(causticTex, 0.75 * (point.xz - point.y * refractedLight.xz / refractedLight.y) * 0.5 + 0.5);\
      diffuse *= caustic.r * 4.0;\
    }\
    color += diffuse;\
    \
    return color;\
  }\
  vec3 getToyColor(vec3 normal) {\
    vec3 color = vec3(0.5);\
    \
    /* caustics */\
    vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);\
    float diffuse = max(0.0, dot(-refractedLight, normal)) * 0.5;\
    color += diffuse;\
    \
    return color;\
  }\
  \
  vec3 getWallColor(vec3 point) {\
    float scale = 0.5;\
    \
    vec3 wallColor;\
    vec3 normal;\
    if (abs(point.x) > 0.999) {\
      wallColor = texture2D(tiles, point.yz * 0.5 + vec2(1.0, 0.5)).rgb;\
      normal = vec3(-point.x, 0.0, 0.0);\
    } else if (abs(point.z) > 0.999) {\
      wallColor = texture2D(tiles, point.yx * 0.5 + vec2(1.0, 0.5)).rgb;\
      normal = vec3(0.0, 0.0, -point.z);\
    } else {\
      wallColor = texture2D(tiles, point.xz * 0.5 + 0.5).rgb;\
      normal = vec3(0.0, 1.0, 0.0);\
    }\
    \
    scale /= length(point); /* pool ambient occlusion */\
    scale *= 1.0 - 0.9 / pow(length(point - sphereCenter) / sphereRadius, 4.0);  /* sphere ambient occlusion */\
    scale *= 1.0 - 0.9 / pow(length(point - sphereCenter2) / sphereRadius2, 4.0); /*  sphere2 ambient occlusion */\
    \
    /* caustics */\
    vec3 refractedLight = -refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);\
    float diffuse = max(0.0, dot(refractedLight, normal));\
    vec4 info = texture2D(water, point.xz * 0.5 + 0.5);\
    if (point.y < info.r) \
    {\
      vec4 caustic = texture2D(causticTex, 0.75 * (point.xz - point.y * refractedLight.xz / refractedLight.y) * 0.5 + 0.5);\
      scale += diffuse * caustic.r * 2.0 * caustic.g;\
    } else \
    {\
      /* shadow for the rim of the pool */\
      vec2 t = intersectCube(point, refractedLight, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));\
      diffuse *= 1.0 / (1.0 + exp(-200.0 / (1.0 + 10.0 * (t.y - t.x)) * (point.y + refractedLight.y * t.y - 2.0 / 12.0)));\
      \
      scale += diffuse * 0.5;\
    }\
    \
    return wallColor * scale;\
  }\
';

function Renderer() {
  this.tileTexture = GL.Texture.fromImage(document.getElementById('tiles'), {
    minFilter: gl.LINEAR_MIPMAP_LINEAR,
    wrap: gl.REPEAT,
    format: gl.RGB
  });
  this.lightDir = new GL.Vector(2.0, 2.0, -1.0).unit();
  this.causticTex = new GL.Texture(1024, 1024);
  this.waterMesh = GL.Mesh.plane({ detail: 200 });
  this.waterShaders = [];
  for (var i = 0; i < 2; i++) {
    this.waterShaders[i] = new GL.Shader('\
      uniform sampler2D water;\
      uniform sampler2D peclayout;\
      uniform sampler2D dielectricLayout;\
      uniform float showPEC;\
      varying vec3 position;\
      \
      void main() {\
        vec4 info = texture2D(water, gl_Vertex.xy * 0.5 + 0.5);\
        position = gl_Vertex.xzy;\
        position.y += info.r;\
        gl_Position = gl_ModelViewProjectionMatrix * vec4(position, 1.0);\
      }\
    ', helperFunctions + '\
      uniform samplerCube sky;\
      uniform sampler2D peclayout;\
      uniform sampler2D dielectricLayout;\
      uniform vec3 eye;\
      varying vec3 position;\
      uniform float showPEC;\
      \
      vec3 getSurfaceRayColor(vec3 origin, vec3 ray, vec3 waterColor) {\
        vec3 color;\
        float q = intersectSphere(origin, ray, sphereCenter, sphereRadius);\
        float q2 = intersectSphere(origin, ray, sphereCenter2, sphereRadius2);\
        vec3 theSphereColor = getSphereColor(origin + ray * q);\
        vec3 theSphere2Color = getSphere2Color(origin + ray * q2);\
        if (q2 < q) {\
          q = q2; \
          theSphereColor = theSphere2Color;\
        }\
        if (q < 1.0e6) {\
          color = theSphereColor;\
        } else if (ray.y < 0.0) {\
          vec2 t = intersectCube(origin, ray, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));\
          color = getWallColor(origin + ray * t.y);\
        } else {\
          vec2 t = intersectCube(origin, ray, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));\
          vec3 hit = origin + ray * t.y;\
          if (hit.y < 2.0 / 12.0) {\
            color = getWallColor(hit);\
          } else {\
            color = textureCube(sky, ray).rgb;\
            color += vec3(pow(max(0.0, dot(light, ray)), 5000.0)) * vec3(10.0, 8.0, 6.0);\
          }\
        }\
        if (ray.y < 0.0) color *= waterColor;\
        return color;\
      }\
      \
      void main() {\
        vec2 coord = position.xz * 0.5 + 0.5;\
        vec4 info = texture2D(water, coord);\
        vec4 pec = texture2D(peclayout, coord);\
        vec4 dielectric = texture2D(dielectricLayout, coord);\
        \
        /* make water look more "peaked" */\
        for (int i = 0; i < 5; i++) {\
          coord += info.ba * 0.001;\
          info = texture2D(water, coord);\
        }\
        \
        vec3 normal = vec3(info.b, sqrt(1.0 - dot(info.ba, info.ba)), info.a);\
        vec3 incomingRay = normalize(position - eye);\
        \
        ' + (i ? /* underwater */ '\
          normal = -normal;\
          vec3 reflectedRay = reflect(incomingRay, normal);\
          vec3 refractedRay = refract(incomingRay, normal, IOR_WATER / IOR_AIR);\
          float fresnel = mix(0.5, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0));\
          \
          vec3 reflectedColor = getSurfaceRayColor(position, reflectedRay, underwaterColor);\
          vec3 refractedColor = getSurfaceRayColor(position, refractedRay, vec3(1.0)) * vec3(0.8, 1.0, 1.1);\
          \
          gl_FragColor = vec4(mix(reflectedColor, refractedColor, (1.0 - fresnel) * length(refractedRay)), 1.0);\
        ' : /* above water */ '\
          vec3 reflectedRay = reflect(incomingRay, normal);\
          vec3 refractedRay = refract(incomingRay, normal, IOR_AIR / IOR_WATER);\
          float fresnel = mix(0.25, 1.0, pow(1.0 - dot(normal, -incomingRay), 3.0));\
          \
          vec3 useColor = abovewaterColor;\
          float opaqueMix = 0.0;\
          if (dielectric.b > 1.0) useColor = dielectricColor;\
          if (pec.a < 1.0) { \
            useColor = pecColor;\
            opaqueMix = 0.7;}\
          vec3 reflectedColor = getSurfaceRayColor(position, reflectedRay, useColor);\
          vec3 refractedColor = getSurfaceRayColor(position, refractedRay, useColor);\
          \
          /* gl_FragColor = vec4(mix(mix(refractedColor,reflectedColor,fresnel), vec3(1.0), showPEC*(1.0-pec.a)),1.0);*/\
          gl_FragColor =    vec4(mix(mix(refractedColor,reflectedColor,fresnel), vec3(1.0), opaqueMix),1.0);\
          \
          ') + '\
      }\
    ');
  }
  this.sphereMesh = GL.Mesh.sphere({ detail: 10 });
  this.sphereMesh2 = GL.Mesh.sphere({ detail: 10 });
  this.sphereShader = new GL.Shader(helperFunctions + '\
    varying vec3 position;\
    void main() {\
      position = sphereCenter + gl_Vertex.xyz * sphereRadius;\
      gl_Position = gl_ModelViewProjectionMatrix * vec4(position, 1.0);\
    }\
  ', helperFunctions + '\
    varying vec3 position;\
    void main() {\
      gl_FragColor = vec4(getSphereColor(position), 1.0);\
      vec4 info = texture2D(water, position.xz * 0.5 + 0.5);\
      if (position.y < info.r) {\
        gl_FragColor.rgb *= underwaterColor * 1.2;\
      }\
    }\
');

  this.sphere2Shader = new GL.Shader(helperFunctions + '\
    varying vec3 position;\
    void main() {\
      position = sphereCenter2 + gl_Vertex.xyz * sphereRadius2;\
      gl_Position = gl_ModelViewProjectionMatrix * vec4(position, 1.0);\
    }\
  ', helperFunctions + '\
    varying vec3 position;\
    void main() {\
      gl_FragColor = vec4(getSphere2Color(position), 1.0);\
      vec4 info = texture2D(water, position.xz * 0.5 + 0.5);\
      if (position.y < info.r) {\
        gl_FragColor.rgb *= underwaterColor * 1.2;\
      }\
    }\
');  

  
  this.cubeMesh = GL.Mesh.cube();
  this.cubeMesh.triangles.splice(4, 2);
  this.cubeMesh.compile();
  this.cubeShader = new GL.Shader(helperFunctions + '\
    varying vec3 position;\
    void main() {\
      position = gl_Vertex.xyz;\
      position.y = ((1.0 - position.y) * (7.0 / 12.0) - 1.0) * poolHeight;\
      gl_Position = gl_ModelViewProjectionMatrix * vec4(position, 1.0);\
    }\
  ', helperFunctions + '\
    varying vec3 position;\
    void main() {\
      gl_FragColor = vec4(getWallColor(position), 1.0); \
      vec4 info = texture2D(water, position.xz * 0.5 + 0.5);\
      if (position.y < info.r) {\
        gl_FragColor.rgb *= underwaterColor * 1.2;\
      }\
    }\
');
  
  this.sphereCenter = new GL.Vector();
  this.sphereRadius = 0;
  this.sphereCenter2 = new GL.Vector();
  this.sphereRadius2 = 0;
  
  var hasDerivatives = !!gl.getExtension('OES_standard_derivatives');
  this.causticsShader = new GL.Shader(helperFunctions + '\
    varying vec3 oldPos;\
    varying vec3 newPos;\
    varying vec3 ray;\
    \
    /* project the ray onto the plane */\
    vec3 project(vec3 origin, vec3 ray, vec3 refractedLight) {\
      vec2 tcube = intersectCube(origin, ray, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));\
      origin += ray * tcube.y;\
      float tplane = (-origin.y - 1.0) / refractedLight.y;\
      return origin + refractedLight * tplane;\
    }\
    \
    void main() {\
      vec4 info = texture2D(water, gl_Vertex.xy * 0.5 + 0.5);\
      info.ba *= 0.5;\
      vec3 normal = vec3(info.b, sqrt(1.0 - dot(info.ba, info.ba)), info.a);\
      \
      /* project the vertices along the refracted vertex ray */\
      vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);\
      ray = refract(-light, normal, IOR_AIR / IOR_WATER);\
      oldPos = project(gl_Vertex.xzy, refractedLight, refractedLight);\
      newPos = project(gl_Vertex.xzy + vec3(0.0, info.r, 0.0), ray, refractedLight);\
      \
      gl_Position = vec4(0.75 * (newPos.xz + refractedLight.xz / refractedLight.y), 0.0, 1.0);\
    }\
  ', (hasDerivatives ? '#extension GL_OES_standard_derivatives : enable\n' : '') + '\
    ' + helperFunctions + '\
    varying vec3 oldPos;\
    varying vec3 newPos;\
    varying vec3 ray;\
    \
    void main() {\
      ' + (hasDerivatives ? '\
        /* if the triangle gets smaller, it gets brighter, and vice versa */\
        float oldArea = length(dFdx(oldPos)) * length(dFdy(oldPos));\
        float newArea = length(dFdx(newPos)) * length(dFdy(newPos));\
        gl_FragColor = vec4(oldArea / newArea * 0.2, 1.0, 0.0, 0.0);\
      ' : '\
        gl_FragColor = vec4(0.2, 0.2, 0.0, 0.0);\
      ' ) + '\
      \
      vec3 refractedLight = refract(-light, vec3(0.0, 1.0, 0.0), IOR_AIR / IOR_WATER);\
      \
      /* compute a blob shadow and make sure we only draw a shadow if the player is blocking the light */\
      vec3 dir = (sphereCenter - newPos) / sphereRadius;\
      vec3 area = cross(dir, refractedLight);\
      float shadow = dot(area, area);\
      float dist = dot(dir, -refractedLight);\
      shadow = 1.0 + (shadow - 1.0) / (0.05 + dist * 0.025);\
      shadow = clamp(1.0 / (1.0 + exp(-shadow)), 0.0, 1.0);\
      shadow = mix(1.0, shadow, clamp(dist * 2.0, 0.0, 1.0));\
      \
      vec3 dir2 = (sphereCenter2 - newPos) / sphereRadius2;\
      vec3 area2 = cross(dir2, refractedLight);\
      float shadow2 = dot(area2, area2);\
      float dist2 = dot(dir2, -refractedLight);\
      shadow2 = 1.0 + (shadow2 - 1.0) / (0.05 + dist2 * 0.025);\
      shadow2 = clamp(1.0 / (1.0 + exp(-shadow2)), 0.0, 1.0);\
      shadow2 = mix(1.0, shadow2, clamp(dist * 2.0, 0.0, 1.0));\
      \
      gl_FragColor.g = min(shadow, shadow2); \
      \
      /* shadow for the rim of the pool */\
      vec2 t = intersectCube(newPos, -refractedLight, vec3(-1.0, -poolHeight, -1.0), vec3(1.0, 2.0, 1.0));\
      gl_FragColor.r *= 1.0 / (1.0 + exp(-200.0 / (1.0 + 10.0 * (t.y - t.x)) * (newPos.y - refractedLight.y * t.y - 2.0 / 12.0))); \
    }\
  ');
}

Renderer.prototype.updateCaustics = function(water) {
  if (!this.causticsShader) return;
  var this_ = this;
  this.causticTex.drawTo(function() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    water.textureA.bind(0);
    this_.causticsShader.uniforms({
      light: this_.lightDir,
      water: 0,
      sphereCenter: this_.sphereCenter,
      sphereRadius: this_.sphereRadius,
      sphereCenter2: this_.sphereCenter2,
      sphereRadius2: this_.sphereRadius2 
    }).draw(this_.waterMesh);
  });
};

Renderer.prototype.renderWater = function(water, sky, showPEC) {
  var tracer = new GL.Raytracer();
  
  water.textureA.bind(0);
  sky.bind(2);
  this.causticTex.bind(3);
  this.tileTexture.bind(1);
  water.textureC.bind(4);
  water.textureG.bind(5);

  gl.enable(gl.CULL_FACE);
  for (var i = 0; i < 2; i++) {
    gl.cullFace(i ? gl.BACK : gl.FRONT);
    this.waterShaders[i].uniforms({
      light: this.lightDir,
      water: 0,
      tiles: 1,
      sky: 2,
      causticTex: 3,
      peclayout: 4,
      dielectricLayout: 5,
      eye: tracer.eye,
      sphereCenter: this.sphereCenter,
      sphereRadius: this.sphereRadius,
      sphereCenter2: this.sphereCenter2,
      sphereRadius2: this.sphereRadius2,
      colorSphere1: this.colorSphere1,
      colorSphere2: this.colorSphere2,
      showPEC: showPEC
    }).draw(this.waterMesh);
  }
  gl.disable(gl.CULL_FACE);
};

Renderer.prototype.renderSphere = function() {
  water.textureA.bind(0);
  this.causticTex.bind(1);
  this.sphereShader.uniforms({
    light: this.lightDir,
    water: 0,
    causticTex: 1,
    sphereCenter: this.sphereCenter,
    sphereRadius: this.sphereRadius,
    colorSphere1: this.colorSphere1
  }).draw(this.sphereMesh);
};

Renderer.prototype.renderSphere2 = function() {
  water.textureA.bind(0);
  this.causticTex.bind(1);
  this.sphere2Shader.uniforms({
    light: this.lightDir,
    water: 0,
    causticTex: 1,
    sphereCenter: this.sphereCenter,
    sphereRadius: this.sphereRadius,
    colorSphere1: this.colorSphere1,
    sphereCenter2: this.sphereCenter2,
    sphereRadius2: this.sphereRadius2,
    colorSphere2: this.colorSphere2
  }).draw(this.sphereMesh2);
};

Renderer.prototype.renderCube = function() {
  gl.enable(gl.CULL_FACE);
  water.textureA.bind(0);
  this.tileTexture.bind(1);
  this.causticTex.bind(2);
  this.cubeShader.uniforms({
    light: this.lightDir,
    water: 0,
    tiles: 1,
    causticTex: 2,
    sphereCenter: this.sphereCenter,
    sphereRadius: this.sphereRadius,
      sphereCenter2: this.sphereCenter2,
      sphereRadius2: this.sphereRadius2
  }).draw(this.cubeMesh);
  gl.disable(gl.CULL_FACE);
};

