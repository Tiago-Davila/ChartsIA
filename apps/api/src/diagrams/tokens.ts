export const CLOCK = Symbol('CLOCK');
export const DIAGRAM_ID_GENERATOR = Symbol('DIAGRAM_ID_GENERATOR');

export type Clock = () => Date;
export type IdGenerator = () => string;
