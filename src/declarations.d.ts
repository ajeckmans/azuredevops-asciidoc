declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.min.js' {
  const content: any;
  export default content;
}

declare module '*plantuml.js' {
  export function render(
    lines: string[],
    elementId: string,
    options?: { dark?: boolean; maxSvgSize?: number }
  ): void;

  export function renderToString(
    lines: string[],
    onSuccess: (svg: string) => void,
    onError: (err: any) => void,
    options?: { dark?: boolean; maxSvgSize?: number }
  ): void;
}



