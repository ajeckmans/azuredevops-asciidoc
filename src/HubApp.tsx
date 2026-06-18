import * as React from "react";
import { DevOpsService } from "./services/DevOpsService";
import { AsciiDocRenderer } from "./components/AsciiDocRenderer";
import { Icon } from "azure-devops-ui/Icon";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Page } from "azure-devops-ui/Page";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IHostNavigationService } from "azure-devops-extension-api";

import { Tree } from "azure-devops-ui/TreeEx";
import { TreeItemProvider, ITreeItem, ITreeItemEx } from "azure-devops-ui/Utilities/TreeItemProvider";
import { ITreeColumn } from "azure-devops-ui/Components/TreeEx/Tree.Props";
import { renderExpandableTreeCell } from "azure-devops-ui/TreeEx";
import { ISimpleListCell, ListSelection } from "azure-devops-ui/List";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { ISimpleTableCell } from "azure-devops-ui/Table";

interface HubItemData extends ISimpleTableCell {
    [key: string]: any;
    name: ISimpleListCell;
    path: string;
    repoId: string;
    isFolder: boolean;
    isRepo: boolean;
}

function buildRepoTreeItems(files: any[], repoId: string): ITreeItem<HubItemData>[] {
    const root: ITreeItem<HubItemData>[] = [];
    const nodeMap = new Map<string, ITreeItem<HubItemData>>();

    files.forEach(file => {
        const cleanPath = file.path.startsWith("/") ? file.path.substring(1) : file.path;
        const parts = cleanPath.split("/");
        
        let currentLevel = root;
        let currentPath = "";

        parts.forEach((part: string, index: number) => {
            currentPath += (currentPath === "" ? "" : "/") + part;
            const isFolder = index < parts.length - 1;
            
            let existingNode = nodeMap.get(currentPath);
            
            if (!existingNode) {
                existingNode = {
                    data: {
                        name: {
                            text: part,
                            iconProps: {
                                iconName: isFolder ? "FabricFolderFill" : "TextDocument",
                                className: "icon-margin medium",
                                style: { color: isFolder ? "#dcb67a" : "inherit" }
                            }
                        },
                        path: "/" + currentPath,
                        repoId: repoId,
                        isFolder: isFolder,
                        isRepo: false
                    },
                    expanded: isFolder ? true : undefined,
                    childItems: isFolder ? [] : undefined
                };
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

export default function HubApp() {
    const [repos, setRepos] = React.useState<any[]>([]);
    const [repoFiles, setRepoFiles] = React.useState<{ [repoId: string]: any[] }>({});
    const [loading, setLoading] = React.useState(true);
    const [loadingMessage, setLoadingMessage] = React.useState("Loading repositories...");
    const [selectedFile, setSelectedFile] = React.useState<{ repoId: string, path: string } | null>(null);
    const [fileContent, setFileContent] = React.useState("");
    const [expandedNodes, setExpandedNodes] = React.useState<{ [key: string]: boolean }>({});
    
    const [itemProvider] = React.useState(new TreeItemProvider<HubItemData>());
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
                if (!data.isFolder && data.repoId === selectedFile.repoId && data.path === selectedFile.path) {
                    foundIndex = i;
                    break;
                }
            }
        }
        
        if (foundIndex >= 0) {
            selection.select(foundIndex, 1, true); // 1 = count, true = clear existing selection
        } else {
            selection.clear();
        }
    }, [selectedFile, itemProvider.length, selection, itemProvider]);

    React.useEffect(() => {
        async function load() {
            try {
                const projectName = await DevOpsService.getProjectName();
                const allRepos = await DevOpsService.getRepositories(projectName);
                
                let globalState = await DevOpsService.getGlobalRepoState();
                const oneHour = 60 * 60 * 1000;
                const now = Date.now();

                let needsFullScan = false;
                if (!globalState || !globalState.lastScanned || (now - globalState.lastScanned > oneHour)) {
                    needsFullScan = true;
                    globalState = { lastScanned: now, reposWithAsciidoc: [], scannedRepoIds: [] };
                }

                const reposToScan: any[] = [];
                const scannedIdsSet = new Set(globalState.scannedRepoIds);
                for (const repo of allRepos) {
                    if (needsFullScan || !scannedIdsSet.has(repo.id)) {
                        reposToScan.push(repo);
                    }
                }

                if (reposToScan.length > 0) {
                    setLoadingMessage(`Scanning ${reposToScan.length} repositories for AsciiDoc files...`);
                    
                    const batchSize = 5;
                    for (let i = 0; i < reposToScan.length; i += batchSize) {
                        const batch = reposToScan.slice(i, i + batchSize);
                        await Promise.all(batch.map(async (repo) => {
                            if (repo.defaultBranch) {
                                const files = await DevOpsService.getRepoAsciiDocFiles(repo.id, projectName, repo.defaultBranch);
                                globalState.scannedRepoIds.push(repo.id);
                                if (files && files.length > 0) {
                                    globalState.reposWithAsciidoc.push(repo.id);
                                }
                            } else {
                                globalState.scannedRepoIds.push(repo.id);
                            }
                        }));
                    }
                    
                    globalState.reposWithAsciidoc = Array.from(new Set(globalState.reposWithAsciidoc));
                    globalState.scannedRepoIds = Array.from(new Set(globalState.scannedRepoIds));
                    await DevOpsService.setGlobalRepoState(globalState);
                }

                const reposWithAsciidocSet = new Set(globalState.reposWithAsciidoc);
                const finalRepos = allRepos.filter(r => reposWithAsciidocSet.has(r.id));
                finalRepos.sort((a, b) => a.name.localeCompare(b.name));
                setRepos(finalRepos);

                const navService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
                const queryParams = await navService.getQueryParams();
                const targetRepoId = queryParams.repoId;
                let targetPath = queryParams.path;
                
                if (targetPath && targetPath.includes('%2F')) {
                    targetPath = decodeURIComponent(targetPath);
                }

                if (targetRepoId && targetPath) {
                    const targetRepo = finalRepos.find(r => r.id === targetRepoId);
                    if (targetRepo) {
                        setExpandedNodes(prev => ({ ...prev, [targetRepo.id]: true }));
                        if (targetRepo.defaultBranch) {
                            const files = await DevOpsService.getRepoAsciiDocFiles(targetRepo.id, projectName, targetRepo.defaultBranch);
                            setRepoFiles(prev => ({ ...prev, [targetRepo.id]: files || [] }));
                            const formattedPath = targetPath.startsWith('/') ? targetPath : '/' + targetPath;
                            setSelectedFile({ repoId: targetRepo.id, path: formattedPath });
                        }
                    }
                } else if (finalRepos.length > 0) {
                    const firstRepo = finalRepos[0];
                    setExpandedNodes(prev => ({ ...prev, [firstRepo.id]: true }));
                    if (firstRepo.defaultBranch) {
                        const files = await DevOpsService.getRepoAsciiDocFiles(firstRepo.id, projectName, firstRepo.defaultBranch);
                        setRepoFiles(prev => ({ ...prev, [firstRepo.id]: files || [] }));
                    }
                }
            } catch (e) {
                console.error("Failed to load hub data", e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleFileSelected = React.useCallback(async (repoId: string, path: string) => {
        setSelectedFile({ repoId, path });
        try {
            const navService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
            navService.setQueryParams({ repoId: repoId, path: path });
        } catch (e) {
            console.error("Failed to update query params", e);
        }
    }, []);

    React.useEffect(() => {
        async function loadContent() {
            if (selectedFile) {
                const projectName = await DevOpsService.getProjectName();
                const content = await DevOpsService.getRepoFileContent(selectedFile.repoId, projectName, selectedFile.path);
                setFileContent(content);
            }
        }
        loadContent();
    }, [selectedFile]);

    React.useEffect(() => {
        const items: ITreeItem<HubItemData>[] = repos.map(repo => {
            const isExpanded = !!expandedNodes[repo.id];
            const files = repoFiles[repo.id] || [];
            
            return {
                data: {
                    name: {
                        text: repo.name,
                        iconProps: {
                            iconName: "Repo",
                            className: "icon-margin medium",
                            style: { color: "var(--text-secondary-color, #666)" }
                        }
                    },
                    path: "",
                    repoId: repo.id,
                    isFolder: true,
                    isRepo: true
                },
                expanded: isExpanded,
                childItems: isExpanded ? buildRepoTreeItems(files, repo.id) : []
            };
        });
        
        itemProvider.clear();
        itemProvider.splice(undefined, [], [{ items }]);
    }, [repos, repoFiles, expandedNodes, itemProvider]);

    const handleToggle = async (event: any, treeItem: ITreeItemEx<HubItemData>) => {
        const data = treeItem.underlyingItem.data;
        if (data.isRepo) {
            const repoId = data.repoId;
            const isNowExpanded = !treeItem.underlyingItem.expanded;
            
            setExpandedNodes(prev => ({ ...prev, [repoId]: isNowExpanded }));
            
            if (isNowExpanded && !repoFiles[repoId]) {
                const repo = repos.find(r => r.id === repoId);
                if (repo && repo.defaultBranch) {
                    const projectName = await DevOpsService.getProjectName();
                    const files = await DevOpsService.getRepoAsciiDocFiles(repo.id, projectName, repo.defaultBranch);
                    setRepoFiles(prev => ({ ...prev, [repoId]: files || [] }));
                } else if (repo && !repo.defaultBranch) {
                    setRepoFiles(prev => ({ ...prev, [repoId]: [] }));
                }
            }
        } else {
            itemProvider.toggle(treeItem.underlyingItem);
        }
    };

    const columns = React.useMemo((): ITreeColumn<HubItemData>[] => [
        {
            id: "name",
            width: new ObservableValue(-100),
            hierarchical: true,
            indentationSize: 16,
            renderCell: (rowIndex, columnIndex, treeColumn, treeItem) => {
                const data = treeItem.underlyingItem.data;
                const isSelected = selectedFile?.repoId === data.repoId && selectedFile?.path === data.path;

                // Create clone for dynamic states
                const nameCell: ISimpleListCell = {
                    ...data.name,
                    textClassName: isSelected || data.isRepo ? "fontWeightSemiBold" : undefined
                };

                const originalName = data.name;
                data.name = nameCell;

                const renderedCell = renderExpandableTreeCell(
                    rowIndex,
                    columnIndex,
                    treeColumn,
                    treeItem
                );

                data.name = originalName;

                return renderedCell;
            }
        }
    ], [selectedFile]);

    return (
        <div className="flex-grow flex-column" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <Surface background={SurfaceBackground.neutral}>
            <Page className="flex-grow flex-column">
            <div style={{ display: "flex", flex: 1, overflow: "hidden", borderTop: "1px solid var(--palette-neutral-8, #eaeaea)" }}>
                <div style={{ width: "300px", borderRight: "1px solid var(--palette-neutral-8, #eaeaea)", display: "flex", flexDirection: "column", background: "transparent" }}>
                    {loading ? (
                        <div style={{ padding: "16px", color: "var(--text-secondary-color, #666)" }}>{loadingMessage}</div>
                    ) : repos.length === 0 ? (
                        <div style={{ padding: "16px", color: "var(--text-secondary-color, #666)" }}>No AsciiDoc files found in any repositories.</div>
                    ) : (
                        <Tree<HubItemData>
                            columns={columns}
                            itemProvider={itemProvider as any}
                            selection={selection as any}
                            scrollable={true}
                            showHeader={false}
                            showLines={false}
                            singleClickActivation={true}
                            onToggle={handleToggle as any}
                            onSelect={(event, treeRow) => {
                                const data = treeRow.data.underlyingItem.data;
                                if (!data.isFolder) {
                                    handleFileSelected(data.repoId, data.path);
                                } else if (!data.isRepo) {
                                    itemProvider.toggle(treeRow.data.underlyingItem);
                                } else {
                                    handleToggle(event, treeRow.data);
                                }
                            }}
                        />
                    )}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden"  }}>
                    {selectedFile ? (
                        <div style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column" }}>
                            <div style={{ 
                                background: "transparent",
                                borderRadius: "4px", 
                                boxShadow: "0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--palette-neutral-8, #eaeaea)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <div style={{ display: "flex", alignItems: "center" }}>
                                            <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary-color, #333)", marginRight: "8px" }}>{selectedFile.path.split('/').pop()}</span>
                                        </div>
                                        <span style={{ fontSize: "12px", color: "var(--text-secondary-color, #666)", marginTop: "4px" }}>
                                            {repos.find(r => r.id === selectedFile.repoId)?.name} {selectedFile.path}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    <AsciiDocRenderer 
                                        content={fileContent} 
                                        filePath={selectedFile.path} 
                                        onLinkClick={(newPath) => {
                                            handleFileSelected(selectedFile.repoId, newPath);
                                        }}
                                        fetchFileContent={async (path) => {
                                            try {
                                                const projectName = await DevOpsService.getProjectName();
                                                return await DevOpsService.getRepoFileContent(selectedFile.repoId, projectName, path);
                                            } catch (e) {
                                                console.error("Failed to fetch included file:", path, e);
                                                return null;
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: "16px", color: "var(--text-secondary-color, #666)" }}>
                            Select an AsciiDoc file from the repository tree to view its content.
                        </div>
                    )}
                </div>
            </div>
            </Page>
            </Surface>
        </div>
    );
}
