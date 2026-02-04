import { Node } from "./type";
import { mockData } from "./data";

export const getChildren = (nodeId: string = "categories"): Promise<Node[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockData[nodeId] || []);
    }, 500);
  });
};

export const getPathToNode = (nodeId: string): Promise<Node[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const path: Node[] = [];
      let currentId: string | null = nodeId;
      while (currentId) {
        for (const key in mockData) {
          const node = mockData[key].find((n) => n.id === currentId);
          if (node) {
            path.unshift(node);
            currentId = node.parentId;
            break;
          }
        }
      }
      resolve(path);
    }, 500);
  });
};
