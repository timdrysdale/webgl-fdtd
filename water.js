/*
 * WebGL Radio
 * Tim Drysdale 2016 
 *
 *
 * Adapted from:
 *
 * WebGL Water
 * http://madebyevan.com/webgl-water/
 *
 * Copyright 2011 Evan Wallace
 * Released under the MIT license
 */

// The data in the texture is (position.y, velocity.y, normal.x, normal.z)
/*
 * There are four ping-pong buffers, A-B, and C-D, E-F, G-H
 * A is where stuff is kept in such a way that the rest of the rendering tool
 * does not know we now do radio and not water
 * A.r position.y 
 * A.g velocity.y - no longer used, leaving it alone doesn't seem to hurt.
 * A.r normal.x - calculated from A.r and essential to the rendering
 * A.a normal.z - calculated from A.r and essential to the rendering
 *
 * We keep the stuff in C that we want to use in the simulation
 * So we bind to texture C and write to texture D as follows 
 *
 * 1. info on the position of the sphere (sphereShader)
 * 2. info on water drops added (dropShader)
 * 
 * C.r Ez
 * C.g Hx
 * C.b Hy
 * C.a PEC value (0.0 for PEC, 1.0 for normal)
 *
 * E is same as C, but only contains the three field values (check)
 *
 * F.r source amplitude
 * F.g source phase (not currently working)
 * F.b dielectric value
 * F.a not used
 *
 * We do calculations on C (waterUpdateShader or radioUpdateShader)
 * 
 * We use the transferShader to transfer the field parameters in C.r, C.g into A.r, A.g perhaps
 * scaled or otherwise modified (we could add a log function here later for
 * extra dynamic range
 *
 * To do: 
 *  
 *  @   check: can textures be rectangular not square (need this for efficient TF/SF 1D sims)
 *      descr: i.e. can we have a non-square radio mesh?
 *      descr: also need this for efficient TF/SF 1D sims, which will need a 4xN texture
 * 
 *  
 *  @  check:  textures need not be the same size as the mesh?
 *   impacts:  using a compact texture to represent sources as pos.x, pos.y, freq, phase 
 *     descr:  note that only have four channels in a texture so can't do x,y,freq, |I|, |Q|
 *     descr:  may want to show that different frequency waves do not interfere
 *
 *
 *
 *
 *  @ feature: parabolic reflector
 *
 *  @ feature: lenses, convex and concave
 *
 *  @ feature: mechanism to control which toys are present, and where they can go when you don't want them
 *      descr: ideally want them off screen to avoid confusing people (tick boxes on right side of frame?)
 *
 *  @ feature: TF/SF souce for scattering
 *      descr: since needs associated 1D sims, probably pretty resource heavy
 *      descr: due to context switching - would need an additional shader
 *      descr: but the 4off 1D sims could be adjacent lines in a (2^2)x(2^N) texture
 *      descr: where the length is chosen to be larger than the longest side of the TF/SF
 *
 *
 *  @ feature: sources - touches to produce a Gaussian or Ricker wavelet rather than just an impulse       
 *
 *  @ feature: cube obstable
 * 
 *  @ feature: waveguide obstacle
 *
 *  @ feature: grating obstacle
 *
 *  @ feature: beam steerer / prism (non-inuitive bend, can't do with water, probably needs TFSF feature) 
 * 
 *  @ feature: closed end waveguide feed 
 * 
 *
 *  @ feature: ability to reload previously converged simulations
 *
 *  @ feature: bull's eye antenna (combines other features: waveguide, grating)  
 *
 *
 *  @ feature: rainbow colouring where the colour is based on spectrum present at that point
 *      descr: resource heavy feature, but would be amazing for the prism....! 
 *
 *
 *  @ feature: logarithmic field calculation in transfer shader
 *
 *   
 *  @ feature: keys to toggle or select which field is being displayed, with colour change
 *     action: pass uniform to the transfer shader so as to select different field
 *     action: update uniform which is the water colour 
 *
 *  
 *  @  modify: titles and description on the right hand side.
 *
 *     
 *  Done
 *
 *  # feature: field reset with R key
 *     action: needs to act on the actual field
 *      descr: resetShader called in main.js update()  
 *  
 *  #  check: whether the rest of the rendering system using A.g
 *    action: remove the transfer of C.g to A.g in update shader
 *    result: no change to behaviour observed
 *   implies:  A.g is unused in renderer; can be used in the update if needed, e.g. for decoupling sources
 *  
 *  #  check: whether the texture bind helper actually uses the unit-to-bind-to argument?
 *    action: twiddle the order of binding commands to see if this governs which texture binds to which unit 
 *    result: yes the order matters
 *   implies: don't bother putting an argument in the code, just confuses the issue
 *
 *  @   check: can javascript update uniforms between frames?
 *    impacts: sources could use uniforms for their unchanging bits, that are occasionally changed by user
 *      descr: yes uniforms are updated, e.g. sources, PEC location, frequency, amplitude etc.
 *
 *  @   check: can you write back to the same texture in a shader? 
 *    impacts: sources texture needs ping ponging?
 *      descr: nope, you cannot. But you can ping pong. And that works well.
 *
 *  @ feature: absorbing boundary conditions (try on water first)
 *      descr: Mur2 was unstable (implementation error presumably, rather than a precision issue?)
 *      descr: Mur1 implemented and ok except doesn't like metal near it and goes unstable occassionally
 *      descr: did not implement for water. would have had to work it out... :-)
 *
 *  @ feature: dielectrics, e.g. for cloaking
 *      descr: added - uses separate texture; must (re)set the texture to 1.0 at startup or else no water!   
 * 
 *  @ feature: frequency control over monochromatic source 
 *      descr: added, useful range appears 0.1 - 2.0 relative units
 *
 *  @ feature: implement basic 2D equations, const time step/setInterval if needed
 *      descr: done for TM as most recognisable (symmetric wave)
 *      descr: TE attempted but in parlous, unusable state - will have wrong indices for sure
 *
 *  @  modify: remove tiles
 *      descr: keep tiles! Gives nice impression (and pool looks 'empty' anyway) 
 * 
 *  @ feature: ramp for monochromatic source
 *      descr: modified this to always starting a source at phase = 0; allows a short pulse
 * 
 *  @resource: calculate backgrounds with smooth colour mapping for TVR-like wave effect 
 *      descr: not needed, keeping the water look for beauty 
 *
 *  @ feature: ability to switch between TE and TM simulations 
 *      descr: probably do this by calling either TE or TM shaders via water.js functions, 
 *      descr: chosen via parameter passed to stepSimulation
 *      descr: Done, but should be removed because TE sim not in a good state!
 *
 *  @ feature: ability to switch between radio mode and water mode (including the way things are rendered) with a key
 *      descr: likely to want to compare water and radio waves at various points, perhaps with same toys
 *      descr: this would require the toys to be implemented for water as well
 *      descr: how will the phased array linear source be implemented for water? Just the same?? See texture Channel mod
 *      descr: for sources - we would have to abstract out the field equations so that appropriate magnitudes were supplied
 *      descr: in each case
 *      descr: would the linear array be a series of hour-glasses that move up and down - the idea being that the diamater
 *      descr: is analogous to the magnitude of the signal being applied (but still apply the signal at a point?)
 *      descr: would this linear array have a plane wave mode, AND a point source array mode? Because the 3D structures
 *      descr: would be much larger than the spacing between grid points, and a plane wave is high priority for clarity
 *      descr: in understanding what is going on
 *      descr: need a visual cue for which is which : perhaps this is best achieved with two separate web-apps?
 *      descr: except radio will denial-of-service the water app if setInterval is used!
 *      descr: also possible confusion over wavelengths - except c vs v means f can be chosen so that they are similar.
 *      descr: DECISION: no. Would enforce compromises on the Emag side by limiting feature set to those shareable between each mode 
 *  
 *  @ feature: for radio-mode, colour contour map instead of caustics, and fixed in place 1:1 under the radio mesh
 *      descr: the water stays, so this is not needed. The caustics are prettier (and more mind blowing)       
 *  
 *  @ feature: convergence calculation for monochromatic source
 *      descr: not needed, likely to go unstable due to oblique incidence fields on boundary conditions 
 *      descr: which arises from small play space pushing things to edges.
 *  
 *  @ feature: plane wave sources
 *      descr: done, odd persistance issue around using texture for defining sources (faster source update than pushing to GPU 
 *      descr: a list of sources though. So no phase offsets. Probably a difficult concept for the audience anyway, better
 *      descr: if move the endpoints of the plane wave source instead. Little bouys to mark the ends?
 *
 *  @ feature: overwrite the gravity mode to move toys vertically into a fixed altitude
 *      descr: toys to be centred on the water, but make it a one shot since there is no actual force acting
 *      descr: over a duration
 *      descr: DONE - note issue (solved) of balls blacking out was due to an uninitialised variable 
 *
 *  @  modify: add a texture channel for sources (all or, just those that have amplitude and phase)
 *      descr: probably still need an add-drop shader for the instantanous drops
 *      descr: or else we have to manage the state of whether drop has been applied or not 
 *      descr: and since it will only be applied once, we'd need ping pong source shader to 
 *      descr: to handle the write back to itself. But this would have the nice feature of
 *      descr: allowing all the fine tuning of how large a drop should be, relative to the
 *      descr: field magnitudes, to be tuned in the equations. 
 *      descr: useful feature if switching between water/radio context
 *      descr: Probably have a sin amplitude channel and cos amplitude channel, so we are calculating 
 *      descr: two real values, and possibly a phase increment channel, so we simply add to that each
 *      descr: Or could use the strength parameter to allow for this (i.e send different value to the different type of sims)
 *      descr: and then there are things to consider like soft/vs hard, and E vs H sources....
 *      descr: DONE - but not with phases, issues here to solve - water disappears if attempt to use uniform to set phase
 * 
 */

function Water() {


  var vertexShader = '\
    varying vec2 coord;\
    void main() {\
      coord = gl_Vertex.xy * 0.5 + 0.5;\
      gl_Position = vec4(gl_Vertex.xyz, 1.0);\
    }\
  ';
  this.plane = GL.Mesh.plane();
  if (!GL.Texture.canUseFloatingPointTextures()) {
    throw new Error('This demo requires the OES_texture_float extension');
  }
    var filter = GL.Texture.canUseFloatingPointLinearFiltering() ? gl.LINEAR : gl.NEAREST;
  this.textureA = new GL.Texture(256, 256, { type: gl.FLOAT, filter: filter });
  this.textureB = new GL.Texture(256, 256, { type: gl.FLOAT, filter: filter });
  this.textureC = new GL.Texture(256, 256, { type: gl.FLOAT, filter: filter });
  this.textureD = new GL.Texture(256, 256, { type: gl.FLOAT, filter: filter });
  this.textureE = new GL.Texture(256, 256, { type: gl.FLOAT, filter: filter }); 
  this.textureF = new GL.Texture(256, 256, { type: gl.FLOAT, filter: filter });
  this.textureG = new GL.Texture(256, 256, { type: gl.FLOAT, filter: filter }); 
  this.textureH = new GL.Texture(256, 256, { type: gl.FLOAT, filter: filter });


  
  /*
   * if ((!this.textureA.canDrawTo() || !this.textureB.canDrawTo()) && GL.Texture.canUseHalfFloatingPointTextures()) {
   * filter = GL.Texture.canUseHalfFloatingPointLinearFiltering() ? gl.LINEAR : gl.NEAREST;
   * this.textureA = new GL.Texture(256, 256, { type: gl.HALF_FLOAT_OES, filter: filter });
   * this.textureB = new GL.Texture(256, 256, { type: gl.HALF_FLOAT_OES, filter: filter });
   * this.textureC = new GL.Texture(256, 256, { type: gl.HALF_FLOAT_OES, filter: filter });
   * this.textureD = new GL.Texture(256, 256, { type: gl.HALF_FLOAT_OES, filter: filter });
   * this.textureE = new GL.Texture(256, 256, { type: gl.HALF_FLOAT_OES, filter: filter });
   * this.textureF = new GL.Texture(256, 256, { type: gl.HALF_FLOAT_OES, filter: filter })      
   * }
   */
    
  this.dropShader = new GL.Shader(vertexShader, '\
    const float PI = 3.141592653589793;\
    uniform sampler2D texture;\
    uniform vec2 center;\
    uniform float radius;\
    uniform float strength;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      /* add the drop to the height */\
      float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);\
      drop = 0.5 - cos(drop * PI) * 0.5;\
      info.r += drop * strength;\
      \
      gl_FragColor = info;\
    }\
');

 this.sourceShader =  new GL.Shader(vertexShader, '\
    const float PI = 3.141592653589793;\
    uniform sampler2D texture;\
    uniform vec2 center;\
    uniform float radius;\
    uniform float strength;\
    uniform float phase;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      /* add the drop to the height */\
      float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);\
      drop = 0.5 - cos(drop * PI) * 0.5;\
      info.r += drop * strength * sin(phase);\
      \
      gl_FragColor = info;\
    }\
');


 this.sourceShaderWriteSources =  new GL.Shader(vertexShader, '\
    const float PI = 3.141592653589793;\
    uniform sampler2D sources;\
    uniform vec2 center;\
    uniform float radius;\
    uniform float strength;\
    uniform float phase;\
    uniform float persist;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(sources, coord);\
      \
      /* add the drop to the height */\
      float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - coord) / radius);\
      drop = 0.5 - cos(drop * PI) * 0.5;\
      info.r *= persist;\
      info.r = max(info.r,drop * strength);\
      gl_FragColor = info;\
    }\
');
  
 this.sourceShaderApplySources =  new GL.Shader(vertexShader, '\
    const float PI = 3.141592653589793;\
    uniform sampler2D sources;\
    uniform sampler2D fields;\
    uniform float phase;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 source = texture2D(sources, coord);\
      vec4 field =  texture2D(fields, coord);\
      \
      field.r += source.r * sin(phase);\
      \
      gl_FragColor = field;\
    }\
');
 
  
    
  this.resetShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      /* zero all the fields */\
      /* this works for water AND (hopefully) radio */\
      info.r = 0.0;\
      info.g = 0.0;\
      info.b = 0.0;\
      \
      gl_FragColor = info;\
    }\
');

  this.resetShaderDielectric = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      /* zero all the fields */\
      /* this works for water AND (hopefully) radio */\
      info.b = 1.0;\
      \
      gl_FragColor = info;\
    }\
');
  

  /*
   * We keep the updateShader for diagnostic purposes, but rename it waterUpdateShader
   */
    
  this.waterUpdateShader = new GL.Shader(vertexShader, '\
    uniform sampler2D tex0;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(tex0, coord);\
      \
      /* calculate average neighbor height */\
      vec2 dx = vec2(delta.x, 0.0);\
      vec2 dy = vec2(0.0, delta.y);\
      float average = (\
        texture2D(tex0, coord - dx).r +\
        texture2D(tex0, coord - dy).r +\
        texture2D(tex0, coord + dx).r +\
        texture2D(tex0, coord + dy).r\
      ) * 0.25;\
      \
      /* change the velocity to move toward the average */\
      info.g += (average - info.r) * 2.0;\
      \
      /* attenuate the velocity a little so waves do not last forever */\
      info.g *= 0.995;\
      \
      /* move the vertex along the velocity */\
      info.r += info.g;\
      info.r *= info.a;\
      \
      gl_FragColor = info;\
    }\
');
    
  /*
   *  Radio wave version of the updateShader
   *  Red   has Ez
   *  Green has Hx
   *  Blue  has Hy
   *  Alpha has 0 for PEC, 1 for vacuum - could be overloaded with values >1 for dielectric?
   *  
   *  Note to get ⊙ change M-x describe-input-method to Tex, turn on C-\ and type \odot 
   *  
   *  Here's a grid showing the (X,Y) coordinates in text-book-space
   * 
   *  |¯¯¯¯¯¯¯¯¯|¯¯¯¯¯¯¯¯¯|¯¯¯¯¯¯¯¯¯| 
   *  |→Hx  0,2 |→Hx  1,2 |→Hx  2,2 |
   *  |         |         |         |
   *  |⊙Ez ↑Hy  |⊙Ez ↑Hy  |⊙Ez ↑Hy  |
   *  |¯¯¯¯¯¯¯¯¯|¯¯¯¯¯¯¯¯¯|¯¯¯¯¯¯¯¯¯| 
   *  |→Hx  0,1 |→Hx  1,1 |→Hx  2,1 |
   *  |         |         |         |
   *  |⊙Ez ↑Hy  |⊙Ez ↑Hy  |⊙Ez ↑Hy  |
   *  |¯¯¯¯¯¯¯¯¯|¯¯¯¯¯¯¯¯¯|¯¯¯¯¯¯¯¯¯| 
   *  |→Hx  0,0 |→Hx  1,0 |→Hx  2,0 |
   *  |         |         |         |
   *  |⊙Ez ↑Hy  |⊙Ez ↑Hy  |⊙Ez ↑Hy  |
   *   ¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯¯     
   *     
   *   The update equation in pseudo-code is
   *   EzNew[1,1] += Coeff * (Hx(1,0) - Hx(1,1) + Hy(1,1) - Hy(0,1))
   *  
   */

    /*
 * Cdtds = 1/ (2**0.5); #Courant number
 * imp0 = 377.0; #impedance
 * 
 * chxh = 1.0;
 * chxe = Cdtds / imp0;
 * chyh = 1.0;
 * chye = Cdtds / imp0;
 * ceze = 1.0;
 * cezh = Cdtds * imp0;
 *  Hx[t+1,1:-1, 0:-1] = Hx[t,1:-1, 0:-1] - (+Ez[t,1:-1, 1:]  - Ez[t,1:-1, 0:-1]) * chxe;
 * Hy[t+1,0:-1, 1:-1] = Hy[t,0:-1, 1:-1] - (+Ez[t,0:-1, 1:-1]- Ez[t,1:, 1:-1]) * chye;
 *
 * curlH = (Hy[t+1,1:-1,1:-1] - Hy[t+1,0:-2,1:-1]) - (Hx[t+1,1:-1,1:-1] - Hx[t+1,1:-1,0:-2])
 * Ez[t+1,1:-1,1:-1] = Ez[t,1:-1,1:-1] + cezh *curlH;
 * 
 * Ez[t+1,sx,sy] = np.exp(-(t-30.) * (t-30.)/100.)
 */
    this.radioEUpdateShader = new GL.Shader(vertexShader, '\
    uniform float chxh;\
    uniform float chxe;\
    uniform float chyh;\
    uniform float chye;\
    uniform float ceze;\
    uniform float cezh;\
    uniform sampler2D tex0;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(tex0, coord);\
      \
      vec2 dx = vec2(delta.x, 0.0);\
      vec2 dy = vec2(0.0, delta.y);\
      \
      /* calculate curl of H */\
      float curlH = (\
        texture2D(tex0, coord).b - texture2D(tex0, coord-dx).b -\
        ( texture2D(tex0, coord).g - texture2D(tex0, coord-dy).g));\
      \
      /* update the E field */\
      info.r += cezh * curlH;\
      info.r *= info.a;\
      info.r *= 0.995; /* some cheeky loss */\
      \
      gl_FragColor = info;\
    }\
');

      this.radioHUpdateShaderAltPol = new GL.Shader(vertexShader, '\
    uniform float che;\
    uniform float ceh;\
    uniform sampler2D tex0;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(tex0, coord);\
      \
      vec2 dx = vec2(delta.x, 0.0);\
      vec2 dy = vec2(0.0, delta.y);\
      \
      /* calculate curl of E */\
      float curlE = (\
        texture2D(tex0, coord).g - texture2D(tex0, coord-dy).g -\
        ( texture2D(tex0, coord).b - texture2D(tex0, coord-dx).b));\
      \
      /* update the H field */\
      info.r += che * curlE;\
      /*info.r *= info.a;*/\
      /*info.r *= 0.995;*/ /* some cheeky loss */\
      \
      gl_FragColor = info;\
    }\
');

  this.radioEUpdateShaderAltPol = new GL.Shader(vertexShader, '\
    uniform float che;\
    uniform float ceh;\
    uniform sampler2D tex0;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(tex0, coord);\
      \
      vec2 dx = vec2(delta.x, 0.0);\
      vec2 dy = vec2(0.0, delta.y);\
      \
      float curlHforEx = (\
        texture2D(tex0, coord).r-\
        texture2D(tex0, coord+dy).r\
      );\
      \
      info.g += ceh * curlHforEx;\
      \
      float curlHforEy = (\
        texture2D(tex0, coord+dx).r-\
        texture2D(tex0, coord).r\
      );\
      \
      info.b += ceh * curlHforEy;\
      \
      gl_FragColor = info;\
    }\
');



    this.radioEUpdateShaderMur1 = new GL.Shader(vertexShader, '\
    precision highp float;\
    uniform float che;\
    uniform float ceh;\
    uniform float mur1;\
    uniform sampler2D tex0;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(tex0, coord);\
      \
      vec2 dx = vec2(delta.x, 0.0);\
      vec2 dy = vec2(0.0, delta.y);\
      \
      /* calculate curl of H */\
      float curlH = (\
        texture2D(tex0, coord).b - texture2D(tex0, coord-dx).b -\
        ( texture2D(tex0, coord).g - texture2D(tex0, coord-dy).g));\
      \
      /* update the E field */\
      info.r += ceh * curlH;\
      info.r *= info.a;\
      info.r *= 1.0; /* not some cheeky loss */\
      \
      \
      if (coord.x < delta.x){\
         if ((coord.y >= delta.y) && (coord.y <= (1.0-delta.y))){\
           float innerCurlH = (\
           texture2D(tex0, coord+dx+dx).b - texture2D(tex0, coord+dx).b -\
           ( texture2D(tex0, coord+dx+dx).g - texture2D(tex0, coord+dx-dy+dx).g));\
           float newInnerE = texture2D(tex0, coord + dx).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord+dx).r +(newInnerE - info.r)*mur1;\
      }}\
      if (coord.x > (1.0 -2.0* delta.x)){\
         if ((coord.y >= delta.y) && (coord.y <= (1.0-delta.y))){\
           float innerCurlH = (\
           texture2D(tex0, coord-dx-dx).b - texture2D(tex0, coord-dx-dx-dx).b -\
           ( texture2D(tex0, coord-dx-dx).g - texture2D(tex0, coord-dx-dy-dx).g));\
           float newInnerE = texture2D(tex0, coord-dx).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord-dx).r +(newInnerE - info.r)*mur1;\
      }}\
      if (coord.y < delta.y){\
         if ((coord.x >= delta.x) && (coord.x <= (1.0-delta.x))){\
           float innerCurlH = (\
           texture2D(tex0, coord+dy+dy).b - texture2D(tex0, coord-dx+dy+dy).b -\
           ( texture2D(tex0, coord+dy+dy).g - texture2D(tex0, coord+dy).g));\
           float newInnerE = texture2D(tex0, coord + dy).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord+dy).r +(newInnerE - info.r)*mur1;\
      }}\
      if (coord.y > (1.0- 2.0*delta.y)){\
         if ((coord.x >= delta.x) && (coord.x <= (1.0-delta.x))){\
           float innerCurlH = (\
           texture2D(tex0, coord-dy-dy).b - texture2D(tex0, coord-dx-dy-dy).b -\
           ( texture2D(tex0, coord-dy-dy).g - texture2D(tex0, coord-dy-dy-dy).g));\
           float newInnerE = texture2D(tex0, coord - dy).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord-dy).r +(newInnerE - info.r)*mur1;\
      }}\
      \
      \
      gl_FragColor = info;\
    }\
');


 this.radioEUpdateShaderMur2 = new GL.Shader(vertexShader, '\
    precision highp float;\
    uniform float che;\
    uniform float ceh;\
    uniform float mur1;\
    uniform float mur2a;\
    uniform float mur2b;\
    uniform float mur2c;\
    uniform sampler2D prev;\
    uniform sampler2D tex0;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(tex0, coord);\
      \
      vec2 dx = vec2(delta.x, 0.0);\
      vec2 dy = vec2(0.0, delta.y);\
      \
      /* calculate curl of H */\
      float curlH = (\
        texture2D(tex0, coord).b - texture2D(tex0, coord-dx).b -\
        ( texture2D(tex0, coord).g - texture2D(tex0, coord-dy).g));\
      \
      /* update the E field */\
      info.r += ceh * curlH;\
      info.r *= info.a;\
      info.r *= 0.990; /* 0.990 some cheeky loss to cover for the slighty bouncy BC*/\
      \
      \
      if (coord.x < delta.x){\
         if ((coord.y >= delta.y) && (coord.y <= (1.0-delta.y))){\
           float innerCurlH = (\
           texture2D(tex0, coord+dx+dx).b - texture2D(tex0, coord+dx).b -\
           ( texture2D(tex0, coord+dx+dx).g - texture2D(tex0, coord+dx-dy+dx).g));\
           float newInnerE = texture2D(tex0, coord + dx).r  + ceh * innerCurlH;\
           /*info.r = texture2D(tex0,coord+dx).r +(newInnerE - info.r)*mur1;*/\
           float Ea = newInnerE + texture2D(prev, coord+dx).r;\
           float Eb = texture2D(tex0, coord+dx).r + texture2D(tex0, coord + dx+dx).r;\
           float Ec = (       texture2D(tex0, coord+dy).r    - \
                          2.0*texture2D(tex0, coord+dx).r       + \
                              texture2D(tex0, coord-dy).r    + \
                              texture2D(tex0, coord+dx+dy).r - \
                          2.0*texture2D(tex0, coord+dx).r    + \
                              texture2D(tex0, coord+dx-dy).r); \
           info.r = -1.0 * texture2D(prev, coord+dx+dx).r - mur2a*Ea + mur2b*Eb + mur2c*Ec;\
      \
      }}\
      if (coord.x > (1.0 -2.0* delta.x)){\
         if ((coord.y >= delta.y) && (coord.y <= (1.0-delta.y))){\
           float innerCurlH = (\
           texture2D(tex0, coord-dx-dx).b - texture2D(tex0, coord-dx-dx-dx).b -\
           ( texture2D(tex0, coord-dx-dx).g - texture2D(tex0, coord-dx-dy-dx).g));\
           float newInnerE = texture2D(tex0, coord-dx).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord-dx).r +(newInnerE - info.r)*mur1;\
      }}\
      if (coord.y < delta.y){\
         if ((coord.x >= delta.x) && (coord.x <= (1.0-delta.x))){\
           float innerCurlH = (\
           texture2D(tex0, coord+dy+dy).b - texture2D(tex0, coord-dx+dy+dy).b -\
           ( texture2D(tex0, coord+dy+dy).g - texture2D(tex0, coord+dy).g));\
           float newInnerE = texture2D(tex0, coord + dy).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord+dy).r +(newInnerE - info.r)*mur1;\
      }}\
      if (coord.y > (1.0- 2.0*delta.y)){\
         if ((coord.x >= delta.x) && (coord.x <= (1.0-delta.x))){\
           float innerCurlH = (\
           texture2D(tex0, coord-dy-dy).b - texture2D(tex0, coord-dx-dy-dy).b -\
           ( texture2D(tex0, coord-dy-dy).g - texture2D(tex0, coord-dy-dy-dy).g));\
           float newInnerE = texture2D(tex0, coord - dy).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord-dy).r +(newInnerE - info.r)*mur1;\
      }}\
      \
      \
      gl_FragColor = info;\
    }\
');    

this.radioEUpdateShaderDielectric = new GL.Shader(vertexShader, '\
    precision highp float;\
    uniform float che;\
    uniform float ceh;\
    uniform float mur1;\
    uniform float mur2a;\
    uniform float mur2b;\
    uniform float mur2c;\
    uniform sampler2D prev;\
    uniform sampler2D tex0;\
    uniform sampler2D aux;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(tex0, coord);\
      float dielectric = texture2D(aux, coord).b;\
      \
      vec2 dx = vec2(delta.x, 0.0);\
      vec2 dy = vec2(0.0, delta.y);\
      \
      /* calculate curl of H */\
      float curlH = (\
        texture2D(tex0, coord).b - texture2D(tex0, coord-dx).b -\
        ( texture2D(tex0, coord).g - texture2D(tex0, coord-dy).g));\
      \
      /* update the E field */\
      info.r += ceh * curlH / dielectric;\
      info.r *= info.a;\
      info.r *= 0.990; /* 0.990 some cheeky loss to cover for the slighty bouncy BC*/\
      \
      \
      \
      if (coord.x < delta.x){\
         if ((coord.y >= delta.y) && (coord.y <= (1.0-delta.y))){\
           float innerCurlH = (\
           texture2D(tex0, coord+dx+dx).b - texture2D(tex0, coord+dx).b -\
           ( texture2D(tex0, coord+dx+dx).g - texture2D(tex0, coord+dx-dy+dx).g));\
           float newInnerE = texture2D(tex0, coord + dx).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord+dx).r +(newInnerE - info.r)*mur1;\
      }}\
      if (coord.x > (1.0 -2.0* delta.x)){\
         if ((coord.y >= delta.y) && (coord.y <= (1.0-delta.y))){\
           float innerCurlH = (\
           texture2D(tex0, coord-dx-dx).b - texture2D(tex0, coord-dx-dx-dx).b -\
           ( texture2D(tex0, coord-dx-dx).g - texture2D(tex0, coord-dx-dy-dx).g));\
           float newInnerE = texture2D(tex0, coord-dx).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord-dx).r +(newInnerE - info.r)*mur1;\
      }}\
      if (coord.y < delta.y){\
         if ((coord.x >= delta.x) && (coord.x <= (1.0-delta.x))){\
           float innerCurlH = (\
           texture2D(tex0, coord+dy+dy).b - texture2D(tex0, coord-dx+dy+dy).b -\
           ( texture2D(tex0, coord+dy+dy).g - texture2D(tex0, coord+dy).g));\
           float newInnerE = texture2D(tex0, coord + dy).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord+dy).r +(newInnerE - info.r)*mur1;\
      }}\
      if (coord.y > (1.0- 2.0*delta.y)){\
         if ((coord.x >= delta.x) && (coord.x <= (1.0-delta.x))){\
           float innerCurlH = (\
           texture2D(tex0, coord-dy-dy).b - texture2D(tex0, coord-dx-dy-dy).b -\
           ( texture2D(tex0, coord-dy-dy).g - texture2D(tex0, coord-dy-dy-dy).g));\
           float newInnerE = texture2D(tex0, coord - dy).r  + ceh * innerCurlH;\
           info.r = texture2D(tex0,coord-dy).r +(newInnerE - info.r)*mur1;\
      }}\
      \
      \
      gl_FragColor = info;\
    }\
');    
  
    /*
           float Ea = newInnerE + texture2D(prev, coord).r;\
           float Eb = texture2D(tex0, coord).r + texture2D(tex0, coord + dy).r;\
           float Ec = (       texture2D(tex0, coord+dy).r    - \
                          2.0*texture2D(tex0, coord).r       + \
                              texture2D(tex0, coord-dy).r    + \
                              texture2D(tex0, coord+dx+dy).r - \
                          2.0*texture2D(tex0, coord+dx).r    + \
                              texture2D(tex0, coord+dx-dy).r); \
      \
            info.r = -1 * texture2D(prev, coord+dx) - mur2a*Ea + mur2b*Eb + mur2c*Ec;\

*/



  this.radioHUpdateShader = new GL.Shader(vertexShader, '\
    uniform float chxh;\
    uniform float chxe;\
    uniform float chyh;\
    uniform float chye;\
    uniform float ceze;\
    uniform float cezh;\
    uniform sampler2D tex0;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(tex0, coord);\
      \
      vec2 dx = vec2(delta.x, 0.0);\
      vec2 dy = vec2(0.0, delta.y);\
      \
      float curlEforHx = (\
        texture2D(tex0, coord+dy).r -\
        texture2D(tex0, coord).r\
      );\
      \
      info.g -= chxe * curlEforHx;\
      \
      float curlEforHy = (\
        texture2D(tex0, coord).r -\
        texture2D(tex0, coord+dx).r\
      );\
      \
      info.b -= chye * curlEforHy;\
      \
      gl_FragColor = info;\
    }\
');

/*
 * Cdtds = 1/ (2**0.5); #Courant number
 * imp0 = 377.0; #impedance
 * 
 * chxh = 1.0;
 * chxe = Cdtds / imp0;
 * chyh = 1.0;
 * chye = Cdtds / imp0;
 * ceze = 1.0;
 * cezh = Cdtds * imp0;
 *  Hx[t+1,1:-1, 0:-1] = Hx[t,1:-1, 0:-1] - (+Ez[t,1:-1, 1:]  - Ez[t,1:-1, 0:-1]) * chxe;
 * Hy[t+1,0:-1, 1:-1] = Hy[t,0:-1, 1:-1] - (+Ez[t,0:-1, 1:-1]- Ez[t,1:, 1:-1]) * chye;
 *
 * curlH = (Hy[t+1,1:-1,1:-1] - Hy[t+1,0:-2,1:-1]) - (Hx[t+1,1:-1,1:-1] - Hx[t+1,1:-1,0:-2])
 * Ez[t+1,1:-1,1:-1] = Ez[t,1:-1,1:-1] + cezh *curlH;
 * 
 * Ez[t+1,sx,sy] = np.exp(-(t-30.) * (t-30.)/100.)
 */
    
this.transferShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texA;\
    uniform sampler2D texC;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texA, coord);\
      vec4 newpos = texture2D(texC, coord);\
      \
      /* set mesh height in A.r via calculation on field property from C */\
      /* here, direct copy of the C.r, since still water sim */\
      info.r = newpos.r;\
      \
      gl_FragColor = info;\
    }\
');

this.transferShaderChoice = new GL.Shader(vertexShader, '\
    uniform sampler2D texA;\
    uniform sampler2D texC;\
    uniform float choice;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texA, coord);\
      vec4 newpos = texture2D(texC, coord);\
      \
      /* set mesh height in A.r via calculation on field property from C */\
      /* here, direct copy of the C.r, since still water sim */\
      info.r = newpos.r;\
      if (choice == 1.0) info.r = newpos.g / 377.0;\
      if (choice == 2.0) info.r = newpos.b / 377.0;\
      \
      gl_FragColor = info;\
    }\
');
  
this.jiggleShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texA;\
    uniform sampler2D texC;\
    uniform float jiggle;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texA, coord);\
      vec4 newpos = texture2D(texC, coord);\
      \
      /* set mesh height in A.r via calculation on field property from C */\
      /* here, direct copy of the C.r, since still water sim */\
      /* add height of the jiggle */\
      info.r = newpos.r + jiggle;\
      \
      gl_FragColor = info;\
    }\
');
  
this.memoryShader = new GL.Shader(vertexShader, '\
    uniform sampler2D tex0;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 currentField = texture2D(tex0, coord);\
      \
      gl_FragColor = currentField;\
    }\
');


    
  this.normalShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    uniform vec2 delta;\
    varying vec2 coord;\
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      /* update the normal */\
      vec3 dx = vec3(delta.x, texture2D(texture, vec2(coord.x + delta.x, coord.y)).r - info.r, 0.0);\
      vec3 dy = vec3(0.0, texture2D(texture, vec2(coord.x, coord.y + delta.y)).r - info.r, delta.y);\
      info.ba = normalize(cross(dy, dx)).xz;\
      \
      gl_FragColor = info;\
    }\
');

  // set the texture to have no PEC initially
  this.initPECShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    varying vec2 coord;\
    \
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      info.a = 1.0;\
      gl_FragColor = info;\
    }\
  ')
  
 this.multiSphereShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    uniform vec3 oldCenter;\
    uniform vec3 newCenter;\
    uniform float oldRadius;\
    uniform float newRadius;\
    uniform float trailValue;\
    varying vec2 coord;\
    \
    float volumeInSphere(vec3 center, float radius) {\
      vec3 toCenter = vec3(coord.x * 2.0 - 1.0, 0.0, coord.y * 2.0 - 1.0) - center;\
      float t = length(toCenter) / radius;\
      float dy = exp(-pow(t * 1.5, 6.0));\
      float ymin = min(0.0, center.y - dy);\
      float ymax = min(max(0.0, center.y + dy), ymin + 2.0 * dy);\
      return (ymax - ymin) * 0.1;\
    }\
    \
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      if (volumeInSphere(oldCenter, oldRadius) > 1e-6) {\
        info.a = trailValue;\
      }\
      if (volumeInSphere(newCenter, newRadius) > 1e-6) {\
         info.a = trailValue;\
      }\
      gl_FragColor = info;\
    }\
  ');
  
 this.multiSphereShaderDielectric = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    uniform vec3 oldCenter;\
    uniform vec3 newCenter;\
    uniform float oldRadius;\
    uniform float newRadius;\
    uniform float trailValue;\
    varying vec2 coord;\
    \
    float volumeInSphere(vec3 center, float radius) {\
      vec3 toCenter = vec3(coord.x * 2.0 - 1.0, 0.0, coord.y * 2.0 - 1.0) - center;\
      float t = length(toCenter) / radius;\
      float dy = exp(-pow(t * 1.5, 6.0));\
      float ymin = min(0.0, center.y - dy);\
      float ymax = min(max(0.0, center.y + dy), ymin + 2.0 * dy);\
      return (ymax - ymin) * 0.1;\
    }\
    \
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      if (volumeInSphere(oldCenter, oldRadius) > 1e-6) {\
        info.b = trailValue;\
      }\
      if (volumeInSphere(newCenter, newRadius) > 1e-6) {\
         info.b = trailValue;\
      }\
      gl_FragColor = info;\
    }\
  ');

  this.sphereShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    uniform vec3 oldCenter;\
    uniform vec3 newCenter;\
    uniform float radius;\
    varying vec2 coord;\
    \
    float volumeInSphere(vec3 center) {\
      vec3 toCenter = vec3(coord.x * 2.0 - 1.0, 0.0, coord.y * 2.0 - 1.0) - center;\
      float t = length(toCenter) / radius;\
      float dy = exp(-pow(t * 1.5, 6.0));\
      float ymin = min(0.0, center.y - dy);\
      float ymax = min(max(0.0, center.y + dy), ymin + 2.0 * dy);\
      return (ymax - ymin) * 0.1;\
    }\
    \
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      if (volumeInSphere(newCenter) > 1e-6) {\
      info.a = 0.0;\
      }\
      else {\
      info.a = 1.0;\
      }\
      gl_FragColor = info;\
    }\
  ');

this.writePECShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    uniform float xmin;\
    uniform float xmax;\
    uniform float ymin;\
    uniform float ymax;\
    uniform float PEC;\
    varying vec2 coord;\
    \
    bool pointInQuad(float xmin, float xmax, float ymin, float ymax) {\
      bool inX = (((coord.x - xmin)>=0.0)&&((xmax - coord.x)>=0.0));\
      bool inY = (((coord.y - ymin)>=0.0)&&((ymax - coord.y)>=0.0));\
      return (inX && inY);\
    }\
    \
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      if (pointInQuad(xmin, xmax, ymin, ymax)) {\
        info.a = PEC; \
      }\
      gl_FragColor = info;\
    }\
');


this.writeDielectricShader = new GL.Shader(vertexShader, '\
    uniform sampler2D texture;\
    uniform float xmin;\
    uniform float xmax;\
    uniform float ymin;\
    uniform float ymax;\
    uniform float dielectric;\
    varying vec2 coord;\
    \
    bool pointInQuad(float xmin, float xmax, float ymin, float ymax) {\
      bool inX = (((coord.x - xmin)>=0.0)&&((xmax - coord.x)>=0.0));\
      bool inY = (((coord.y - ymin)>=0.0)&&((ymax - coord.y)>=0.0));\
      return (inX && inY);\
    }\
    \
    void main() {\
      /* get vertex info */\
      vec4 info = texture2D(texture, coord);\
      \
      if (pointInQuad(xmin, xmax, ymin, ymax)) {\
        info.b = dielectric; \
      }\
      gl_FragColor = info;\
    }\
  ');

  
}



Water.prototype.addDrop = function(x, y, radius, strength) {
  var this_ = this;
  this.textureD.drawTo(function() {
    this_.textureC.bind();
    this_.dropShader.uniforms({
      center: [x, y],
      radius: radius,
      strength: strength
    }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);
};

Water.prototype.updateSource = function(x, y, radius, strength, phase) {
  var this_ = this;
  this.textureD.drawTo(function() {
    this_.textureC.bind();
    this_.sourceShader.uniforms({
      center: [x, y],
      radius: radius,
        strength: strength,
        phase: phase 
    }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);
};


Water.prototype.updateSourcePersist = function(x, y, radius, strength, offset_phase, persist, current_phase) {
  var this_ = this;
  
  this.textureH.drawTo(function() {
    this_.textureG.bind();
    this_.sourceShaderWriteSources.uniforms({
      sources: 0,
      center: [x, y],
      radius: radius,
      strength: strength,
      phase: offset_phase,
      persist: persist
    }).draw(this_.plane);
  });
  this.textureH.swapWith(this.textureG);

  this.textureD.drawTo(function() {
    this_.textureG.bind(0);
    this_.textureC.bind(1);
    this_.sourceShaderApplySources.uniforms({
      sources: 0,
      fields: 1,
      phase: current_phase 
    }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);
  
};





Water.prototype.reset = function(reset) {
  var this_ = this;
  this.textureD.drawTo(function() {
    this_.textureC.bind();
      this_.resetShader.draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);
   
};

Water.prototype.resetDielectric = function(){
  var this_ = this;
  this.textureH.drawTo(function() {
    this_.textureG.bind();
      this_.resetShaderDielectric.draw(this_.plane);
  });
  this.textureH.swapWith(this.textureG);

}

Water.prototype.moveSphere = function(oldCenter, newCenter, oldRadius, newRadius, trailValue) {
  var this_ = this;
  this.textureD.drawTo(function() {
    this_.textureC.bind(0);
    this_.multiSphereShader.uniforms({
      texture: 0,
      oldCenter: oldCenter,
      newCenter: newCenter,
      oldRadius: oldRadius,
      newRadius: newRadius,
      trailValue: trailValue
      }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);
};

Water.prototype.moveSphereDielectric = function(oldCenter, newCenter, oldRadius, newRadius, dielectric) {
  var this_ = this;
  this.textureH.drawTo(function() {
    this_.textureG.bind(0);
    this_.multiSphereShaderDielectric.uniforms({
      texture: 0,
      oldCenter: oldCenter,
      newCenter: newCenter,
      oldRadius: oldRadius,
      newRadius: newRadius,
      trailValue: dielectric
      }).draw(this_.plane);
  });
  this.textureH.swapWith(this.textureG);
};

Water.prototype.initPEC = function() {
  var this_ = this;
  this.textureD.drawTo(function() {
    this_.textureC.bind();
    this_.initPECShader.uniforms({
    }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);
};

Water.prototype.writePEC = function(xmin, xmax, ymin, ymax, PEC) {
  var this_ = this;
  this.textureD.drawTo(function() {
    this_.textureC.bind();
    this_.writePECShader.uniforms({
      xmin: xmin,
      xmax: xmax,
      ymin: ymin,
      ymax: ymax,
      PEC: PEC
    }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);
};

Water.prototype.writeDielectric = function(xmin, xmax, ymin, ymax, dielectric) {
  var this_ = this;
  this.textureH.drawTo(function() {
    this_.textureG.bind();
    this_.writeDielectricShader.uniforms({
      xmin: xmin,
      xmax: xmax,
      ymin: ymin,
      ymax: ymax,
      dielectric: dielectric
    }).draw(this_.plane);
  });
  this.textureH.swapWith(this.textureG);
};

Water.prototype.stepHSimulationGoodPol = function() {
  var this_ = this;
  this.textureD.drawTo(function() {
      this_.textureC.bind();
          
    this_.radioHUpdateShader.uniforms({
        delta: [1 / this_.textureA.width, 1 / this_.textureA.height],
        chxh: chxh,
        chxe: chxe,
        chyh: chyh,
        chye: chye,
        ceze: ceze,
        cezh: cezh
    }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);
};


Water.prototype.stepESimulationOriginal = function() {
    var this_ = this;
    
  this.textureD.drawTo(function() {
      this_.textureC.bind();
          
    this_.radioEUpdateShader.uniforms({
        delta: [1 / this_.textureA.width, 1 / this_.textureA.height],
        chxh: chxh,
        chxe: chxe,
        chyh: chyh,
        chye: chye,
        ceze: ceze,
        cezh: cezh
    }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);

};

Water.prototype.stepESimulationGoodPol = function() {
    var this_ = this;
    
  this.textureD.drawTo(function() {
      this_.textureF.bind(); //doesn't like C before F. - can probably fix by adding uniforms as is done for renderer
      this_.textureC.bind();
      
    this_.radioEUpdateShaderMur2.uniforms({
        delta: [1 / this_.textureC.width, 1 / this_.textureC.height],
        che: che,
        ceh: ceh,
        mur1: mur1,
        mur2a: mur2a,
        mur2b: mur2b,
        mur2c: mur2c
      }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);

};


Water.prototype.stepESimulationGoodPolDielectric = function() {
    var this_ = this;
    
  this.textureD.drawTo(function() {
      this_.textureF.bind(0); //doesn't like C before F. - can probably fix by adding uniforms as is done for renderer
    this_.textureC.bind(1);
    this_.textureG.bind(2);
      
    this_.radioEUpdateShaderDielectric.uniforms({
        delta: [1 / this_.textureC.width, 1 / this_.textureC.height],
        prev:0,
        tex0:1,
        aux: 2,
        che: che,
        ceh: ceh,
        mur1: mur1,
        mur2a: mur2a,
        mur2b: mur2b,
        mur2c: mur2c
      }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);

};

Water.prototype.stepESimulationAltPol = function() {
    var this_ = this;
    
  this.textureD.drawTo(function() {
      //this_.textureF.bind(); //doesn't like C before F. - can probably fix by adding uniforms as is done for renderer
      this_.textureC.bind(0);
      
    this_.radioEUpdateShaderAltPol.uniforms({
      delta: [1 / this_.textureC.width, 1 / this_.textureC.height],
      tex0:0,
      che: che,
      ceh: ceh
    }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);

};


Water.prototype.stepHSimulationAltPol = function() {
  var this_ = this;
  this.textureD.drawTo(function() {
      this_.textureC.bind(0);
          
    this_.radioHUpdateShaderAltPol.uniforms({
      delta: [1 / this_.textureA.width, 1 / this_.textureA.height],
      tex0: 0,
      che: che,
      ceh: ceh
    }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);
};



Water.prototype.stepESimulationMur1 = function() {
    var this_ = this;
    
  this.textureD.drawTo(function() {
      this_.textureC.bind();
          
    this_.radioEUpdateShaderMur1.uniforms({
        delta: [1 / this_.textureA.width, 1 / this_.textureA.height],
        che: che,
        ceh: ceh,
        mur1: mur1
      }).draw(this_.plane);
  });
  this.textureD.swapWith(this.textureC);

};


Water.prototype.transferResults = function() {
  var this_ = this;
  this.textureB.drawTo(function() {
  this_.textureA.bind();
  this_.textureC.bind();
      
    this_.transferShader.uniforms({
      delta: [1 / this_.textureA.width, 1 / this_.textureA.height]
    }).draw(this_.plane);
  });
  this.textureB.swapWith(this.textureA);
};


Water.prototype.transferResultsChoice = function(choice) {
  var this_ = this;
  this.textureB.drawTo(function() {
  this_.textureA.bind();
  this_.textureC.bind();
      
    this_.transferShaderChoice.uniforms({
      delta: [1 / this_.textureA.width, 1 / this_.textureA.height],
      choice: choice
    }).draw(this_.plane);
  });
  this.textureB.swapWith(this.textureA);
};

Water.prototype.jiggleResults = function(jiggle) {
  var this_ = this;
  this.textureB.drawTo(function() {
  this_.textureA.bind();
  this_.textureC.bind();
      
    this_.jiggleShader.uniforms({
      delta: [1 / this_.textureA.width, 1 / this_.textureA.height],
      jiggle: jiggle
    }).draw(this_.plane);
  });
  this.textureB.swapWith(this.textureA);
};

Water.prototype.storeEfield = function() {
  var this_ = this;
  // data in F is two time steps behind the current update time step  
  // shift the previous fields from E to F
  this.textureF.drawTo(function() {
  this_.textureE.bind();
    this_.memoryShader.uniforms({
      delta: [1 / this_.textureE.width, 1 / this_.textureE.height]
    }).draw(this_.plane);
  });
  // copy the current fields from C to E 
  this.textureE.drawTo(function() {
  this_.textureC.bind();
    this_.memoryShader.uniforms({
      delta: [1 / this_.textureC.width, 1 / this_.textureC.height]
    }).draw(this_.plane);
  });
    

};

Water.prototype.updateNormals = function() {
  var this_ = this;
  this.textureB.drawTo(function() {
    this_.textureA.bind();
    this_.normalShader.uniforms({
      delta: [1 / this_.textureA.width, 1 / this_.textureA.height]
    }).draw(this_.plane);
  });
  this.textureB.swapWith(this.textureA);
};
