# Claude character references

These two images are concept reference sheets generated with the built-in image generation tool. They are not production spritesheets or actual 3D model files.

Original identity reference: /home/shifty/Work/ai-telephone/slides/assets/dirtysouthailogo.png

## Proposed design

The logo supplies the head only. The oversized head, black sleeveless shirt, charcoal shorts, cloven hands and feet, and curled tail are proposed additions for a walking character. Both sheets show four basic views and four elevated diagonal views.

## Guidance for the building agent

Use the original logo as the authority for facial details. Treat generated views as shape and style guidance: they have minor inconsistencies in tattoo placement/visibility and accessories. In particular, the voxel profile facing page right omits the cheek tattoos, while the pixel profile facing page left places them on the wrong side. Resolve these in the asset rather than copying each panel literally.

Lock the spade and OAI heart to the character's anatomical right cheek (viewer-left in a front view). Keep the cigarette at anatomical left mouth corner and fix every piercing and hat marking to its physical side. Do not mirror asymmetric decorations when making opposite directions.

Choose and lock the game camera elevation, sprite size or voxel resolution, floor pivot, and scale before producing animation. Isometric rows are visual approximations, not calibrated camera renders. For sprites, produce aligned transparent frames with consistent pixel grid and foot pivot. For 3D, build one coherent model and render all directions from it; separate head, torso, arms, and legs for animation. Keep smoke as an optional separate effect.

## Final generation prompts

### Pixel reference

Use case: stylized-concept.
Asset type: pixel-art character turnaround reference sheet for an agent to later build an animated isometric game character.
Input image 1 is the authoritative character identity reference: a punk cartoon pig mascot named Claude. Derive the same recognizable pig, not a generic pig. Preserve peach-pink skin, huge cream oval eyes with black pupils, prominent snout with metallic nostril rings, multiple ear hoops, eyebrow ring, tiny chin stud, forehead CLAUDE banner and three stars, black spade on its anatomical right cheek (viewer left in front view), heart OAI tattoo on same cheek, and the jaunty cream-and-black folded cap with skull and crossbones and small SMOKE 'EM IF YOU GOT 'EM slogan. A rolled smoking cigarette/joint remains at its anatomical left mouth corner; use a minimal smoke wisp. Simplify tiny lettering sensibly at pixel scale, never move or mirror tattoos between sides.
Invent a simple animation-friendly compact standing biped body under this oversized logo head: head about 60% total height, small plain black sleeveless shirt, short dark charcoal trousers, pink arms ending in simple cloven hands, dark cloven feet, and small curled pink tail emerging from back. Treat body as proposed design, consistent in all views.
Create a polished wide reference plate on a plain warm off-white background, with title 'CLAUDE / PIXEL CHARACTER STUDY'. Layout exactly two rows of four evenly spaced complete figures with ample margins, all same proportions and scale, neutral standing pose arms slightly separated, feet on aligned baselines. Upper row eye-level orthographic front, character left profile (nose points left on page), back, character right profile (nose points right on page). Lower row four elevated isometric game views at consistent 30 degree camera elevation: front-left, rear-left, rear-right, front-right, each distinctly different. Each figure has a concise accurate view label below; row captions 'ORTHOGRAPHIC TURNAROUND' and 'ISOMETRIC DIRECTIONS'. Keep asymmetrical markings physically on same side in all rotations. Back views show back of hat/head and tail, no eyes/snout/face tattoos pasted on back.
Style: authentic crisp pixel-art concept mockup, chunky square pixel clusters, restricted peach/cream/black/charcoal/coral/silver palette sampled from logo, strong silhouette, nearest-neighbor pixel appearance, no vector-smooth character edges, no blur. Sprite-like figures with enough resolution to retain mascot identity. No circular orange/red logo badge, no scenery, no extra props, no walking frames. This is a design reference, not an engine-ready spritesheet. Small footer 'Proposed body design • Neutral pose • Reference mockup'.

### Voxel reference

Use case: stylized-concept.
Asset type: voxel character turnaround concept reference for building an actual animated 3D voxel model later.
Input image 1 is authoritative original punk pig logo identity. Input image 2 is an approved-for-comparison pixel-art concept reference for proposed body proportions, outfit, and reference-sheet layout. Translate that same character into visibly three-dimensional cubic voxels.
Create a wide warm off-white studio reference sheet titled 'CLAUDE / VOXEL CHARACTER STUDY'. Exactly 8 full-body views, two rows of four. Top row neutral eye-level orthographic front, profile facing page left, back, profile facing page right. Bottom row elevated isometric front-left, rear-left, rear-right, front-right, consistent 30 degree camera elevation and identical scale. Label each accurately. Large clear figures, generous gaps, aligned feet, no cropping. Subtle floor contact shadows only.
Character: punk peach-pink cartoon pig, oversized head roughly 60% height, cream oval eyes black pupils, protruding coral snout with two silver nostril rings, black outlined ears with multiple silver hoops, eyebrow ring and chin stud. Asymmetrical cream and black folded cap with skull-and-crossbones and the source slogan. Forehead CLAUDE banner and three stars. Black spade and heart OAI tattoo ONLY on anatomical right cheek: visible viewer-left of front view, visible on profile facing page right, hidden on opposite profile. Preserve physical side assignment as rotating a single fixed 3D model, do not mirror face decorations to camera. Cream rolled cigarette/joint held at anatomical left mouth corner with dark ember, minimal smoke, consistently attached across views. Plain black sleeveless top, charcoal short trousers, pink arms with simple cloven hands, dark cloven feet, small curled pink tail at back; identical outfit and body proportions to image 2.
Medium: true voxel-style 3D render, all head/body surfaces constructed from clear small cubic blocks with stepped contours, block-built rings, cuboid limbs, block-shaped snout with readable depth; matte finish, soft studio ambient occlusion, cream/peach/coral/black/charcoal/silver palette. Keep original expressive friendly punk mascot identity and recognizable folded cap. No smooth clay, no rounded polygon model, no flat pixel-art sprites. Infer back-of-head/cap geometry conservatively, no face on back. Show one consistent neutral standing pose, arms slightly separate for later rigging, no animation yet. No scenery, logo circle or additional props. Small footer 'Proposed body design • Voxel concept render • Reference mockup'.

