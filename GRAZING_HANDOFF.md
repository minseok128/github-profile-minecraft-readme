# Grazing Animation Handoff

## Goal

Current repo: [github-profile-minecraft-readme](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme)

Problem to continue: sheep grazing animation still looks wrong.

The specific failure is not basic walking anymore. The remaining issue is:

- When a sheep enters `graze`, the neck/head motion still does not feel like a natural downward nibble.
- It no longer fully detaches or drops as badly as before, but the pose and chew cycle are still visually off.

## Current State

The current sheep state machine in [build-scene-page.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/build-scene-page.ts) already includes:

- `walk / idle / graze` state transitions
- deterministic stepping for exporter playback
- loop smoothing for GIF export
- a split between `headPivot` and `headRig`

Relevant output files currently generated from `npm run render:sample`:

- [profile-minecraft.gif](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/profile/profile-minecraft.gif)
- [profile-minecraft.png](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/profile/profile-minecraft.png)
- [profile-minecraft.html](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/profile/profile-minecraft.html)

## Files To Read First

- [build-scene-page.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/build-scene-page.ts)
- [exporter.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/render/exporter.ts)
- [sheep-planner.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/sheep-planner.ts)

## Exact Hotspots

These are the functions and constants that matter:

- `buildSheep()`
  In [build-scene-page.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/build-scene-page.ts)
  Current structure now has:
  - `headPivot`
  - `headRig`
  - meshes attached under `headRig`

- `resetHeadPose()`
  In [build-scene-page.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/build-scene-page.ts)

- `applyGrazingPose()`
  In [build-scene-page.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/build-scene-page.ts)

- `updateSheep()`
  In [build-scene-page.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/build-scene-page.ts)
  This is where graze/idle/walk blending actually shows up on the model.

- `window.__setSceneTime(...)`
  In [build-scene-page.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/build-scene-page.ts)
  Useful for freezing the scene at a problematic instant.

## What Was Already Tried

The following was already attempted and should be assumed explored:

1. Imported the old `walk / idle / graze` state machine from the original work into the current repo.
2. Reduced grazing constants:
   - lower head rotation
   - lower chew amplitude
   - less body drop
3. Added a separate `headRig` under `headPivot` so the whole neck anchor is not dragged downward.
4. Flipped chew phase so the repeated nibble motion goes downward instead of upward.
5. Added GIF loop smoothing and first/last-frame closure handling in [exporter.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/render/exporter.ts).

Result:

- walking is acceptable
- loop closure is much better
- grazing is still visually wrong

## Important Finding

I checked the original repo for a source-level fix that changed grazing playback direction.

Result:

- I did **not** find a committed source fix in the original repo that solved this in `src`.
- The original integrated implementation is in commit `a591614` of:
  [create-minecraft-grass-three-page.ts](/Users/minseok128/Desktop/goinfre/github-profile-3d-contrib/src/create-minecraft-grass-three-page.ts)
- There is no later committed `src` diff that cleanly fixes grazing direction/pose there.

So the current task is not “find and copy the final perfect fix”. It is now a real rig/animation correction task in this repo.

## Useful External Reference Already Checked

From the original repo’s local assets:

- [sheep.animation.json](/Users/minseok128/Desktop/goinfre/github-profile-3d-contrib/docs/assets/sheep.animation.json)
- [sheep.geo.json](/Users/minseok128/Desktop/goinfre/github-profile-3d-contrib/docs/assets/sheep.geo.json)
- [quadruped.animation.json](/Users/minseok128/Desktop/goinfre/github-profile-3d-contrib/docs/assets/quadruped.animation.json)

Important note from those files:

- Bedrock grazing animates the `head` bone position downwards and rotates the head.
- Our local Three.js rig is only an approximation of that bone hierarchy.
- The remaining bug likely comes from our simplified head rig not matching the actual Bedrock pivot/origin behavior closely enough.

## Best Reproduction Path

Use the generated preview HTML and freeze the scene at a specific moment.

1. Run:

```bash
npm run render:sample
```

2. Serve the repo root:

```bash
python3 -m http.server 4173
```

3. Open:

```text
http://127.0.0.1:4173/profile/profile-minecraft.html
```

4. In browser console or automation, freeze time:

```js
window.__setSceneTime(4)
```

This time point was repeatedly useful for catching a visible grazing pose.

## What The Next Worker Should Probably Try

Most promising direction:

1. Stop treating grazing as just “rotate head downward”.
2. Rebuild the head hierarchy so the head mesh rotates around a more realistic neck hinge point.
3. If needed, add one more nested group:
   - `headPivot` for neck anchor
   - `headNeck` for hinge rotation
   - `headRig` for downward positional offset
4. Match the Bedrock numbers more literally from [sheep.animation.json](/Users/minseok128/Desktop/goinfre/github-profile-3d-contrib/docs/assets/sheep.animation.json), but translated into this mesh layout.
5. Keep using direct visual checks at fixed times instead of only changing constants blindly.

Less promising direction:

- further exporter loop tweaks
- more random timing changes
- changing sheep route generation

Those are not the core grazing bug anymore.

## Current Modified Files

These are currently the files with local changes related to this work:

- [build-scene-page.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/build-scene-page.ts)
- [exporter.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/render/exporter.ts)
- [sheep-planner.ts](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/src/scene/sheep-planner.ts)
- [profile-minecraft.gif](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/profile/profile-minecraft.gif)
- [profile-minecraft.png](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/profile/profile-minecraft.png)
- [profile-minecraft.html](/Users/minseok128/Desktop/goinfre/github-profile-minecraft-readme/profile/profile-minecraft.html)

## Summary

The repo is past the “basic sheep behavior” stage.

What remains is specifically:

- fix the grazing pose/hinge behavior so the head lowering and chew motion feel correct

Walking, idle/graze state transitions, transparent output, framing, and loop smoothing already exist and are not the main blocker now.
