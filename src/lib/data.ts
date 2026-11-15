import * as U from './utils'
import type { ParamFields } from './hydra-rewrite'

/** A synth template with one preset: Hydra source text, parameter ranges, and the two Hilbert indices. */
export interface Template {
	templateName: string;
	presetName: string;
	/** Standard Hydra source. Every numeric literal in an argument of a Hydra function becomes a parameter; its key is `<function><occurrence>_<input>`. */
	code: string;
	/** Fields that replace the derived ones for the listed keys, mainly the range `c0`..`c1`. A key without an entry gets the range [min(0, 2v), max(1, 2v)] around its literal v. */
	ranges?: Record<string, Partial<ParamFields>>;
	/** The parameters of a saved preset. When absent, the parameters are derived from `code` and `ranges`. */
	inputSpace?: Array<[string, ParamFields]>;
	author?: string;
	h_global?: bigint;
	h_local?: bigint;
}

/** The Hilbert index at fraction `f` of the largest index for `n` unlocked parameters at 32 bits each. `n` must equal the number of parameters that `code` yields; `test/hydra-rewrite.test.ts` checks it. */
const indexAt = (n: number, f: number): bigint => U.prod((1n << BigInt(32 * n)) - 1n, f, 6);

export const examples: Template[] = [{
	// licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
	// by Olivia Jack
	// https://ojack.github.io
	templateName: "Ojack 1",
	presetName: "preset0",
	code: `osc(1, 1, 1)
	.kaleid(2)
	.color(1, 1, 1)
	.rotate(1, 1)
	.modulate(o0, 1)
	.scale(1)
	.out(o0)`,
	ranges: {
		osc1_frequency: { c0: 0.0001, c1: 100 },
		osc1_offset: { c0: 0.0001, c1: 1 },
		kaleid1_nSides: { c0: 1, c1: 20 },
		color1_r: { c0: 0, c1: 1 },
		color1_g: { c0: 0, c1: 1 },
		color1_b: { c0: 0, c1: 1 },
		rotate1_angle: { c0: 0, c1: 1 },
		rotate1_speed: { c0: 0, c1: 1 },
		modulate1_amount: { c0: 0.0001, c1: 1 },
		scale1_amount: { c0: 0.0001, c1: 1 },
	},
	h_global: indexAt(11, 0.1),
	h_local: indexAt(11, 0.5),
}, {
	// licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
	// Puertas III
	// por Celeste Betancur
	// https://github.com/essteban
	templateName: "Puertas III",
	presetName: "preset0",
	code: `osc(1, 1, 1)
	.modulateScale(osc(1, 1, 1).kaleid(1))
	.repeat(1, 1)
	.modulate(o0, 1)
	.modulateKaleid(shape(1, 1, 1))
	.out(o0)`,
	ranges: {
		osc1_frequency: { c0: 0.0001, c1: 100 },
		osc1_offset: { c0: 0.0001, c1: 1 },
		osc2_frequency: { c0: 0.0001, c1: 100 },
		osc2_offset: { c0: 0.0001, c1: 1 },
		kaleid1_nSides: { c0: 1, c1: 20 },
		repeat1_repeatX: { c0: 0, c1: 5 },
		repeat1_repeatY: { c0: 0, c1: 5 },
		modulate1_amount: { c0: 0.0001, c1: 1 },
		shape1_sides: { c0: 0, c1: 20 },
		shape1_radius: { c0: 0.0001, c1: 10 },
		shape1_smoothing: { c0: 0, c1: 1 },
	},
	h_global: indexAt(13, 0.1),
	h_local: indexAt(13, 0.5),
}, {
	// licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
	// by Olivia Jack
	// https://ojack.github.io
	templateName: "Ojack 2",
	presetName: "preset0",
	code: `osc(1, 1, 1)
	.modulate(src(o0).rotate(1), 1)
	.color(1, 1, 1)
	.rotate(1, 0)
	.pixelate(0.576, 12.888)
	.mult(osc(1, 1, 1).thresh(1).rotate(1, 0))
	.modulateRotate(osc(1, 1, 1).thresh(1, 1), 1)
	.out(o0)`,
	ranges: {
		osc1_frequency: { c0: 0.0001, c1: 100 },
		osc1_offset: { c0: 0.0001, c1: 1 },
		modulate1_amount: { c0: 0, c1: 1 },
		rotate1_angle: { c0: 0, c1: 1 },
		color1_r: { c0: 0, c1: 1 },
		color1_g: { c0: 0, c1: 1 },
		color1_b: { c0: 0, c1: 1 },
		rotate2_angle: { c0: 0, c1: 1 },
		osc2_frequency: { c0: 0.0001, c1: 100 },
		osc2_offset: { c0: 0.0001, c1: 1 },
		thresh1_threshold: { c0: 0, c1: 1 },
		rotate3_angle: { c0: 0, c1: 1 },
		modulateRotate1_multiple: { c0: 0, c1: 1 },
		osc3_frequency: { c0: 0.0001, c1: 100 },
		osc3_offset: { c0: 0.0001, c1: 1 },
		thresh2_threshold: { c0: 0, c1: 1 },
		thresh2_tolerance: { c0: 0, c1: 1 },
	},
	h_global: indexAt(24, 0.1),
	h_local: indexAt(24, 0.5),
}, {
	templateName: "Grayscale Noise",
	presetName: "preset0",
	code: `noise(1, 1)
	.modulate(src(o0).modulate(osc(1, 1, 1), 1), 1)
	.posterize()
	.out(o0)`,
	ranges: {
		noise1_scale: { c0: 0.1, c1: 10 },
		modulate1_amount: { c0: 0, c1: 1 },
		osc1_frequency: { c0: 0.0001, c1: 1000 },
		osc1_offset: { c0: 0.0001, c1: 1 },
		modulate2_amount: { c0: 0.0001, c1: 1 },
	},
	h_global: indexAt(7, 0.1),
	h_local: indexAt(7, 0.5),
}, {
	author: "Asdrúbal Gomez",
	templateName: "Asdrubal",
	presetName: "preset0",
	code: `noise(3, 0.1, 6.157)
	.rotate(1, -1.941, -2)
	.mask(shape(20))
	.colorama(0.959)
	.modulateScale(o0)
	.modulateScale(o0, 0.291)
	.blend(o0)
	.blend(o0)
	.blend(o0)
	.blend(o0)
	.out(o0)`,
}]

// osc(60,-0.015,0.3).diff(osc(60,0.08).rotate(Math.PI/2))
// 	.modulateScale(noise(3.5,0.25).modulateScale(osc(15).rotate(()=>Math.sin(time/2))),0.6)
// 	.color(1,0.5,0.4).contrast(1.4)
// 	.add(src(o0).modulate(o0,.04),.6)
// 	.invert().brightness(0.1).contrast(1.2)
// 	.modulateScale(osc(2),-0.2)
//   .out()

// licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// Asdrúbal Gomez


// licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// by Olivia Jack
// https://ojack.github.io
// osc(6.438, 0.142, 0.025)
// 	.color(0.681, 0.198, -0.073)
// 	.rotate(0.591, 0.136)
// 	.pixelate(1.765, 39.107)
// 	.modulate(noise(3.111), () => 1.422 * Math.sin(0.076 * time))
// 	.out(o0);



// // licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// // by Nelson Vera
// // twitter: @nel_sonologia
// osc(9.634, -0.233, 0.782)
// 	.color(-1.358, -2.921, -2.967)
// 	.blend(o0)
// 	.rotate(-0.486, -0.269)
// 	.modulate(shape(7.614)
// 		.rotate(0.957, 0.58)
// 		.scale(3.054)
// 		.repeatX(1.896, 2.632)
// 		.modulate(o0, () => mouse.x * 0.001)
// 		.repeatY(2.093, 2.059))
// 	.out(o0);





// // licensed with CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// // 3.3
// // by ΔNDR0M3DΔ
// // https://www.instagram.com/androm3_da/
// osc()
// 	.modulateRotate(o0, 0.098)
// 	.out();
// osc(2.234, 0.102, 0.366)
// 	.diff(o3, 4.28)
// 	.out(o1);
// osc(2.802, 0.352, 38.429)
// 	.modulateKaleid(o3, 3.426)
// 	.diff(o0)
// 	.out(o2);
// src(o0, 3.316)
// 	.mult(o1, 1.042)
// 	.kaleid(2.325)
// 	.out(o3);
// render(o2);


