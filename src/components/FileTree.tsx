import * as React from "react";
import { Icon } from "azure-devops-ui/Icon";

export interface FileTreeProps {
    files: any[];
    threads: any[];
    selectedFile: string | null;
    onFileSelected: (path: string) => void;
    onAddComment: (path: string) => void;
}

export interface TreeNode {
    name: string;
    path: string;
    isFolder: boolean;
    children?: TreeNode[];
}

function buildTree(files: { path: string }[]): TreeNode[] {
    const root: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    files.forEach(file => {
        const cleanPath = file.path.startsWith("/") ? file.path.substring(1) : file.path;
        const parts = cleanPath.split("/");
        
        let currentLevel = root;
        let currentPath = "";

        parts.forEach((part, index) => {
            currentPath += (currentPath === "" ? "" : "/") + part;
            const isFolder = index < parts.length - 1;
            
            let existingNode = nodeMap.get(currentPath);
            
            if (!existingNode) {
                existingNode = {
                    name: part,
                    path: "/" + currentPath,
                    isFolder: isFolder,
                    children: isFolder ? [] : undefined
                };
                nodeMap.set(currentPath, existingNode);
                currentLevel.push(existingNode);
            }
            
            if (isFolder) {
                currentLevel = existingNode.children!;
            }
        });
    });

    return root;
}

const TreeNodeItem: React.FC<{
    node: TreeNode;
    depth: number;
    threads: any[];
    selectedFile: string | null;
    onFileSelected: (path: string) => void;
    onAddComment: (path: string) => void;
}> = ({ node, depth, threads, selectedFile, onFileSelected, onAddComment }) => {
    const [expanded, setExpanded] = React.useState(true);
    const [hover, setHover] = React.useState(false);
    const [menuOpen, setMenuOpen] = React.useState(false);

    const fileThreads = React.useMemo(() => {
        return threads.filter(t => t.threadContext && t.threadContext.filePath === node.path);
    }, [threads, node.path]);

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    const handleFileClick = () => {
        if (node.isFolder) {
            setExpanded(!expanded);
        } else {
            onFileSelected(node.path);
        }
    };

    const handleCommentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        onAddComment(node.path);
    };

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(!menuOpen);
    };

    return (
        <div>
            <div 
                style={{ 
                    position: "relative",
                    display: "flex", 
                    alignItems: "center", 
                    padding: "8px", 
                    paddingLeft: `${depth * 16 + 8}px`,
                    cursor: "pointer",
                    background: node.path === selectedFile ? "var(--palette-primary-tint-40, #eff6fc)" : (hover ? "var(--palette-neutral-4, #f4f4f4)" : "transparent"),
                    borderBottom: "1px solid transparent"
                }}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => { setHover(false); setMenuOpen(false); }}
                onClick={handleFileClick}
            >
                {node.path === selectedFile && (
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", backgroundColor: "#0078d4" }} />
                )}
                <div style={{ width: "16px", display: "flex", justifyContent: "center", marginRight: "4px" }}>
                    {node.isFolder ? (
                        <div onClick={toggleExpand}>
                            <Icon iconName={expanded ? "ChevronDown" : "ChevronRight"} />
                        </div>
                    ) : null}
                </div>
                <Icon iconName={node.isFolder ? "Folder" : "Page"} style={{ marginRight: "8px", color: node.isFolder ? "#dcb67a" : "inherit", fontSize: "16px" }} />
                <span style={{ flexGrow: 1, textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", fontSize: "14px", color: "#333" }}>{node.name}</span>
                
                {!node.isFolder && hover && (
                    <div 
                        onClick={handleCommentClick} 
                        style={{ 
                            marginLeft: "8px", 
                            padding: "0 6px", 
                            borderRadius: "10px", 
                            border: "1px solid #c8c8c8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            fontWeight: "bold",
                            color: "var(--text-primary-color, #333)",
                            background: "var(--component-bg, white)",
                            height: "20px"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--palette-neutral-4, #f4f4f4)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "var(--component-bg, white)"}
                        title="Add comment"
                    >
                        +
                    </div>
                )}
            </div>

            {!node.isFolder && expanded && fileThreads.length > 0 && (
                <div>
                    {fileThreads.map((thread: any) => {
                        const firstComment = thread.comments && thread.comments[0] ? thread.comments[0] : null;
                        if (!firstComment) return null;

                        return (
                            <div 
                                key={thread.id}
                                style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    padding: "6px 8px 6px 0", 
                                    paddingLeft: `${(depth + 1) * 16 + 32}px`, // indented past the icon
                                    cursor: "pointer",
                                    backgroundColor: "transparent",
                                    borderBottom: "1px solid transparent"
                                }}
                                onClick={() => onFileSelected(node.path)}
                            >
                                <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#107c41", color: "white", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "8px", flexShrink: 0, fontSize: "10px", fontWeight: "bold" }}>
                                    {firstComment.author?.displayName?.substring(0, 2).toUpperCase() || "U"}
                                </div>
                                <span style={{ flexGrow: 1, textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", fontSize: "14px", color: "#333" }}>
                                    {firstComment.content}
                                </span>
                                {thread.comments.length > 1 && (
                                    <span style={{ fontSize: "12px", color: "#666", marginLeft: "8px" }}>
                                        {thread.comments.length}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {node.isFolder && expanded && node.children && (
                <div>
                    {node.children.map(child => (
                        <TreeNodeItem 
                            key={child.path} 
                            node={child} 
                            depth={depth + 1} 
                            threads={threads}
                            selectedFile={selectedFile}
                            onFileSelected={onFileSelected} 
                            onAddComment={onAddComment} 
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FileTree: React.FC<FileTreeProps> = ({ files, threads, selectedFile, onFileSelected, onAddComment }) => {
    const tree = React.useMemo(() => buildTree(files), [files]);

    return (
        <div style={{ display: "flex", flexDirection: "column", padding: "8px 0" }}>
            {tree.map(node => (
                <TreeNodeItem 
                    key={node.path} 
                    node={node} 
                    depth={0} 
                    threads={threads}
                    selectedFile={selectedFile}
                    onFileSelected={onFileSelected} 
                    onAddComment={onAddComment} 
                />
            ))}
            {files.length === 0 && <div style={{ padding: "8px" }}>No AsciiDoc files found.</div>}
        </div>
    );
};
