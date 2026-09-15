export type Priority = 'low' | 'normal' | 'high';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  url: string;
  pageTitle: string;
  createdAt: number;
  comment: string;
  priority: Priority;
  element: string;
  selector: string;
  fullPath: string;
  cssClasses: string;
  nearbyText: string;
  selectedText?: string;
  boundingBox: Box;
  accessibility: string;
  computedStyles: string;
  /** Missing on annotations saved before area-selection support. */
  targetType?: 'element' | 'region';
}

export type ContentMessage =
  | { type: 'COMPONENT_LENS_TOGGLE' }
  | { type: 'COMPONENT_LENS_OPEN' };

export interface PageStore {
  [url: string]: Annotation[];
}
