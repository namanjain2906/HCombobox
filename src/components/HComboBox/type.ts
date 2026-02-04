export interface Node {
  id: string;
  label: string;
  hasChildren: boolean;
  parentId: string | null;
  expanded: boolean;
}