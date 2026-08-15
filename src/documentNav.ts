export type DocumentNavItem = {
  id: string;
  title: string;
  href: string;
};

export type DocumentNavGroup = {
  key: string;
  label: string;
  items: DocumentNavItem[];
};
