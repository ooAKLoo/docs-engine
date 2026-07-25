declare module '@docusaurus/Head' {
  const Head: import('react').ComponentType<Record<string, unknown>>;
  export default Head;
}

declare module '@theme/Admonition' {
  const Admonition: import('react').ComponentType<Record<string, unknown>>;
  export default Admonition;
}

declare module '@theme/MDXComponents/A' {
  const Component: import('react').ComponentType<Record<string, unknown>>;
  export default Component;
}

declare module '@theme/MDXComponents/Code' {
  const Component: import('react').ComponentType<Record<string, unknown>>;
  export default Component;
}

declare module '@theme/MDXComponents/Details' {
  const Component: import('react').ComponentType<Record<string, unknown>>;
  export default Component;
}

declare module '@theme/MDXComponents/Heading' {
  const Component: import('react').ComponentType<Record<string, unknown>>;
  export default Component;
}

declare module '@theme/MDXComponents/Img' {
  const Component: import('react').ComponentType<Record<string, unknown>>;
  export default Component;
}

declare module '@theme/MDXComponents/Li' {
  const Component: import('react').ComponentType<Record<string, unknown>>;
  export default Component;
}

declare module '@theme/MDXComponents/Pre' {
  const Component: import('react').ComponentType<Record<string, unknown>>;
  export default Component;
}

declare module '@theme/MDXComponents/Ul' {
  const Component: import('react').ComponentType<Record<string, unknown>>;
  export default Component;
}

declare module '@theme/DocItem/Content' {
  export type Props = {
    children?: import('react').ReactNode;
  };
  const Component: import('react').ComponentType<Props>;
  export default Component;
}

declare module '@theme/Heading' {
  const Component: import('react').ComponentType<
    Record<string, unknown> & {as?: string; children?: import('react').ReactNode}
  >;
  export default Component;
}

declare module '@theme/MDXContent' {
  const Component: import('react').ComponentType<{
    children?: import('react').ReactNode;
  }>;
  export default Component;
}

declare module '@docusaurus/plugin-content-docs/client' {
  export function useDoc(): {
    contentTitle?: string;
    frontMatter: {
      hide_title?: boolean;
    };
    metadata: {
      title: string;
    };
  };
}
