import Kefir from "kefir";
export const mousemove_ = Kefir.fromEvents(window, 'mousemove');
export const obs = f => x => x.onValue(val=>f(val))
