# Little Cruisers

Little Cruisers: a little 3D garage and driving yard for kids, built as a mobile web app. Pick a vehicle, paint it, and drive it out of the garage.

## What is in it

- A garage building with a workbench, tool chest, shelves, tyre rack, air compressor and a two-post car lift.
- Two vehicles: a hatchback and an auto rickshaw. Each has its own speed and handling.
- Touch driving: steering under the left thumb, go and back under the right. Arrow keys and WASD work on a laptop.
- Five paint colours for whichever vehicle is selected.
- Drag to look around. The zoom is fixed.
- Park in a blue bay (nose in or backed in, then stop) and it turns green. Fill every bay to finish the level; the next level unlocks and the surroundings grow: trees, then a town, then a city with a crane and a big wheel. Progress is saved on the device.
- The camera stays inside the building with the vehicle, so walls never vanish.
- Walls, equipment and the other vehicle are solid.
- Installable on a phone home screen and playable offline (PWA).

## Stack

React 19, TypeScript, Vite and Three.js. There is no server: the build is a folder of static files.

## Run it

```bash
npm install
npm run dev        # local development, open the printed address on your phone or laptop
npm run build      # type-check and build into dist/
npm run preview    # serve the built app
```

To try it on a phone during development, run `npm run dev -- --host` and open the network address it prints.

## Where things live

```
src/
  App.tsx            the screen: vehicle picker, speed, paint row, driving buttons
  App.css            mobile-first styles
  ui/DriveButton.tsx press-and-hold driving button
  game/
    game.ts          scene, lights, camera, driving, collisions; exposes a small API to React
    levels.ts        the levels: bays, cones, goals (add a level here)
    yard.ts          the fenced yard and its parking bays
    scenery.ts       sky, grass, hills, trees, town and city around the yard
    scenery-kit.ts   painted textures and the batcher that merges scenery into few meshes
    sound.ts         little chimes made with Web Audio
    kit.ts           shared materials, geometry helpers, the wheel, the Vehicle type
    car.ts           the hatchback
    rickshaw.ts      the auto rickshaw
    garage.ts        the building, its equipment, and wall/camera collision
```

To add a vehicle: write a `buildSomething()` in `src/game/` that returns a `Vehicle` (see `car.ts`), add it to the `vehicles` list in `game.ts`, and add a button for it in `VEHICLES` in `App.tsx`.

## Next for the kids' version

- Sounds: horn, engine, a cheer for rewards.
- Garage activities: wash, change a tyre, fill fuel.
- Stars or balloons to collect in place of the cones.
- More vehicles: bus, tractor, fire engine, ambulance.
- Spoken colour and vehicle names, in English and a local language.
