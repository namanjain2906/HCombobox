import { useState, useEffect } from "react";
import { getChildren, getPathToNode } from "./apis";
import { Node } from "./type";

const ComboBox = () => {
  const [searchText, setSearchText] = useState("");
  const [rootProducts, setRootProducts] = useState<Node[]>([]);
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<Record<string, Node[]>>({});
  const [checkedNodes, setCheckedNodes] = useState<Set<string>>(new Set());
  const [foundResults, setFoundResults] = useState<Node[]>([]);
  const [resultPaths, setResultPaths] = useState<Record<string, Node[]>>({});
  const [keyboardFocus, setKeyboardFocus] = useState(0);

  //   Getting first products
  useEffect(() => {
    getChildren().then((data) => {
      setRootProducts(data);
    });
  }, []);

  // Search when user types
  useEffect(() => {
    if (searchText.trim() === "") {
      setFoundResults([]);
      setResultPaths({});
      return;
    }
    searchInTree();
  }, [searchText]);

  // Keyboard navigation check
  useEffect(() => {
    const visible = getAllVisibleNodes();
    if (keyboardFocus >= visible.length) {
      setKeyboardFocus(Math.max(0, visible.length - 1));
    }
  }, [openNodes, rootProducts, loadedChildren, foundResults, keyboardFocus]);


  const searchInTree = async () => {
    const results: Node[] = [];
    const paths: Record<string, Node[]> = {};
    const searchQuery = searchText.toLowerCase();

    const getChildrenFromCacheOrAPI = async (
      nodeId: string,
    ): Promise<Node[]> => {
      if (loadedChildren[nodeId]) {
        return loadedChildren[nodeId];
      }

      const children = await getChildren(nodeId);
      setLoadedChildren((prev) => ({ ...prev, [nodeId]: children }));
      return children;
    };

    // Recursively search all nodes
    const searchRecursively = async (parentId: string = "categories") => {
      const nodes = await getChildrenFromCacheOrAPI(parentId);

      for (const node of nodes) {
        const labelLower = node.label.toLowerCase();

        // Check if this node matches the search
        if (labelLower.startsWith(searchQuery) || labelLower === searchQuery) {
          results.push(node);
          const path = await getPathToNode(node.id);
          paths[node.id] = path;
        }

        // Search children too
        if (node.hasChildren) {
          await searchRecursively(node.id);
        }
      }
    };

    await searchRecursively();
    setFoundResults(results);
    setResultPaths(paths);
  };

  // Get all currently visible nodes (for keyboard navigation)
  const getAllVisibleNodes = (): Node[] => {
    // If searching, show search results
    if (searchText.trim() !== "") {
      const visible: Node[] = [];

      foundResults.forEach((result) => {
        const path = resultPaths[result.id] || [];
        path.forEach((node) => {
          // Add unique nodes only
          if (!visible.find((n) => n.id === node.id)) {
            visible.push(node);
          }
        });
      });

      return visible;
    }

    // Otherwise show expanded tree
    const visible: Node[] = [];

    const addNodeAndChildren = (nodes: Node[]) => {
      nodes.forEach((node) => {
        visible.push(node);

        // If expanded, add its children
        if (openNodes.has(node.id)) {
          const children = loadedChildren[node.id] || [];
          addNodeAndChildren(children);
        }
      });
    };

    addNodeAndChildren(rootProducts);
    return visible;
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const visibleNodes = getAllVisibleNodes();
    const currentNode = visibleNodes[keyboardFocus];

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setKeyboardFocus(Math.min(keyboardFocus + 1, visibleNodes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setKeyboardFocus(Math.max(keyboardFocus - 1, 0));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      // Expand if has children and not expanded
      if (currentNode?.hasChildren && !openNodes.has(currentNode.id)) {
        toggleNode(currentNode.id);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      // Collapse if has children and is expanded
      if (currentNode?.hasChildren && openNodes.has(currentNode.id)) {
        toggleNode(currentNode.id);
      }
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (currentNode) {
        const isCurrentlyChecked = currentNode.hasChildren
          ? areAllChildrenChecked(currentNode.id)
          : checkedNodes.has(currentNode.id);

        toggleCheckbox(
          currentNode.id,
          !isCurrentlyChecked,
          currentNode.hasChildren,
        );
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSearchText("");
      setKeyboardFocus(0);
    }
  };

  // Toggle node expansion (open/close)
  const toggleNode = async (nodeId: string) => {
    const isCurrentlyOpen = openNodes.has(nodeId);

    if (!isCurrentlyOpen) {
      // Load children if not loaded
      if (!loadedChildren[nodeId]) {
        const children = await getChildren(nodeId);
        setLoadedChildren((prev) => ({ ...prev, [nodeId]: children }));
      }

      // Open node
      setOpenNodes((prev) => new Set([...prev, nodeId]));
    } else {
      // Close node
      setOpenNodes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  };

  // Check if a single node is checked
  const isNodeChecked = (nodeId: string): boolean => {
    return checkedNodes.has(nodeId);
  };

  // Check if all children of a node are checked
  const areAllChildrenChecked = (nodeId: string): boolean => {
    const children = loadedChildren[nodeId] || [];
    if (children.length === 0) return false;

    return children.every((child) => checkedNodes.has(child.id));
  };

  // Toggle checkbox for a node
  const toggleCheckbox = async (
    nodeId: string,
    shouldCheck: boolean,
    hasChildren: boolean,
  ) => {
    if (hasChildren) {
      // Load all descendants first
      const allChildren = await loadAllDescendants(nodeId);
      checkOrUncheckAllDescendants(nodeId, shouldCheck, allChildren);
    } else {
      // Simple toggle for leaf node
      setCheckedNodes((prev) => {
        const newSet = new Set(prev);
        if (shouldCheck) {
          newSet.add(nodeId);
        } else {
          newSet.delete(nodeId);
        }
        return newSet;
      });
    }
  };

  // Load all descendants of a node recursively
  const loadAllDescendants = async (
    nodeId: string,
  ): Promise<Record<string, Node[]>> => {
    const cache = { ...loadedChildren };

    const loadRecursively = async (id: string) => {
      if (!cache[id]) {
        const children = await getChildren(id);
        cache[id] = children;

        // Load grandchildren
        for (const child of children) {
          if (child.hasChildren) {
            await loadRecursively(child.id);
          }
        }
      }
    };

    await loadRecursively(nodeId);
    setLoadedChildren(cache);
    return cache;
  };

  // Check or uncheck all descendants of a node
  const checkOrUncheckAllDescendants = (
    nodeId: string,
    shouldCheck: boolean,
    cache: Record<string, Node[]>,
  ) => {
    setCheckedNodes((prev) => {
      const newSet = new Set(prev);

      // Add or remove the parent node
      if (shouldCheck) {
        newSet.add(nodeId);
      } else {
        newSet.delete(nodeId);
      }

      // Recursively add or remove all children
      const processChildren = (id: string) => {
        const children = cache[id] || [];
        children.forEach((child) => {
          if (shouldCheck) {
            newSet.add(child.id);
          } else {
            newSet.delete(child.id);
          }

          if (child.hasChildren) {
            processChildren(child.id);
          }
        });
      };

      processChildren(nodeId);
      return newSet;
    });
  };

  // Render a single node in the tree
  const renderTreeNode = (node: Node, indentLevel: number = 0) => {
    const isOpen = openNodes.has(node.id);
    const children = loadedChildren[node.id] || [];
    const isSingleNodeChecked = isNodeChecked(node.id);
    const allChildrenChecked = areAllChildrenChecked(node.id);
    const shouldShowAsChecked = node.hasChildren
      ? allChildrenChecked
      : isSingleNodeChecked;

    // Find this node's position in visible list for keyboard focus
    const visibleNodes = getAllVisibleNodes();
    const nodePosition = visibleNodes.findIndex((n) => n.id === node.id);
    const hasKeyboardFocus = nodePosition === keyboardFocus;

    return (
      <div key={node.id}>
        <div
          style={{ marginLeft: `${indentLevel * 24}px` }}
          className={`flex items-center gap-2 py-1 rounded ${
            hasKeyboardFocus ? "bg-blue-200" : "hover:bg-gray-100"
          }`}
        >
          {/* Expand/collapse arrow */}
          {node.hasChildren && (
            <span
              onClick={() => toggleNode(node.id)}
              className="cursor-pointer text-xl"
            >
              {isOpen ? "▾" : "▸"}
            </span>
          )}
          {!node.hasChildren && <span className="text-xl w-5"></span>}

          {/* Checkbox */}
          <input
            id={`checkbox-${node.id}`}
            type="checkbox"
            checked={shouldShowAsChecked}
            onChange={(e) =>
              toggleCheckbox(node.id, e.target.checked, node.hasChildren)
            }
            aria-label={node.label}
          />


          <label htmlFor={`checkbox-${node.id}`} className="cursor-pointer">{node.label}</label>
        </div>


        {isOpen && children.length > 0 && (
          <div>
            {children.map((child) => renderTreeNode(child, indentLevel + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render search results with their paths
  const renderSearchResults = () => {
    return foundResults.map((result) => {
      const path = resultPaths[result.id] || [];

      return (
        <div key={result.id} className="mb-4">
          {path.map((node, index) => {
            const isLastInPath = index === path.length - 1;

            // Find keyboard focus position
            const visibleNodes = getAllVisibleNodes();
            const nodePosition = visibleNodes.findIndex(
              (n) => n.id === node.id,
            );
            const hasKeyboardFocus = nodePosition === keyboardFocus;

            return (
              <div key={node.id}>
                <div
                  style={{ marginLeft: `${index * 24}px` }}
                  className={`flex items-center gap-2 py-1 rounded ${
                    hasKeyboardFocus ? "bg-blue-200" : "hover:bg-gray-100"
                  }`}
                >
                  {/* Arrow indicator */}
                  {node.hasChildren ? (
                    <span className="text-xl">▾</span>
                  ) : (
                    <span className="text-xl w-5"></span>
                  )}

                  {/* Checkbox */}
                  <input
                    id={`checkbox-${node.id}`}
                    type="checkbox"
                    checked={
                      node.hasChildren
                        ? areAllChildrenChecked(node.id)
                        : isNodeChecked(node.id)
                    }
                    onChange={(e) =>
                      toggleCheckbox(
                        node.id,
                        e.target.checked,
                        node.hasChildren,
                      )
                    }
                    disabled={!isLastInPath}
                    aria-label={node.label}
                  />

                  {/* Label */}
                  <label
                    htmlFor={`checkbox-${node.id}`}
                    className={`cursor-pointer ${isLastInPath ? "font-semibold" : ""}`}
                  >
                    {node.label}
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div
      className="p-8 border-2 border-[#A3C6E5] focus:outline-none rounded-2xl"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Search input */}
      <form>
        <input
          type="text"
          className="py-2 px-4 rounded-4xl border-2 border-[#A3C6E5] focus:outline-none focus:bg-[#E6F0FA]"
          placeholder="Search for products"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setKeyboardFocus(0);
          }}
        />
      </form>

      {/* Results area */}
      <div className="mt-4">
        {searchText.trim() !== "" ? (
          // Show search results
          <>
            {foundResults.length > 0 ? (
              <div>{renderSearchResults()}</div>
            ) : (
              <p className="text-gray-500">No results found</p>
            )}
          </>
        ) : (
          // Show normal tree
          rootProducts.map((product) => renderTreeNode(product, 0))
        )}
      </div>
    </div>
  );
};

export default ComboBox;
