/* WebGL FDTD
 * Tim Drysdale 2016
 *
 * Adapted from
 * WebGL Water
 * http://madebyevan.com/webgl-water/
 *
 * Copyright 2011 Evan Wallace
 * Released under the MIT license
 */

function text2html(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function handleError(text) {
  var html = text2html(text);
  if (html == 'WebGL not supported') {
    html = 'Your browser does not support WebGL.<br>Please see\
    <a href="http://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">\
    Getting a WebGL Implementation</a>.';
  }
  var loading = document.getElementById('loading');
  loading.innerHTML = html;
  loading.style.zIndex = 1;
}

window.onerror = handleError;

var gl = GL.create();
var logUniforms = false;
var doGoodPol = true;
var water;
var cubemap;
var renderer;
var angleX = -25;
var angleY = -200.5;
var newSim = true;
var demoRunning = true;
var sourcex = 0.8;
var sourcez = 0.8;
var sourceStrength = 0.1;
var sourceStrengthReset = 0.01;
var sourceStrengthMin = 0.01;
var sourceStrengthMax = 2.0;
var sourceStrengthInc = 0.05;
var persistSources = 0.0; //0 for no persist, 1 for persist
var resetSource = false;
var turnOff = false;
var showPEC = 0.0; //make 1.0 to show PEC
var resultsMode = 0.0; //E field is 0.0, Hx is 1.0, Hy is 2.0
var demoState = 0;

// Sphere physics info
var useSpherePhysics = false;
var center;
var sphereHeight1 = -0.5;
var sphereHeight2 = -0.5;
var oldCenter;
var oldCenter2;
var oldRadius;
var oldRadius2;
var velocity;
var gravity;
var radius;
var resetRadius = 0.125; //added so that can recover when scale too small! TDD Aug 13
var minRadius = 0.001; //allow objects to be nearly killed, zero causes shadow artefacts - might need an object unkill!
var doWrite = false; //don't write with spheres until we say so!
var lineSourceSphereRadius = 0.05; //
var SPHERE_WRITE_PEC = 0.0;
var SPHERE_WRITE_DIELECTRIC = 1.0;
var SPHERE_MAKE_LINE_SOURCE = 2.0;
var joinMode = false;
var joinModeStart = false;
var joinModeStartingPosition;
var SPHERE_MAX_MODE_NUMBER = 2.0;
var sphereMode = 0.0;
var paused = false;
var phase = 0.0;  // added TDD 22 June 2016
var source = false; // added TDD 22 June 2016
var reset = false; // added TDD 22 June 2016 to support instant reset of the sim
var singleStep = false; // added TDD 22 June 2016 to support single stepping
var cleanGeometry = false;
var joinDirWrite = true;

/*
 * assume dx = 1
 * assume dt = 1
 * dx = lambda0/10
 * lambda0 = c/f
 * dx = c/(10*f)
 * C = 2 * c * dt / dx <= 1.0
 * hence (dt/dx) = 1/(2c) = 1.5e8
 *  
 */

var u0 = 4e-7 * Math.PI
var e0 = 8.854e-12
var c = 3e8
var f0 = 1e9
var lambda0 = c/ f0
var dx = lambda0 / 10 ;// was 5, but usually 10 - 20 is good
var dt = dx / c / Math.sqrt(2)
var ceh = dt / (u0 * dx)
var che = dt / (e0 * dx)

var dphase = 0.6 // 2 * Math.pi * dt * f0;  // added TDD 22 June 2016
var minDphase = 0.1
var maxDphase = 2.0
var incDphase = 0.005


var chxh = 1.0;
var chxe = che;
var chyh = 1.0;
var chye = che;
var ceze = 1.0;
var cezh = ceh;

var mur1 = (c * dt - dx) / (c * dt + dx)
var mur2a = (dx - c * dt)/(dx + c * dt)
var mur2b = 2*dx/(dx + c*dt)
var mur2c = dx*(c*dt)*(c*dt)/(2*dx*dx*(dx+c*dt))

var upWorld = new GL.Vector(0.0,1.0,1.0); //for scaling objects 

window.onload = function() {
  var ratio = window.devicePixelRatio || 1;
  var help = document.getElementById('help');

  function onresize() {
    var width = innerWidth - help.clientWidth - 20;
    var height = innerHeight;
    gl.canvas.width = width * ratio;
    gl.canvas.height = height * ratio;
    gl.canvas.style.width = width + 'px';
    gl.canvas.style.height = height + 'px';
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.matrixMode(gl.PROJECTION);
    gl.loadIdentity();
    gl.perspective(45, gl.canvas.width / gl.canvas.height, 0.01, 100);
    gl.matrixMode(gl.MODELVIEW);
    draw();
  }

  document.body.appendChild(gl.canvas);
  gl.clearColor(0, 0, 0, 1);

  water = new Water();
  renderer = new Renderer();
  cubemap = new Cubemap({
    xneg: document.getElementById('xneg'),
    xpos: document.getElementById('xpos'),
    yneg: document.getElementById('ypos'),
    ypos: document.getElementById('ypos'),
    zneg: document.getElementById('zneg'),
    zpos: document.getElementById('zpos')
  });

  if (!water.textureA.canDrawTo() || !water.textureB.canDrawTo()) {
    throw new Error('Rendering to floating-point textures is required but not supported');
  }

  center = oldCenter = new GL.Vector(-0.4, -0.5, 0.2);
  center2 = oldCenter2 = new GL.Vector(0.4, -0.5, 0.2);

  velocity = new GL.Vector();
  gravity = new GL.Vector(0, -4, 0);
  radius = oldRadius = resetRadius;
  radius2 = oldRadius2 = resetRadius;
  
  document.getElementById('loading').innerHTML = '';
  onresize();

  var requestAnimationFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    function(callback) { setTimeout(callback, 0); };

  var prevTime = new Date().getTime();
  function animate() {
    var nextTime = new Date().getTime();
    if (!paused || reset || singleStep) {  //added TDD to allow instant redraw if reset or singleStep
      update((nextTime - prevTime) / 1000);
      draw();
      if (reset) reset = false; //we only need to reset once
      if (singleStep) singleStep = false; //only step once per singleStep   
        
    }
    prevTime = nextTime;
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  window.onresize = onresize;

  var prevHit;
  var planeNormal;
  var prevHit2;
  var planeNormal2;
  
  var mode = -1;
  var MODE_ADD_DROPS = 0;
  var MODE_MOVE_SPHERE = 1;
  var MODE_ORBIT_CAMERA = 2;
  var MODE_SCALE_SPHERE = 3;
  var MODE_MOVE_SPHERE2 = 4;
  var MODE_SCALE_SPHERE2 = 5;
  var MODE_MOVE_SOURCE = 6;
  
  var oldX, oldY;

  function startDrag(x, y, altKey, shiftKey) {
    oldX = x;
    oldY = y;
    var tracer = new GL.Raytracer();
    var ray = tracer.getRayForPixel(x * ratio, y * ratio);
    var pointOnPlane = tracer.eye.add(ray.multiply(-tracer.eye.y / ray.y));
    var sphereHitTest = GL.Raytracer.hitTestSphere(tracer.eye, ray, center, radius);
    var sphereHitTest2 =  GL.Raytracer.hitTestSphere(tracer.eye, ray, center2, radius2);
    if (sphereHitTest) {

      if (altKey && !(sphereMode == SPHERE_MAKE_LINE_SOURCE)){
        mode = MODE_SCALE_SPHERE;
      } else {
        mode = MODE_MOVE_SPHERE;
      }  

      prevHit = sphereHitTest.hit;
      planeNormal = tracer.getRayForPixel(gl.canvas.width / 2, gl.canvas.height / 2).negative();
      
    } else if (sphereHitTest2) {

      if (altKey && !(sphereMode == SPHERE_MAKE_LINE_SOURCE)){
        mode = MODE_SCALE_SPHERE2;
      } else {
        mode = MODE_MOVE_SPHERE2;
      }  

      prevHit2 = sphereHitTest2.hit;
      //console.log(prevHit2)
      planeNormal2 = tracer.getRayForPixel(gl.canvas.width / 2, gl.canvas.height / 2).negative();
      //console.log(planeNormal2)
    }
    else if (Math.abs(pointOnPlane.x) < 1 && Math.abs(pointOnPlane.z) < 1) {
      if (shiftKey){
        mode = MODE_MOVE_SOURCE;
      } else{
        mode = MODE_ADD_DROPS;
      }  
      duringDrag(x, y);
      
    } else {
      mode = MODE_ORBIT_CAMERA;
    }
  }

  function duringDrag(x, y) {
    switch (mode) {
      case MODE_MOVE_SOURCE: {
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var pointOnPlane = tracer.eye.add(ray.multiply(-tracer.eye.y / ray.y));
          sourcex = pointOnPlane.x;
          sourcez = pointOnPlane.z;
          
          if (paused) {
          water.transferResults();    
          water.updateNormals();
          renderer.updateCaustics(water);
        }
        break;
      }

    case MODE_ADD_DROPS: {
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var pointOnPlane = tracer.eye.add(ray.multiply(-tracer.eye.y / ray.y));
        if (paused) {
          water.transferResults();    
          water.updateNormals();
          renderer.updateCaustics(water);
        }
        break;
      }
    case MODE_SCALE_SPHERE:
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var t = -planeNormal.dot(tracer.eye.subtract(prevHit)) / planeNormal.dot(ray);
        var nextHit = tracer.eye.add(ray.multiply(t));

        radius = radius + nextHit.subtract(prevHit).dot(upWorld);

        if ( radius <= minRadius) radius = minRadius;
      
        prevHit = nextHit;

        if (paused) renderer.updateCaustics(water);
        break;      

      case MODE_MOVE_SPHERE: {
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var t = -planeNormal.dot(tracer.eye.subtract(prevHit)) / planeNormal.dot(ray);
        var nextHit = tracer.eye.add(ray.multiply(t));
        center = center.add(nextHit.subtract(prevHit));
        center.x = Math.max(radius - 1, Math.min(1 - radius, center.x));
        center.y = sphereHeight1; //Math.max(radius - 1, Math.min(10, center.y));
        center.z = Math.max(radius - 1, Math.min(1 - radius, center.z));
        prevHit = nextHit;
        if (paused) renderer.updateCaustics(water);
        break;
      }
      
      case MODE_SCALE_SPHERE2:
      //console.log('scale_sphere');
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var t = -planeNormal2.dot(tracer.eye.subtract(prevHit2)) / planeNormal2.dot(ray);
        var nextHit = tracer.eye.add(ray.multiply(t));

        radius2 = radius2 + nextHit.subtract(prevHit2).dot(upWorld);

        if ( radius2 <= minRadius) radius2 = minRadius;
      
        prevHit2 = nextHit;

        if (paused) renderer.updateCaustics(water);
        break;      

      case MODE_MOVE_SPHERE2: {
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var t = -planeNormal2.dot(tracer.eye.subtract(prevHit2)) / planeNormal2.dot(ray);
        var nextHit = tracer.eye.add(ray.multiply(t));
        center2 = center2.add(nextHit.subtract(prevHit2));
        center2.x = Math.max(radius2 - 1, Math.min(1 - radius2, center2.x));
        center2.y = sphereHeight2; //Math.max(radius2 - 1, Math.min(10, center2.y));
        center2.z = Math.max(radius2 - 1, Math.min(1 - radius2, center2.z));
        prevHit2 = nextHit;
        if (paused) renderer.updateCaustics(water);
        break;
      }
      
      case MODE_ORBIT_CAMERA: {
        angleY -= x - oldX;
        angleX -= y - oldY;
        angleX = Math.max(-89.999, Math.min(89.999, angleX));
        break;
      }
    }
    oldX = x;
    oldY = y;
    if (paused) draw();
  }

  function stopDrag() {
    mode = -1;
  }

  function isHelpElement(element) {
    return element === help || element.parentNode && isHelpElement(element.parentNode);
  }

  document.onmousedown = function(e) {
    if (!isHelpElement(e.target)) {
      e.preventDefault();
      startDrag(e.pageX, e.pageY, e.altKey, e.shiftKey);
    }
  };

  document.onmousemove = function(e) {
    duringDrag(e.pageX, e.pageY);
  };

  document.onmouseup = function() {
    stopDrag();
  };

  document.ontouchstart = function(e) {
    if (e.touches.length === 1 && !isHelpElement(e.target)) {
      e.preventDefault();
      startDrag(e.touches[0].pageX, e.touches[0].pageY, e.touches[0].altKey, e.touches[0].shiftKey);
    }
  };

  document.ontouchmove = function(e) {
    if (e.touches.length === 1) {
      duringDrag(e.touches[0].pageX, e.touches[0].pageY);
    }
  };

  document.ontouchend = function(e) {
    if (e.touches.length == 0) {
      stopDrag();
    }
  };

  document.onkeydown = function(e) {
    if (e.which == ' '.charCodeAt(0)) paused = !paused;
    else if (e.which == 'B'.charCodeAt(0)) {
      var currentPersistSources = persistSources;
      var phaseOffset;
      persistSources = 1.0;
      source = true;
        var dz = 0.8;
        var dx = -0.5;
        for (i =0; dx < 0.5; i++){
          dx += 0.03;
          sourcex = dx;
          sourcez = dz;
          sourceStrength = sourceStrengthMin;
          phaseOffset += 0.01;
          water.updateSourcePersist(sourcex,sourcez,0.02,sourceStrength, phaseOffset, persistSources, phase);
        }
      //persistSources = currentPersistSources;
    }
    else if (e.which == 'D'.charCodeAt(0)){
      sphereMode = sphereMode + 1;
      if (sphereMode > SPHERE_MAX_MODE_NUMBER) sphereMode = 0;
      console.log('sphereMode',sphereMode)
    }
    else if (e.which == 'W'.charCodeAt(0)){
      doWrite = !doWrite;
      if (doWrite) {
        //console.log('write ON')
        document.getElementById('write').innerText = "write ON";
        if ((sphereMode == SPHERE_MAKE_LINE_SOURCE) && (sphereHeight1 == 0.0) && (sphereHeight2 == 0.0) ){
          persistSources = 0.0;
          water.updateSourcePersist(sourcex,sourcez,0.02,0.00, 0.00, persistSources, phase); //dummy null source
          persistSources = 1.0;
          var sourceLineStart = new GL.Vector(center.x, 0.0, center.z); //y is Z in source coord frame
          var sourceLineStop =  new GL.Vector(center2.x,0.0, center2.z);
          var sourceLine = sourceLineStop.subtract(sourceLineStart)
          
          //console.log(sourceLine.length())
          var sourceLineDL = sourceLine.unit()
          var sourceLineXdir = new GL.Vector(1.0/256, 0.0, 0.0);//includes scaling factor
          var sourceLineZdir = new GL.Vector(0.0, 0.0, 1.0/256);
          var sourceLineDX = sourceLine.unit().dot(sourceLineXdir) 
          var sourceLineDZ = sourceLine.unit().dot(sourceLineZdir)
          var sourceLineUnit = new GL.Vector(sourceLineDX, 0.0, sourceLineDZ)
          var sourceLineNumSources = sourceLine.length()/sourceLineUnit.length()
          //console.log('numSources = ',sourceLineNumSources)
          //console.log('dz=',sourceLineDZ)
          //console.log('dx=',sourceLineDX)
          
          for (i =0; i < sourceLineNumSources; i++){
            sourcex = center.x + sourceLineDX * i;
            sourcez = center.z + sourceLineDZ * i;
            sourceStrenth = sourceStrengthMin
            water.updateSourcePersist(sourcex,sourcez,0.02,sourceStrength, 0.00, persistSources, phase);
         }
        }
      }  
      else {
        //console.log('write off')
        document.getElementById('write').innerText = "write off";
      }
    }  
    else if (e.which == 'G'.charCodeAt(0)) useSpherePhysics = !useSpherePhysics; 
    else if (e.which == 'L'.charCodeAt(0) && paused) draw();
    else if (e.which == 'O'.charCodeAt(0)) {  //reset objects
      radius = resetRadius;
      radius2 = resetRadius;
    }
    else if (e.which == 'R'.charCodeAt(0)) {
      reset = true; //Added TDD 22 June 2016 to support reset. Animate will return to false when redrawn
      if (e.shiftKey){
        cleanGeometry = true;
      }
    }
    else if (e.which == 'I'.charCodeAt(0)){
      resetSource = true;
    }
    else if (e.which == 'J'.charCodeAt(0)){
      var mult = 1
      if (e.shiftKey) mult = 20;
      dphase = dphase - mult * incDphase;
      dphase = Math.max(dphase,minDphase);
      //console.log(dphase)
      document.getElementById('F').innerText = "F " + dphase.toFixed(2).toString();
    }
    else if (e.which == 'K'.charCodeAt(0)){
      var mult = 1
      if (e.shiftKey) mult = 20;
      dphase = dphase + mult * incDphase;
      dphase = Math.min(dphase,maxDphase);
      //console.log(dphase)
      document.getElementById('F').innerText = "F " +dphase.toFixed(2).toString();
    }
    else if (e.which == 'M'.charCodeAt(0)){
      sourceStrength = Math.min(sourceStrength + sourceStrengthInc, sourceStrengthMax);
      // console.log(sourceStrength)
      document.getElementById('A').innerText = "A " +sourceStrength.toFixed(2).toString();
    }
    else if (e.which == 'N'.charCodeAt(0)){
      sourceStrength = Math.max(sourceStrength - sourceStrengthInc, sourceStrengthMin);
      //console.log(sourceStrength)
      document.getElementById('A').innerText = "A " + sourceStrength.toFixed(2).toString();
    }
    else if (e.which == 'C'.charCodeAt(0)){
      if (persistSources == 0.0)
      {
        persistSources = 1.0;
        document.getElementById('persist').innerText = "Persist On";
      }
      else
      {
        persistSources = 0.0;
        document.getElementById('persist').innerText = "Persist Off";
      }
    }
    else if (e.which == 'U'.charCodeAt(0)){
      logUniforms = !logUniforms;
    }
    else if (e.which == 'Y'.charCodeAt(0)){
      if ((sphereMode == SPHERE_WRITE_PEC) || (sphereMode == SPHERE_WRITE_DIELECTRIC)){
        joinMode = true;
        joinDirWrite = true;
        if (e.shiftKey) joinDirWrite = false;
        //joinModeStartingPosition = center;
        
      }
    }
    else if (e.which == 'X'.charCodeAt(0)){
      if(sphereHeight1 == 0.0){
        sphereHeight1 = -0.5;
      } else
      {
        sphereHeight1 = 0.0;
        
      }
      center.y = sphereHeight1;
    }
        else if (e.which == 'Z'.charCodeAt(0)){
      if(sphereHeight2 == 0.0){
        sphereHeight2 = -0.5;
      } else
      {
        sphereHeight2 = 0.0;
        
      }
          center2.y = sphereHeight2;
          
      }
    else if (e.which == 'E'.charCodeAt(0)){
      resultsMode = resultsMode + 1;
      if (resultsMode > 2.0) resultsMode = 0;
      //console.log('resultsMode',resultsMode)
      if (resultsMode == 0.0) document.getElementById('field').innerText = "Ez";
      if (resultsMode == 1.0) document.getElementById('field').innerText = "Hx";
      if (resultsMode == 2.0) document.getElementById('field').innerText = "Hy";
     // doGoodPol = !doGoodPol; //Save this for when TE mode is added
    }
    else if (e.which == 'S'.charCodeAt(0)) {singleStep = true; paused = true;}
      //Added TDD 22 June 2016 to allow single stepping. Animate will return singleStep to false after one draw, but we stay paused until
      //explicitly restarted. Hitting S causes the pause to be enabled, because singleStep without pause is meaningless.
    else if (e.which == 'V'.charCodeAt(0)) {
      if (source == false) {
        source = true;
        phase = 0;
        console.log('source on')
      } //turn on with zero phase to minimise transients
      else if (source == true)  {
        source = false;
      }
    } //added TDD toggle source (voltage!)
    else if (e.which == 'P'.charCodeAt(0)) {
      if (showPEC==0.0) showPEC = 1.0;
      else showPEC = 0.0;
    }
  };

  var frame = 0;

  function update(seconds) {
    if (seconds > 1) return; 
    frame += seconds * 2;  // TDD: for the water update the time step is implicit so this does not affect it

    if (mode == MODE_MOVE_SPHERE) {
      // Start from rest when the player releases the mouse after moving the sphere
      velocity = new GL.Vector();
    } else if (useSpherePhysics) {
      // Fall down with viscosity under water
      var percentUnderWater = Math.max(0, Math.min(1, (radius - center.y) / (2 * radius)));
      velocity = velocity.add(gravity.multiply(seconds - 1.1 * seconds * percentUnderWater));
      velocity = velocity.subtract(velocity.unit().multiply(percentUnderWater * seconds * velocity.dot(velocity)));
      center = center.add(velocity.multiply(seconds));

      // Bounce off the bottom
      if (center.y < radius - 1) {
        center.y = radius - 1;
        velocity.y = Math.abs(velocity.y) * 0.7;
      }
    }

    // Displace water around the sphere
    if ((sphereMode == SPHERE_WRITE_PEC) || (sphereMode == SPHERE_WRITE_DIELECTRIC)){

      if (doWrite) {      
          if (sphereMode == SPHERE_WRITE_PEC){
            water.moveSphere(oldCenter, center, oldRadius, radius, 1.0);
            water.moveSphere(oldCenter2, center2, oldRadius2, radius2, 0.0);
          } else if (sphereMode == SPHERE_WRITE_DIELECTRIC){
            water.moveSphereDielectric(oldCenter, center, oldRadius, radius, 1.0);
            water.moveSphereDielectric(oldCenter2, center2, oldRadius2, radius2, 3.0);
          }
        }

      oldCenter = center;
      oldRadius = radius;
      oldCenter2 = center2;
      oldRadius2 = radius2;

      if (joinMode){

        if (joinDirWrite){ 
        var joinModeStart = new GL.Vector(center2.x, center2.y, center2.z);
        var joinModeStop = new GL.Vector(center.x, center.y, center.z);
        var joinModeVector = joinModeStop.subtract(joinModeStart);
        var joinStep = 0.4 * radius2;
          if  (joinModeVector.length() < 0.1) joinStep = joinModeVector.length(); 
        if (joinModeVector.length() < 0.005){
          joinMode = false; //end join mode once close
        }
        else{

          var joinModeXDir = new GL.Vector(joinStep, 0.0, 0.0);
          var joinModeYDir = new GL.Vector(0.0, joinStep, 0,0);
          var joinModeZDir = new GL.Vector(0.0,  0.0, joinStep);
          var joinModeDX = joinModeVector.unit().dot(joinModeXDir);
          var joinModeDY = joinModeVector.unit().dot(joinModeYDir);
          var joinModeDZ = joinModeVector.unit().dot(joinModeZDir);
        
          center2.x += joinModeDX;
          center2.y += joinModeDY;
          center2.z += joinModeDZ;
        }
      }
      else{ 
        var joinModeStart = new GL.Vector(center.x, center.y, center.z);
        var joinModeStop = new GL.Vector(center2.x, center2.y, center2.z);
        var joinModeVector = joinModeStop.subtract(joinModeStart);
        var joinStep = 0.4 * radius;
        if  (joinModeVector.length() < 0.1) joinStep = joinModeVector.length(); 
        if (joinModeVector.length() < 0.005){
          joinMode = false; //end join mode once close
        }
        else{

          var joinModeXDir = new GL.Vector(joinStep, 0.0, 0.0);
          var joinModeYDir = new GL.Vector(0.0, joinStep, 0,0);
          var joinModeZDir = new GL.Vector(0.0,  0.0, joinStep);
          var joinModeDX = joinModeVector.unit().dot(joinModeXDir);
          var joinModeDY = joinModeVector.unit().dot(joinModeYDir);
          var joinModeDZ = joinModeVector.unit().dot(joinModeZDir);
        
          center.x += joinModeDX;
          center.y += joinModeDY;
          center.z += joinModeDZ;
        }
      }
        
        
      }
    }

   

   
    // Update the water simulation and graphics
    if(newSim) {
      water.initPEC();
      water.resetDielectric();
      newSim = false;
    }

    // Put a startup demo here, if can write it directly.
 
    if (demoRunning) {
      doDemo();
 
    }
    
    if(reset) {
      water.reset();  //Added TDD 22 June 2016
      demoRunning = false;
      joinMode = false;
    }
    
    if (cleanGeometry){
      doWrite = false;
      document.getElementById('write').innerText = "write off";
      water.initPEC();
      water.resetDielectric();
      cleanGeometry = false;
    }
    
    phase = phase + dphase;
    
    if (source){
      water.updateSourcePersist(sourcex,sourcez,0.02,sourceStrength, 0.0, persistSources, phase);
    } 

    if (resetSource){
      console.log('reset source')
      water.updateSourcePersist(0,0,0.02,0, 0.0, 0.0, 0.0);
      resetSource = false;
    }
    
    water.stepHSimulationGoodPol();   // the time step is implicit in the algorithm
    water.stepESimulationGoodPolDielectric();   // hence single stepping just worked without modification
    water.storeEfield();  // keep the Efield for use in the BC 

    water.stepHSimulationGoodPol();   // the time step is implicit in the algorithm
    water.stepESimulationGoodPolDielectric();   // hence single stepping just worked without modification
    water.storeEfield(); //keep the Efield for use in the BC
 
   
    water.transferResultsChoice(resultsMode);
    water.updateNormals();
    renderer.updateCaustics(water);
  }

  function draw() {
    // Change the light direction to the camera look vector when the L key is pressed
    if (GL.keys.L) {
      renderer.lightDir = GL.Vector.fromAngles((90 - angleY) * Math.PI / 180, -angleX * Math.PI / 180);
      if (paused) renderer.updateCaustics(water);
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.loadIdentity();
    gl.translate(0, 0, -4);
    gl.rotate(-angleX, 1, 0, 0);
    gl.rotate(-angleY, 0, 1, 0);
    gl.translate(0, 0.5, 0);

    gl.enable(gl.DEPTH_TEST);
    renderer.sphereCenter = center;
    renderer.sphereRadius = radius;
    renderer.sphereCenter2 = center2;
    renderer.sphereRadius2 = radius2;
    if (sphereMode == SPHERE_WRITE_PEC){
      renderer.colorSphere2 = new GL.Vector(0.8,0.8,0.8);
      renderer.colorSphere1 = new GL.Vector(0.08, 0.33, 0.7);
    } else if (sphereMode == SPHERE_WRITE_DIELECTRIC){
      renderer.colorSphere2 = new GL.Vector(1.0,0.1,0.1);
      renderer.colorSphere1 = new GL.Vector(0.1,0.1,1.0);
    } else if (sphereMode == SPHERE_MAKE_LINE_SOURCE){
      renderer.colorSphere1 = new GL.Vector(1.0,1.0,0.1);
      renderer.colorSphere2 = new GL.Vector(1.0,1.0,0.1);
      renderer.sphereRadius2 = lineSourceSphereRadius;
      renderer.sphereRadius =  lineSourceSphereRadius;
    }
    else // just in case mode not handled properly
    {
      renderer.colorSphere1 = new GL.Vector(0.3,0.3,0.3);
      renderer.colorSphere2 = new GL.Vector(0.3,0.3,0.3); 
    }
     
    renderer.renderCube();
    renderer.renderWater(water, cubemap, showPEC);
    renderer.renderSphere();
    renderer.renderSphere2();
    gl.disable(gl.DEPTH_TEST);
    
  }

  function doDemo(){
    var maxState = 9;

    if (demoState == 0){
      center.x = -0.5
      center.z = -0.5
      center2.x = 0.5
      center2.z = -0.5
      radius = 0.01
      radius2 = 0.2
      pressKey("D");
      pressKey("X");
      pressKey("Z");
      pressKey("W");
      pressKey("Y");
      demoState += 1;
    } else if (demoState == 1){
      if (joinMode == false){
        pressKey("W");
        center.x =  -0.5
        center.z =  0.5
        radius = 0.01
        radius2 = 0.2
        pressKey("W");
        pressKey("Y");
        demoState += 1;
      }
    } else if (demoState == 2){
      if (joinMode == false){
        pressKey("W");
        center.x =  0.5
        center.z =  0.5
        radius = 0.01
        radius2 = 0.2
        pressKey("W");
        pressKey("Y");
        demoState += 1;
      }
    } else if (demoState == 3){
      if (joinMode == false){
        pressKey("W");
        center.x =  0.5
        center.z =  -0.5
        radius = 0.01
        radius2 = 0.2
        pressKey("W");
        pressKey("Y");
        demoState += 1;
      }
    } else if (demoState == 4){
      if (joinMode == false){
        pressKey("W");
        center.x = 0.0
        center.z = -0.2
        radius = 0.3
        radius2 = 0.01
        pressKey("Z")
        pressKey("W");
        demoState += 1;
        }
    } else if (demoState == 5) {
      demoState +=1;
    } else if (demoState == 6){
      if (joinMode == false){
        pressKey("W");
        pressKey("Z")
        pressKey("X")
        center2.x = 0.1
        center2.z = 0.07
        radius = 0.01
        radius2 = 0.11
        pressKey("D");
        pressKey("D");
        pressKey("W");
        demoState += 1;
        }
    } else if (demoState == 7){
      demoState += 1;
    } else if (demoState == 8){
      pressKey("W")
      pressKey("X")
      radius = 0.1
      radius2 = 0.1
      pressKey("D")
      pressKey("D")
      center.x = -0.5
      center.z = -0.5
      center2.x = 0.5
      center2.z = -0.5
      pressKey("W")
      pressKey("R")
      pressKey("V")
    }
        
    if (demoState >= maxState) demoRunning = false;
    
       
  }

  function pressKey(Key){
    var e = new Event("keydown");
    e.key=Key;    // just enter the char you want to send 
    e.keyCode=e.key.charCodeAt(0);
    e.which=e.keyCode;
    e.altKey=false;
    e.ctrlKey=true;
    e.shiftKey=false;
    e.metaKey=false;
    e.bubbles=true;
    document.dispatchEvent(e);
  }
  function pressShiftAndKey(Key){
    var e = new Event("keydown");
    e.key=Key;    // just enter the char you want to send 
    e.keyCode=e.key.charCodeAt(0);
    e.which=e.keyCode;
    e.altKey=false;
    e.ctrlKey=true;
    e.shiftKey=true ;
    e.metaKey=false;
    e.bubbles=true;
    document.dispatchEvent(e);
  }
  
};
