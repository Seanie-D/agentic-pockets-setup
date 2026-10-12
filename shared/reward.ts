// The tutorial's reward, drawn by the lead citizen as shapes (ticket 009): the plugin cannot show an SVG (react-native-svg is
// not a plugin module), so the citizen draws with a few shapes that plain views can draw on every screen. Coordinates are
// in a 320 × 200 box. The Commons skill `tutorial-reward` tells the citizen how to draw with them.
import { z } from "zod";

const n = z.number().finite();
export const shapeSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("blob"), x: n, y: n, w: n.positive(), h: n.positive(), fill: z.string().optional(), tilt: n.optional() }),   // an oval, centred on x, y
  z.object({ t: z.literal("smile"), x: n, y: n, r: n.positive() }),                                                                    // the lower half of a circle
  z.object({ t: z.literal("dot"), x: n, y: n, r: n.positive().optional() }),                                                           // an eye
  z.object({ t: z.literal("line"), x1: n, y1: n, x2: n, y2: n, w: n.positive().optional() }),
  z.object({ t: z.literal("text"), x: n, y: n, text: z.string().max(80), size: n.positive().optional() }),
]);
export const drawingSchema = z.object({ line: z.string().min(1).max(400), shapes: z.array(shapeSchema).min(1).max(60) });
export const rewardRowSchema = drawingSchema.extend({ user: z.string(), citizen: z.string() });
export type Drawing = z.infer<typeof drawingSchema>;
export type Shape = z.infer<typeof shapeSchema>;
export const REWARD_KIND = "tutorial-reward";
export const DRAW_W = 320, DRAW_H = 200;
