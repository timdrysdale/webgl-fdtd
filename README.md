# webgl-fdtd
Interactive electromagnetic simulator for your browser, running on your GPU via WebGL.

You can read a bit about this at http://thebeautifulequations.org, and try it out at http://thebeautifulequations.org/webgl-fdtd.

If your GPU is not sufficiently modern, you can see a demo on youtube here: https://www.youtube.com/watch?v=EYrfPJMEa6I

This takes all the beautiful rendering from Evan Wallace's WebGL water, and replaces the water heightfield simulation with 
a 2D finite difference time domain simulation, including dielectrics, metals, open boundary, line source. 
Geometries are drawn using the spheres. 

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
