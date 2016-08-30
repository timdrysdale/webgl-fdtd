# webgl-fdtd
Interactive electromagnetic simulator for your browser, running on your GPU via WebGL.

You can read a bit about this at http://thebeautifulequations.org, and try it out at http://thebeautifulequations.org/webgl-fdtd.

If your GPU is not sufficiently modern, you can see a demo on youtube here: https://www.youtube.com/watch?v=EYrfPJMEa6I

This takes all the beautiful rendering from Evan Wallace's WebGL water, and replaces the water heightfield simulation with 
a 2D finite difference time domain simulation, including dielectrics, metals, open boundary, line source. 
Geometries are drawn using the spheres. 

Some hints on how to use it
---

Like all software projects that are made up as you go along, this grew arms and legs in terms of the number of features. This will all make a lot more sense during the talk, with plenty of photos of interesting stuff from the real world to put it all in context. Along the way we'll model some important milestones in technology. All in a browser-based simulator! 

Many different keys are used on the keyboard and there isn't much rhyme or reason holding the whole scheme together - and some remain unlisted (see if you can find them!). Come along to the talk to see how it all hangs together, and/or just have a bash yourself. 
          
Ok, here goes with mega-detail. Don't read this until after you've had a play. You can change the viewpoint at any time to your preference by clicking and dragging on the black background. You can short cut the demo and clear away the red and white geometry by pressing Shift+R. The blue is radio waves in air, the red is a dielectric region (think, glass or plastic) and the white is a perfect electric conductor (think, metal). You can draw regions of dielectric and/or metal with the appropriate coloured ball.

Press D to change the draw mode. The White and blue spheres are for PEC writing and erasing, red and blue spheres for dielectric writing and erasing.  Press Z and X to toggle writing sphere and the erasing sphere into and out of place. If they are on the radio wave layer, then they do their job, otherwise not.  You can move the spheres, to reposition, or draw, by clicking and dragging. You can scale the spheres to change how wide is the line you draw, by holding Alt while clicking on the sphere and dragging the mouse. Once the spheres are where you want, you can turn on writing mode by pressing "W" (and press it again to turn it off). There is no undo button, but there is erase! To help you draw in a straight line, if you press 'Y' the write sphere will move in a straight line to the erase sphere. If you press Shift+Y, the erase sphere will move in a straight line to the write sphere.

The yellow spheres are for making a line source - once they are positioned, press "W" to activate that line. And press R immediately after - things get a bit over energetic when you set it up. Press V to toggle the source on and off. If you just want a single source, press C to turn source location persistance off, and then Shift+Click on the water (radio!) surface to locate a source there. If you want a couple of point sources, press C to toggle source persistance back on. And if you get a bit fresh with the boundary conditions ... you might see the water become very spikey...just hit R to reset the fields ... (the boundary conditions like their space, their waves to come head-on and have some pace, no laggardly evanescent waves for these mighty Mur first order boundaries).


To Do
---
(1) A decent control panel with knobs.

I deliberately avoided one for this version because I was writing it for use in a presentation
at the Orkney International Science Festival and did not want to use valuable projector screen real-estate on knobs 
when the detail in the waves might be hard to pick out due to projector resolution / contrast etc.

(2) Documentation

The keys listed in the side bar are not exhaustive .... 

(3) E-mag features (no plans to implement, but they are obvious choices)
- TE polarisation, 
- TF/SF
- PML boundaries
- image geometry upload
- field readout
- alternative source waveforms 

/ends
