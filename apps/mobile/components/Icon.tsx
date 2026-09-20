import type { SVGProps } from 'react';

const paths = {
  home:'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  sparkles:'m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  layers:'M12 3 2 9l10 6 10-6z M2 13l10 6 10-6 M2 17l10 6 10-6',
  calendar:'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8 14h3 M8 18h3',
  user:'M20 21a8 8 0 0 0-16 0 M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  back:'m15 18-6-6 6-6', forward:'m9 18 6-6-6-6', arrow:'M4 12h16 m-7-7 7 7-7 7',
  gift:'M4 11h16v10H4z M2 7h20v4H2z M12 7v14 M12 7C7 7 5 6 5 4s2-3 4-2 3 5 3 5z M12 7c5 0 7-1 7-3s-2-3-4-2-3 5-3 5z',
  pin:'M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z M12 10a2.5 2.5 0 1 0 0 .01',
  clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  star:'m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-4.9 6.9-1z',
  chat:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z M8 11h9 M8 15h5',
  refresh:'M20 11a8 8 0 0 0-14-5L3 9 M3 3v6h6 M4 13a8 8 0 0 0 14 5l3-3 M21 21v-6h-6',
  check:'m5 12 4 4L19 6',
  search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z m6-2 5 5',
  shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z m-4-10 3 3 5-6',
  info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 11v6 M12 7h.01',
  image:'M3 3h18v18H3z M7.5 9a1 1 0 1 0 2 0 1 1 0 0 0-2 0z m-4.5 9 5-5 4 4 4-5 5 6',
  logout:'M10 3H4v18h6 M13 7l5 5-5 5 M6 12h12',
  sliders:'M4 7h16 M4 17h16 M9 4v6 M15 14v6',
} as const;
export type IconName=keyof typeof paths;
export function Icon({name,size=20,...props}:{name:IconName;size?:number}&Omit<SVGProps<SVGSVGElement>,'name'>){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}><path d={paths[name]}/></svg>}
