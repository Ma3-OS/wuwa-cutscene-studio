import React, { useState, useMemo, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Layers,
  HardDrive,
} from "lucide-react";

export interface TreeNode {
  name: string;
  fullPath: string;
  count: number;
  directCount: number;
  children: TreeNode[];
}

export interface DynamicFolderTreeProps {
  items: Array<{
    folderName?: string;
    categoryFolder?: string;
    isCached?: boolean;
  }>;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  className?: string;
}

/**
 * Builds a dynamic hierarchy tree from cutscene folder paths.
 * Enforces Guardrail 3 (Prune empty branches) and Guardrail 4 (Normalized '/' separators).
 */
export function buildFolderTree(
  items: Array<{ categoryFolder?: string; folderName?: string }>
): TreeNode[] {
  interface MutableNode {
    name: string;
    fullPath: string;
    directCount: number;
    children: Map<string, MutableNode>;
  }

  const rootChildren = new Map<string, MutableNode>();

  for (const item of items) {
    const rawPath = item.categoryFolder || item.folderName || "";
    // Guardrail 4: Normalize all path separators to '/' and trim
    let normalized = rawPath
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "")
      .trim();

    if (
      !normalized ||
      normalized === "คลังในเครื่อง" ||
      normalized.includes(":") ||
      normalized.toLowerCase().includes("export") ||
      normalized.toLowerCase().includes("cache") ||
      normalized.toLowerCase().includes("cutscenes")
    ) {
      continue;
    }

    // Unify Sequence -> Movies to merge cutscene story branches
    normalized = normalized.replace(/\/Sequence\//g, "/Movies/");
    if (normalized.startsWith("Sequence/")) {
      normalized = `Movies/${normalized.slice(9)}`;
    } else if (normalized.startsWith("Aki/Sequence/")) {
      normalized = `Aki/Movies/${normalized.slice(13)}`;
    }

    // Strip /Main/ from /Main/03_x
    normalized = normalized.replace(/\/Main\//g, "/");
    if (normalized.endsWith("/Main")) {
      normalized = normalized.slice(0, -5);
    }

    // Strip per-cutscene leaf folder such as M0388, C0030, P0056, CE
    const normParts = normalized.split("/");
    const lastNormPart = normParts[normParts.length - 1];
    if (
      /^[MCPE]\d+/i.test(lastNormPart) ||
      lastNormPart === "CE"
    ) {
      normParts.pop();
      normalized = normParts.join("/");
    }

    const gamePath = normalized.startsWith("Aki/")
      ? normalized
      : normalized.startsWith("Movies/") ||
        normalized.startsWith("Level") ||
        normalized.startsWith("Quest") ||
        normalized.startsWith("Vision")
      ? `Aki/${normalized}`
      : "";

    if (!gamePath) continue;

    const parts = gamePath.split("/").filter(Boolean);
    let currentMap = rootChildren;
    let accumulatedPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;

      let node = currentMap.get(part);
      if (!node) {
        node = {
          name: part,
          fullPath: accumulatedPath,
          directCount: 0,
          children: new Map(),
        };
        currentMap.set(part, node);
      }

      if (i === parts.length - 1) {
        node.directCount += 1;
      }
      currentMap = node.children;
    }
  }

  function finalize(mNode: MutableNode): TreeNode | null {
    const children: TreeNode[] = [];
    let totalCount = mNode.directCount;

    for (const child of mNode.children.values()) {
      const finalizedChild = finalize(child);
      if (finalizedChild && finalizedChild.count > 0) {
        children.push(finalizedChild);
        totalCount += finalizedChild.count;
      }
    }

    // Guardrail 3: Prune empty branches with 0 items
    if (totalCount === 0) {
      return null;
    }

    // Sort folders with natural numeric ordering
    children.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );

    return {
      name: mNode.name,
      fullPath: mNode.fullPath,
      count: totalCount,
      directCount: mNode.directCount,
      children,
    };
  }

  const result: TreeNode[] = [];
  for (const node of rootChildren.values()) {
    const finalized = finalize(node);
    if (finalized) {
      result.push(finalized);
    }
  }

  result.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  );
  return result;
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedPath: string;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  onSelectPath: (path: string) => void;
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  depth,
  selectedPath,
  expandedPaths,
  onToggleExpand,
  onSelectPath,
}) => {
  const isSelected = selectedPath === node.fullPath;
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = node.children.length > 0;

  const handleRowClick = () => {
    onSelectPath(node.fullPath);
    if (hasChildren && !isExpanded) {
      onToggleExpand(node.fullPath);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(node.fullPath);
    }
  };

  return (
    <div className="flex flex-col select-none">
      <div
        onClick={handleRowClick}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        className={`h-7 pr-2 rounded-md flex items-center justify-between text-xs transition-colors cursor-pointer group outline-none ${
          isSelected
            ? "bg-white/[0.10] text-white font-medium"
            : "text-[#8E8E93] hover:text-white hover:bg-white/[0.03]"
        }`}
        title={node.fullPath}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
          {/* Chevron for expandable nodes */}
          {hasChildren ? (
            <button
              type="button"
              onClick={handleChevronClick}
              className="w-4 h-4 -ml-1 rounded flex items-center justify-center text-[#71717A] hover:text-white transition-colors"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 stroke-[1.25] text-[#A1A1AA]" />
              ) : (
                <ChevronRight className="w-3 h-3 stroke-[1.25] text-[#71717A]" />
              )}
            </button>
          ) : (
            <span className="w-4 h-4 -ml-1 shrink-0" />
          )}

          {/* Folder Icon */}
          {isExpanded && hasChildren ? (
            <FolderOpen
              className={`w-3.5 h-3.5 shrink-0 stroke-[1.5] ${
                isSelected ? "text-white" : "text-[#A1A1AA]"
              }`}
            />
          ) : (
            <Folder
              className={`w-3.5 h-3.5 shrink-0 stroke-[1.5] ${
                isSelected ? "text-white" : "text-[#71717A]"
              }`}
            />
          )}

          {/* Folder Label */}
          <span className="truncate text-[11px] tracking-tight">{node.name}</span>
        </div>

        {/* Total Count Badge */}
        <span
          className={`text-[10px] font-mono px-1 rounded shrink-0 ${
            isSelected
              ? "text-white/80 bg-white/[0.08]"
              : "text-[#52525B] group-hover:text-[#71717A]"
          }`}
        >
          {node.count}
        </span>
      </div>

      {/* Render Sub-nodes */}
      {isExpanded && hasChildren && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeItem
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onSelectPath={onSelectPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DynamicFolderTree: React.FC<DynamicFolderTreeProps> = ({
  items,
  selectedPath,
  onSelectPath,
  className = "",
}) => {
  const treeNodes = useMemo(() => buildFolderTree(items), [items]);

  // Count total and cached cutscenes
  const totalCount = items.length;
  const cachedCount = useMemo(
    () => items.filter((item) => item.isCached).length,
    [items]
  );

  // Auto-expand hierarchy nodes by default (up to level 3)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const node of treeNodes) {
      initial.add(node.fullPath);
      for (const child of node.children) {
        initial.add(child.fullPath);
        for (const grandchild of child.children) {
          initial.add(grandchild.fullPath);
        }
      }
    }
    return initial;
  });

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <div className={`flex flex-col space-y-0.5 select-none ${className}`}>
      {/* Root Node: All Cutscenes */}
      <button
        type="button"
        onClick={() => onSelectPath("all")}
        className={`w-full h-7.5 px-2 rounded-md flex items-center justify-between text-xs transition-colors cursor-pointer outline-none ${
          selectedPath === "all"
            ? "bg-white/[0.10] text-white font-medium"
            : "text-[#8E8E93] hover:text-white hover:bg-white/[0.03]"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Layers
            className={`w-3.5 h-3.5 shrink-0 ${
              selectedPath === "all" ? "text-white" : "text-[#71717A]"
            }`}
          />
          <span className="truncate text-[11px] tracking-tight">คัตซีนทั้งหมด</span>
        </div>
        <span
          className={`text-[10px] font-mono px-1 rounded ${
            selectedPath === "all"
              ? "text-white/80 bg-white/[0.08]"
              : "text-[#52525B]"
          }`}
        >
          {totalCount}
        </span>
      </button>

      {/* Cached Offline Archive (if any items cached) */}
      {cachedCount > 0 && (
        <button
          type="button"
          onClick={() => onSelectPath("cached")}
          className={`w-full h-7.5 px-2 rounded-md flex items-center justify-between text-xs transition-colors cursor-pointer outline-none ${
            selectedPath === "cached"
              ? "bg-white/[0.10] text-white font-medium"
              : "text-[#8E8E93] hover:text-white hover:bg-white/[0.03]"
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <HardDrive
              className={`w-3.5 h-3.5 shrink-0 ${
                selectedPath === "cached" ? "text-white" : "text-[#71717A]"
              }`}
            />
            <span className="truncate text-[11px] tracking-tight">คลังในเครื่อง</span>
          </div>
          <span
            className={`text-[10px] font-mono px-1 rounded ${
              selectedPath === "cached"
                ? "text-white/80 bg-white/[0.08]"
                : "text-[#52525B]"
            }`}
          >
            {cachedCount}
          </span>
        </button>
      )}

      {/* Hierarchy Section Divider */}
      <div className="pt-2 pb-1 px-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#52525B] tracking-wider uppercase">
          โครงสร้างโฟลเดอร์เกม
        </span>
      </div>


      {/* Recursive Dynamic Tree Branches */}
      <div className="space-y-0.5">
        {treeNodes.map((node) => (
          <TreeItem
            key={node.fullPath}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            onToggleExpand={handleToggleExpand}
            onSelectPath={onSelectPath}
          />
        ))}
      </div>
    </div>
  );
};
