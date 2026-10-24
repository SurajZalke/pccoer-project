/// <reference types="react-scripts" />

declare namespace JSX {
  interface IntrinsicElements {
    iframe: React.DetailedHTMLProps<React.IframeHTMLAttributes<HTMLIFrameElement>, HTMLIFrameElement> & {
      playsInline?: boolean;
    };
  }
}