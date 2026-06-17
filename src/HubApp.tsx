import * as React from "react";
import { DevOpsService } from "./services/DevOpsService";
import { AsciiDocRenderer } from "./components/AsciiDocRenderer";
import { Icon } from "azure-devops-ui/Icon";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Page } from "azure-devops-ui/Page";

export default function HubApp() {
    const [repos, setRepos] = React.useState<any[]>([]);
    const [repoFiles, setRepoFiles] = React.useState<{ [repoId: string]: any[] }>({});
    const [loading, setLoading] = React.useState(true);
    const [loadingMessage, setLoadingMessage] = React.useState("Loading repositories...");
    const [selectedFile, setSelectedFile] = React.useState<{ repoId: string, path: string } | null>(null);
    const [fileContent, setFileContent] = React.useState("");
    const [expandedNodes, setExpandedNodes] = React.useState<{ [key: string]: boolean }>({});

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
                                globalState.scannedRepoIds.push(repo.id); // Empty repo, still scanned
                            }
                        }));
                    }
                    
                    globalState.reposWithAsciidoc = Array.from(new Set(globalState.reposWithAsciidoc));
                    globalState.scannedRepoIds = Array.from(new Set(globalState.scannedRepoIds));
                    await DevOpsService.setGlobalRepoState(globalState);
                }

                const finalRepos = allRepos.filter(r => globalState.reposWithAsciidoc.includes(r.id));
                finalRepos.sort((a, b) => a.name.localeCompare(b.name));
                setRepos(finalRepos);

                // Auto-expand and load the first repository if it exists
                if (finalRepos.length > 0) {
                    const firstRepo = finalRepos[0];
                    setExpandedNodes({ [firstRepo.id]: true });
                    if (firstRepo.defaultBranch) {
                        const files = await DevOpsService.getRepoAsciiDocFiles(firstRepo.id, projectName, firstRepo.defaultBranch);
                        setRepoFiles({ [firstRepo.id]: files || [] });
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

    const toggleExpand = async (nodeId: string, isRepo: boolean = false) => {
        const isNowExpanded = !expandedNodes[nodeId];
        setExpandedNodes(prev => ({ ...prev, [nodeId]: isNowExpanded }));

        if (isRepo && isNowExpanded && !repoFiles[nodeId]) {
            const repo = repos.find(r => r.id === nodeId);
            if (repo && repo.defaultBranch) {
                const projectName = await DevOpsService.getProjectName();
                const files = await DevOpsService.getRepoAsciiDocFiles(repo.id, projectName, repo.defaultBranch);
                setRepoFiles(prev => ({ ...prev, [nodeId]: files || [] }));
            } else if (repo && !repo.defaultBranch) {
                setRepoFiles(prev => ({ ...prev, [nodeId]: [] })); // Empty repo
            }
        }
    };

    const buildTree = (files: any[]) => {
        const root: any = { isFolder: true, children: {}, path: "" };
        files.forEach(f => {
            const parts = f.path.split('/').filter((p: string) => p);
            let current = root;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFile = i === parts.length - 1;
                if (!current.children[part]) {
                    current.children[part] = {
                        name: part,
                        path: parts.slice(0, i + 1).join('/'),
                        isFolder: !isFile,
                        children: {}
                    };
                }
                current = current.children[part];
            }
        });
        return root;
    };

    const renderTreeNodes = (node: any, repoId: string, depth: number) => {
        const children = Object.values(node.children || {}).sort((a: any, b: any) => {
            if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
            return a.isFolder ? -1 : 1;
        });

        return children.map((child: any) => {
            const nodeId = `${repoId}:${child.path}`;
            const isExpanded = expandedNodes[nodeId];
            const isSelected = selectedFile?.repoId === repoId && selectedFile?.path === "/" + child.path;

            return (
                <div key={nodeId}>
                    <div 
                        style={{ 
                            position: "relative",
                            display: "flex", 
                            alignItems: "center", 
                            padding: "8px", 
                            paddingLeft: `${depth * 16 + 8}px`,
                            cursor: "pointer",
                            backgroundColor: isSelected ? "#eff6fc" : "transparent",
                            borderBottom: "1px solid transparent"
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "#f4f4f4"; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                        onClick={() => {
                            if (child.isFolder) toggleExpand(nodeId);
                            else setSelectedFile({ repoId, path: "/" + child.path });
                        }}
                    >
                        {isSelected && (
                            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", backgroundColor: "#0078d4" }} />
                        )}
                        <div style={{ width: "16px", display: "flex", justifyContent: "center", marginRight: "4px" }}>
                            {child.isFolder ? (
                                <div onClick={(e) => { e.stopPropagation(); toggleExpand(nodeId); }}>
                                    <Icon iconName={isExpanded ? "ChevronDown" : "ChevronRight"} />
                                </div>
                            ) : null}
                        </div>
                        <Icon iconName={child.isFolder ? "Folder" : "Page"} style={{ marginRight: "8px", color: child.isFolder ? "#dcb67a" : "inherit", fontSize: "16px" }} />
                        <span style={{ flexGrow: 1, textOverflow: "ellipsis", whiteSpace: "nowrap", overflow: "hidden", fontSize: "14px", color: "#333" }}>{child.name}</span>
                    </div>
                    {child.isFolder && isExpanded && renderTreeNodes(child, repoId, depth + 1)}
                </div>
            );
        });
    };

    return (
        <div className="flex-grow flex-column" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <Surface background={SurfaceBackground.neutral}>
            <Page className="flex-grow flex-column">
            <div style={{ display: "flex", flex: 1, overflow: "hidden", borderTop: "1px solid #eaeaea" }}>
                <div style={{ width: "300px", borderRight: "1px solid #eaeaea", display: "flex", flexDirection: "column", background: "var(--component-bg, white)", overflowY: "auto" }}>
                    {loading ? (
                        <div style={{ padding: "16px", color: "#666" }}>{loadingMessage}</div>
                    ) : repos.length === 0 ? (
                        <div style={{ padding: "16px", color: "#666" }}>No AsciiDoc files found in any repositories.</div>
                    ) : (
                        repos.map(repo => {
                            const isExpanded = expandedNodes[repo.id];
                            const tree = buildTree(repoFiles[repo.id] || []);
                            
                            return (
                                <div key={repo.id}>
                                    <div 
                                        style={{ 
                                            display: "flex", 
                                            alignItems: "center", 
                                            padding: "8px", 
                                            cursor: "pointer",
                                            fontWeight: "600",
                                            background: "var(--component-bg, white)",
                                            borderBottom: "1px solid #eaeaea",
                                            transition: "background-color 0.2s"
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--palette-neutral-4, #f4f4f4)"}
                                        onMouseLeave={(e) => e.currentTarget.style.background = "var(--component-bg, white)"}
                                        onClick={() => toggleExpand(repo.id, true)}
                                    >
                                        <div style={{ width: "16px", display: "flex", justifyContent: "center", marginRight: "8px" }}>
                                            <Icon iconName={isExpanded ? "ChevronDown" : "ChevronRight"} />
                                        </div>
                                        <Icon iconName="Repo" style={{ marginRight: "8px", fontSize: "16px", color: "#666" }} />
                                        <span style={{ fontSize: "14px", color: "#333" }}>{repo.name}</span>
                                    </div>
                                    {isExpanded && renderTreeNodes(tree, repo.id, 1)}
                                </div>
                            );
                        })
                    )}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden"  }}>
                    {selectedFile ? (
                        <div style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column" }}>
                            <div style={{ 
                                background: "var(--component-bg, white)",
                                borderRadius: "4px", 
                                boxShadow: "0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaeaea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <div style={{ display: "flex", alignItems: "center" }}>
                                            <span style={{ fontSize: "14px", fontWeight: "600", color: "#333", marginRight: "8px" }}>{selectedFile.path.split('/').pop()}</span>
                                        </div>
                                        <span style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                                            {repos.find(r => r.id === selectedFile.repoId)?.name} {selectedFile.path}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column" }}>
                                    <AsciiDocRenderer 
                                        content={fileContent} 
                                        filePath={selectedFile.path} 
                                        onLinkClick={() => {}}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: "16px", color: "#666" }}>
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
