import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function CrosshairIcon(props: IconProps) {
  return <svg {...baseProps} {...props}><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>;
}

export function CopyIcon(props: IconProps) {
  return <svg {...baseProps} {...props}><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
}

export function PauseIcon(props: IconProps) {
  return <svg {...baseProps} {...props}><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></svg>;
}

export function PlayIcon(props: IconProps) {
  return <svg {...baseProps} {...props}><path d="m5 3 14 9-14 9V3z"/></svg>;
}

export function TrashIcon(props: IconProps) {
  return <svg {...baseProps} {...props}><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/></svg>;
}

export function XIcon(props: IconProps) {
  return <svg {...baseProps} {...props}><path d="M18 6 6 18M6 6l12 12"/></svg>;
}

export function CheckIcon(props: IconProps) {
  return <svg {...baseProps} {...props}><path d="m20 6-11 11-5-5"/></svg>;
}
