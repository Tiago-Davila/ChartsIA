import { type DiagramStyle } from '@chartsia/core/model';
import { CleanShape, type ShapeProps } from './CleanShape';
import { SketchShape } from './SketchShape';

export function ShapeRenderer({ style, ...props }: ShapeProps & { style: DiagramStyle }) {
  return style === 'sketch' ? <SketchShape {...props} /> : <CleanShape {...props} />;
}
