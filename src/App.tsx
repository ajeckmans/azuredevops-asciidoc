import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IHostNavigationService } from "azure-devops-extension-api";

import { Header } from "azure-devops-ui/Header";
import { Surface, SurfaceBackground } from "azure-devops-ui/Surface";
import { Page } from "azure-devops-ui/Page";
import { Card } from "azure-devops-ui/Card";
import { DevOpsService } from "./services/DevOpsService";
import { FileTree } from "./components/FileTree";
import { AsciiDocRenderer } from "./components/AsciiDocRenderer";
import { DiscussionThread } from "./components/DiscussionThread";

const App: React.FC = () => {
    const [files, setFiles] = React.useState<any[]>([]);
    const [threads, setThreads] = React.useState<any[]>([]);
    const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
    const [fileContent, setFileContent] = React.useState<string>("");
    const [previousFileContent, setPreviousFileContent] = React.useState<string>("");
    const [loading, setLoading] = React.useState(true);
    const [addingCommentPath, setAddingCommentPath] = React.useState<string | null>(null);
    const [replyingToThread, setReplyingToThread] = React.useState<number | null>(null);
    const [isSubmittingComment, setIsSubmittingComment] = React.useState(false);
    const [submittingReplyId, setSubmittingReplyId] = React.useState<number | null>(null);

    const currentUserInitials = React.useMemo(() => {
        try {
            const user = SDK.getUser();
            if (user && user.displayName) {
                const parts = user.displayName.split(" ");
                return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : user.displayName.substring(0, 2).toUpperCase();
            }
        } catch (e) { }
        return "U";
    }, []);

    const loadThreads = async (repoId: string, project: string) => {
        try {
            const allThreads = await DevOpsService.getThreads(repoId, project);
            setThreads(allThreads);
        } catch (err) {
            console.error("Error loading threads:", err);
        }
    };

    React.useEffect(() => {
        const init = async () => {
            try {
                const repoId = await DevOpsService.getRepositoryId();
                const project = await DevOpsService.getProjectName();
                const docFiles = await DevOpsService.getAsciiDocFiles(repoId, project);
                setFiles(docFiles);
                await loadThreads(repoId, project);

                let defaultPath = null;
                try {
                    const navService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
                    const hash = await navService.getHash();
                    if (hash && hash.startsWith("path=")) {
                        defaultPath = decodeURIComponent(hash.substring(5));
                    }
                } catch (e) {
                    console.warn("Failed to get navigation hash:", e);
                }

                if (defaultPath) {
                    setSelectedFile(defaultPath);
                    setAddingCommentPath(null);
                    setReplyingToThread(null);
                    setFileContent("Loading...");
                    try {
                        const [content, prevContent] = await Promise.all([
                            DevOpsService.getFileContent(repoId, project, defaultPath),
                            DevOpsService.getPreviousFileContent(repoId, project, defaultPath)
                        ]);
                        setFileContent(content);
                        setPreviousFileContent(prevContent);
                    } catch (err) {
                        setFileContent("Error loading file content.");
                        setPreviousFileContent("");
                    }
                }
            } catch (err) {
                console.error("Error fetching files:", err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // ⚡ Bolt: Memoize event handlers to maintain stable references for React.memo child components
    const handleFileSelected = React.useCallback(async (path: string) => {
        if (selectedFile !== path) {
            setSelectedFile(path);
            setAddingCommentPath(null);
            setReplyingToThread(null);
            setFileContent("Loading...");
            try {
                const repoId = await DevOpsService.getRepositoryId();
                const project = await DevOpsService.getProjectName();
                const [content, prevContent] = await Promise.all([
                    DevOpsService.getFileContent(repoId, project, path),
                    DevOpsService.getPreviousFileContent(repoId, project, path)
                ]);
                setFileContent(content);
                setPreviousFileContent(prevContent);
            } catch (err) {
                console.error("Error fetching content:", err);
                setFileContent("Error loading file content.");
                setPreviousFileContent("");
            }
        }
    }, [selectedFile]);

    const handleAddComment = React.useCallback((path: string) => {
        handleFileSelected(path);
        setAddingCommentPath(path);
    }, [handleFileSelected]);

    const handleCommentSubmit = async (filePath: string, comment: string) => {
        try {
            setIsSubmittingComment(true);
            const repoId = await DevOpsService.getRepositoryId();
            const project = await DevOpsService.getProjectName();
            await DevOpsService.createThread(repoId, project, filePath, comment);
            await loadThreads(repoId, project);
            setAddingCommentPath(null);
        } catch (err) {
            console.error("Error creating comment thread:", err);
            alert("Failed to add comment.");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleReplySubmit = async (threadId: number, comment: string) => {
        try {
            setSubmittingReplyId(threadId);
            const repoId = await DevOpsService.getRepositoryId();
            const project = await DevOpsService.getProjectName();
            await DevOpsService.createComment(repoId, project, threadId, comment);
            await loadThreads(repoId, project);
            const input = document.getElementById(`reply-box-${threadId}`) as HTMLInputElement;
            if (input) {
                input.value = "";
            }
        } catch (err) {
            console.error("Error replying to thread:", err);
            alert("Failed to add reply.");
        } finally {
            setSubmittingReplyId(null);
        }
    };

    // ⚡ Bolt: Memoize fetchFileContent to prevent expensive AsciiDocRenderer re-renders
    // on unrelated state changes (like adding comments). Expected impact: Eliminates
    // synchronous main-thread blocking operations when typing/adding comments.
    const fetchFileContent = React.useCallback(async (path: string) => {
        try {
            const repoId = await DevOpsService.getRepositoryId();
            const project = await DevOpsService.getProjectName();
            return await DevOpsService.getFileContent(repoId, project, path);
        } catch (e) {
            console.error("Failed to fetch included file:", path, e);
            return null;
        }
    }, []);

    const fileThreads = selectedFile ? threads.filter(t => t.threadContext.filePath === selectedFile) : [];

    return (
        <div className="flex-grow flex-column" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
<Surface background={SurfaceBackground.neutral}>
<Page className="flex-grow flex-column">
            <div style={{ display: "flex", flex: 1, overflow: "hidden", borderTop: "1px solid var(--palette-neutral-8, #eaeaea)" }}>
                <div style={{ width: "300px", flexShrink: 0, overflow: "auto", borderRight: "1px solid var(--palette-neutral-8, #eaeaea)",  }}>
                    {loading ? (
                        <div style={{ padding: "16px" }}>Loading files...</div>
                    ) : (
                        <FileTree files={files} threads={threads} selectedFile={selectedFile} onFileSelected={handleFileSelected} onAddComment={handleAddComment} />
                    )}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",  }}>
                    {selectedFile ? (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
                            {/* File Header */}
                            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--palette-neutral-8, #eaeaea)", display: "flex", alignItems: "center", background: "var(--background-color, #fff)", position: "sticky", top: 0, zIndex: 10 }}>
                                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                    <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary-color, #333)" }}>{selectedFile.split('/').pop()}</span>
                                    <span style={{ fontSize: "12px", color: "var(--text-secondary-color, #666)", marginTop: "2px" }}>{selectedFile}</span>
                                </div>
                                <div style={{ flex: 1 }} />
                                {addingCommentPath === selectedFile && (
                                    <div className="bolt-pill themed-standard" style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "600", color: "#107c41", background: "rgba(16, 124, 65, 0.1)" }}>
                                        Drafting new comment...
                                    </div>
                                )}
                            </div>

                            <div style={{ padding: "16px", display: "flex", flexDirection: "column", flex: 1 }}>
                                <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                                    {fileThreads.map(thread => (
                                        <DiscussionThread 
                                            key={thread.id}
                                            thread={thread}
                                            currentUserInitials={currentUserInitials}
                                            submittingReplyId={submittingReplyId}
                                            onReplySubmit={handleReplySubmit}
                                        />
                                    ))}

                                    {addingCommentPath === selectedFile && (
                                        <Card className="margin-bottom-16 flex-column depth-4">
                                            <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
                                                <div className="repos-monaco-discussion-host repos-editor-discussion-host flex-grow">
                                                    <div className="flex-column rhythm-vertical-8">
                                                        <div className="repos-editor-discussion">
                                                        <div className="flex-grow repos-discussion-thread flex-column flex-grow scroll-hidden">
                                                            <div className="repos-discussion-thread-reply flex-column" style={{ border: "none" }}>
                                                                <div className="flex-row flex-grow rhythm-horizontal-8 padding-8">
                                                                    <div>
                                                                        <div className="bolt-coin flex-noshrink margin-right-4 margin-top-4 size24" aria-hidden="true">
                                                                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#107c41", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>
                                                                                {currentUserInitials}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex-row flex-grow flex-center rhythm-horizontal-8 repos-comment-editor-max-width">
                                                                        <div className="flex-column flex-grow padding-vertical-4">
                                                                            <div className="bolt-textfield flex-row flex-center focus-treatment">
                                                                                <textarea 
                                                                                    id="pr-comment-box"
                                                                                    className="bolt-textfield-input flex-grow"
                                                                                    style={{ minHeight: "80px", resize: "vertical", backgroundColor: "transparent", color: "var(--text-primary-color, inherit)", opacity: isSubmittingComment ? 0.6 : 1 }}
                                                                                    placeholder="Add a new comment..."
                                                                                    aria-label="Add a new comment"
                                                                                    disabled={isSubmittingComment}
                                                                                    autoFocus
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex-row justify-end padding-8">
                                                                    <div style={{ display: "flex", gap: "8px" }}>
                                                                        <button 
                                                                            className="bolt-button enabled subtle bolt-focus-treatment"
                                                                            disabled={isSubmittingComment}
                                                                            style={{ opacity: isSubmittingComment ? 0.6 : 1, cursor: isSubmittingComment ? "not-allowed" : "pointer" }}
                                                                            onClick={() => setAddingCommentPath(null)} 
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button 
                                                                            className="bolt-button enabled primary bolt-focus-treatment"
                                                                            disabled={isSubmittingComment}
                                                                            style={{ opacity: isSubmittingComment ? 0.6 : 1, cursor: isSubmittingComment ? "not-allowed" : "pointer" }}
                                                                            onClick={() => {
                                                                                const val = (document.getElementById("pr-comment-box") as HTMLTextAreaElement).value;
                                                                                if (val) {
                                                                                    handleCommentSubmit(selectedFile, val);
                                                                                }
                                                                            }} 
                                                                        >
                                                                            {isSubmittingComment ? "Commenting..." : "Comment"}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    )}

                                    <div style={{ padding: "16px 0" }}>
                                        <AsciiDocRenderer 
                                            content={fileContent} 
                                            previousContent={previousFileContent}
                                            filePath={selectedFile} 
                                            onLinkClick={handleFileSelected}
                                            fetchFileContent={fetchFileContent}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: "16px", color: "var(--text-secondary-color, #666)" }}>
                            Select an AsciiDoc file from the tree to view its content.
                        </div>
                    )}
                </div>
            </div>
        </Page>
        </Surface>
        </div>
    );
};

export default App;
