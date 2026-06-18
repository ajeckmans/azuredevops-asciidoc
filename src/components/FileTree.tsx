import * as React from "react";
import { Tree } from "azure-devops-ui/TreeEx";
import { TreeItemProvider, ITreeItem, ITreeItemEx } from "azure-devops-ui/Utilities/TreeItemProvider";
import { ITreeColumn } from "azure-devops-ui/Components/TreeEx/Tree.Props";
import { renderExpandableTreeCell } from "azure-devops-ui/TreeEx";
import { ISimpleListCell, ListSelection } from "azure-devops-ui/List";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { ISimpleTableCell } from "azure-devops-ui/Table";

export interface FileTreeProps {
    files: any[];
    threads: any[];
    selectedFile: string | null;
    onFileSelected: (path: string) => void;
    onAddComment: (path: string) => void;
}

export interface FileItemData extends ISimpleTableCell {
    [key: string]: any;
    name: ISimpleListCell;
    path: string;
    isFolder: boolean;
    isComment?: boolean;
    commentData?: any;
    threads?: any[];
}

function buildTreeItems(files: { path: string }[], threads: any[]): ITreeItem<FileItemData>[] {
    const root: ITreeItem<FileItemData>[] = [];
    const nodeMap = new Map<string, ITreeItem<FileItemData>>();

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
                const nodePath = "/" + currentPath;
                const newNode: ITreeItem<FileItemData> = {
                    data: {
                        name: {
                            text: part,
                            iconProps: {
                                iconName: isFolder ? "FabricFolderFill" : "Page",
                                className: "icon-margin medium",
                                style: { color: isFolder ? "#dcb67a" : "inherit" }
                            }
                        },
                        path: nodePath,
                        isFolder: isFolder,
                    },
                    expanded: isFolder ? true : undefined,
                    childItems: isFolder ? [] : undefined
                };
                existingNode = newNode;
                
                if (!isFolder) {
                    const fileThreads = threads.filter(t => t.threadContext && t.threadContext.filePath === nodePath);
                    if (fileThreads.length > 0) {
                        existingNode.childItems = fileThreads.map(thread => {
                            const firstComment = thread.comments && thread.comments[0] ? thread.comments[0] : null;
                            const initials = firstComment?.author?.displayName?.substring(0, 2).toUpperCase() || "U";
                            
                            return {
                                data: {
                                    name: {
                                        text: firstComment ? `${firstComment.author.displayName}: ${firstComment.content}` : "Thread",
                                        textNode: (
                                            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                                                <div style={{ width: "22px", height: "22px", borderRadius: "50%", backgroundColor: "#107c41", color: "white", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "8px", flexShrink: 0, fontSize: "10px", fontWeight: "bold" }}>
                                                    {initials}
                                                </div>
                                                <span className="text-ellipsis" style={{ flexGrow: 1 }}>
                                                    {firstComment ? firstComment.content : "Thread"}
                                                </span>
                                            </div>
                                        )
                                    },
                                    path: nodePath,
                                    isFolder: false,
                                    isComment: true,
                                    commentData: firstComment,
                                    threads: thread.comments
                                }
                            } as ITreeItem<FileItemData>;
                        }).filter(item => item.data.commentData !== null);
                        
                        if (existingNode.childItems!.length > 0) {
                            existingNode.expanded = true;
                        } else {
                            existingNode.childItems = undefined;
                        }
                    }
                }
                
                nodeMap.set(currentPath, existingNode);
                currentLevel.push(existingNode);
            }
            
            if (isFolder && existingNode.childItems) {
                currentLevel = existingNode.childItems;
            }
        });
    });

    return root;
}

export const FileTree: React.FC<FileTreeProps> = ({ files, threads, selectedFile, onFileSelected, onAddComment }) => {
    const [itemProvider] = React.useState(new TreeItemProvider<FileItemData>());
    const [selection] = React.useState(new ListSelection({ selectOnFocus: false, multiSelect: false }));

    React.useEffect(() => {
        if (!selectedFile) {
            selection.clear();
            return;
        }
        
        let foundIndex = -1;
        for (let i = 0; i < itemProvider.value.length; i++) {
            const item = itemProvider.value[i];
            if (item && item.underlyingItem && item.underlyingItem.data) {
                const data = item.underlyingItem.data;
                if (!data.isFolder && data.path === selectedFile) {
                    foundIndex = i;
                    break;
                }
            }
        }
        
        if (foundIndex >= 0) {
            selection.select(foundIndex, 1, true);
        } else {
            selection.clear();
        }
    }, [selectedFile, itemProvider.value.length, selection, itemProvider]);

    React.useEffect(() => {
        const items = buildTreeItems(files, threads);
        itemProvider.clear();
        itemProvider.splice(undefined, [], [{ items }]);
    }, [files, threads, itemProvider]);

    const columns = React.useMemo((): ITreeColumn<FileItemData>[] => [
        {
            id: "name",
            width: new ObservableValue(-100),
            hierarchical: true,
            indentationSize: 16,
            renderCell: (rowIndex, columnIndex, treeColumn, treeItem) => {
                const data = treeItem.underlyingItem.data;
                const isSelected = selectedFile === data.path;

                // Create a clone of the name ISimpleListCell to inject our custom buttons without mutating the base data
                const nameCell: ISimpleListCell = {
                    ...data.name,
                    textClassName: isSelected ? "fontWeightSemiBold" : undefined,
                    textNode: (
                        <div className="flex-row flex-center" style={{ width: "100%", justifyContent: "space-between" }}>
                            <div className="flex-row flex-center text-ellipsis" style={{ overflow: "hidden" }}>
                                {data.name.textNode || <span className="text-ellipsis">{data.name.text}</span>}
                            </div>
                            
                            <div className="flex-row flex-center flex-noshrink" style={{ position: "absolute", right: "16px", backgroundColor: "var(--component-bg, transparent)" }}>
                                {data.threads && data.threads.length > 1 && (
                                    <span className="secondary-text body-s" style={{ marginRight: "8px" }}>
                                        {data.threads.length}
                                    </span>
                                )}
                                {!data.isFolder && !data.isComment && (
                                    <div 
                                        className={`bolt-pill flex-row flex-center outlined compact tree-plus-btn ${isSelected ? 'is-selected' : ''}`}
                                        style={{ cursor: "pointer", width: "24px", height: "24px" }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAddComment(data.path);
                                        }}
                                    >
                                        <div className="bolt-pill-content text-ellipsis">+</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                };

                // We temporarily swap the data out for rendering to pass the dynamically generated textNode
                const originalName = data.name;
                data.name = nameCell;
                
                const renderedCell = renderExpandableTreeCell(
                    rowIndex,
                    columnIndex,
                    treeColumn,
                    treeItem
                );

                // Restore original
                data.name = originalName;

                return renderedCell;
            }
        }
    ], [selectedFile, onAddComment]);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
            <style>{`
                .tree-plus-btn { opacity: 0; pointer-events: none; transition: opacity 0.2s; }
                .bolt-list-row:hover .tree-plus-btn, .tree-plus-btn.is-selected { opacity: 1; pointer-events: auto; }
            `}</style>
            <Tree<FileItemData>
                columns={columns}
                itemProvider={itemProvider as any}
                selection={selection as any}
                scrollable={false}
                showHeader={false}
                showLines={false}
                singleClickActivation={true}
                onSelect={(event, treeRow) => {
                    const data = treeRow.data.underlyingItem.data;
                    if (!data.isFolder) {
                        onFileSelected(data.path);
                    }
                }}
            />
        </div>
    );
};
