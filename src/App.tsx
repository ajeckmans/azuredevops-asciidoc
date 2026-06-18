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

const App: React.FC = () => {
    const [files, setFiles] = React.useState<any[]>([]);
    const [threads, setThreads] = React.useState<any[]>([]);
    const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
    const [fileContent, setFileContent] = React.useState<string>("");
    const [loading, setLoading] = React.useState(true);
    const [addingCommentPath, setAddingCommentPath] = React.useState<string | null>(null);
    const [replyingToThread, setReplyingToThread] = React.useState<number | null>(null);

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
                } catch (e) {}

                if (defaultPath) {
                    setSelectedFile(defaultPath);
                    setAddingCommentPath(null);
                    setReplyingToThread(null);
                    setFileContent("Loading...");
                    try {
                        const content = await DevOpsService.getFileContent(repoId, project, defaultPath);
                        setFileContent(content);
                    } catch (err) {
                        setFileContent("Error loading file content.");
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

    const handleFileSelected = async (path: string) => {
        if (selectedFile !== path) {
            setSelectedFile(path);
            setAddingCommentPath(null);
            setReplyingToThread(null);
            setFileContent("Loading...");
            try {
                const repoId = await DevOpsService.getRepositoryId();
                const project = await DevOpsService.getProjectName();
                const content = await DevOpsService.getFileContent(repoId, project, path);
                setFileContent(content);
            } catch (err) {
                console.error("Error fetching content:", err);
                setFileContent("Error loading file content.");
            }
        }
    };

    const handleAddComment = (path: string) => {
        handleFileSelected(path);
        setAddingCommentPath(path);
    };

    const handleCommentSubmit = async (filePath: string, comment: string) => {
        try {
            const repoId = await DevOpsService.getRepositoryId();
            const project = await DevOpsService.getProjectName();
            await DevOpsService.createThread(repoId, project, filePath, comment);
            await loadThreads(repoId, project);
        } catch (err) {
            console.error("Error creating comment thread:", err);
            alert("Failed to add comment.");
        }
    };

    const handleReplySubmit = async (threadId: number, comment: string) => {
        try {
            const repoId = await DevOpsService.getRepositoryId();
            const project = await DevOpsService.getProjectName();
            await DevOpsService.createComment(repoId, project, threadId, comment);
            await loadThreads(repoId, project);
        } catch (err) {
            console.error("Error replying to thread:", err);
            alert("Failed to add reply.");
        }
    };

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
                                <div style={{ display: "flex", flexDirection: "column", maxWidth: "814px", width: "100%", margin: "0 auto" }}>
                                    {fileThreads.map(thread => (
                                        <Card key={thread.id} className="margin-bottom-16 flex-column depth-4">
                                            <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
                                                <div className="repos-monaco-discussion-host repos-editor-discussion-host flex-grow">
                                                <div className="flex-column rhythm-vertical-8">
                                                    <div className="repos-editor-discussion">
                                                        <div className="flex-grow repos-discussion-thread flex-column flex-grow scroll-hidden">
                                                            {thread.comments.map((comment: any, index: number) => {
                                                                const isFirst = index === 0;
                                                                const hasReplies = thread.comments.length > 1 && isFirst;
                                                                
                                                                let initials = "U";
                                                                if (comment.author?.displayName) {
                                                                    const parts = comment.author.displayName.split(" ");
                                                                    initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : comment.author.displayName.substring(0, 2).toUpperCase();
                                                                }
                                                                
                                                                let timeAgo = "Just now";
                                                                if (comment.publishedDate) {
                                                                    const diffInHours = Math.floor((new Date().getTime() - new Date(comment.publishedDate).getTime()) / (1000 * 60 * 60));
                                                                    timeAgo = diffInHours < 1 ? "Just now" : (diffInHours < 24 ? `${diffInHours}h ago` : `${Math.floor(diffInHours / 24)}d ago`);
                                                                }

                                                                return (
                                                                    <div key={comment.id} id={`comment-${comment.id}`} className="repos-comment-viewer" style={{ marginLeft: isFirst ? "0" : "32px", marginTop: isFirst ? "0" : "16px" }}>
                                                                        <div className={`repos-discussion-comment flex-column true ${hasReplies ? 'has-replies' : ''}`}>
                                                                            <div className="flex-column">
                                                                                <div className="flex-row">
                                                                                    <div>
                                                                                        <div className="bolt-coin flex-noshrink repos-comment-header-persona size24 cursor-pointer" tabIndex={0} role="button">
                                                                                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#107c41", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>
                                                                                                {initials}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="repos-comment-editor-fit flex-column flex-grow scroll-hidden padding-left-8">
                                                                                        <div className="repos-discussion-comment-header flex-row flex-grow flex-center rhythm-horizontal-4 margin-bottom-8">
                                                                                            <div className="scroll-hidden flex-row flex-center">
                                                                                                <span className="font-weight-semibold padding-right-8 text-ellipsis">{comment.author?.displayName || "Unknown User"}</span>
                                                                                                <div className="flex-row flex-center rhythm-horizontal-4 margin-left-4">
                                                                                                    <span className="text-ellipsis">
                                                                                                        <time className="body-s secondary-text margin-right-4 bolt-time-item white-space-nowrap">{timeAgo}</time>
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex-row flex-grow flex-noshrink justify-end flex-center">
                                                                                                <button className="comment-viewers bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="menuitem" tabIndex={0} type="button">
                                                                                                    <span className="fluent-icons-enabled"><span aria-hidden="true" className="left-icon flex-noshrink fabric-icon ms-Icon--Link medium"></span></span>
                                                                                                </button>
                                                                                                {isFirst && (
                                                                                                    <>
                                                                                                        <button className="comment-viewers bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="menuitem" tabIndex={0} type="button">
                                                                                                            <span className="fluent-icons-enabled"><span aria-hidden="true" className="left-icon flex-noshrink fabric-icon ms-Icon--PageCheckedin medium"></span></span>
                                                                                                        </button>
                                                                                                        <div className="bolt-dropdown-expandable bolt-expandable-button inline-flex-row">
                                                                                                            <button aria-expanded="false" aria-haspopup="true" className="bolt-button enabled subtle bolt-focus-treatment" role="button" tabIndex={0} type="button">
                                                                                                                <div className="bolt-dropdown-expandable-button-label justify-start flex-grow text-ellipsis">Active</div>
                                                                                                                <span className="fluent-icons-enabled"><span aria-hidden="true" className="icon-right font-weight-normal flex-noshrink fabric-icon ms-Icon--ChevronDownMed small"></span></span>
                                                                                                            </button>
                                                                                                        </div>
                                                                                                    </>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="markdown-content markdown-editor-preview repos-comment-editor-max-width markdown-preview-checkbox-indent">
                                                                                            <p>{comment.content}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            
                                                            <div className="repos-discussion-thread-reply flex-column" style={{ marginLeft: "32px", marginTop: "16px" }}>
                                                                <div className="flex-row flex-grow rhythm-horizontal-8">
                                                                    <div>
                                                                        <div className="bolt-coin flex-noshrink margin-right-4 margin-top-4 size24 cursor-pointer" tabIndex={0} role="button">
                                                                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#107c41", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>
                                                                                AJ
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex-row flex-grow flex-center rhythm-horizontal-8 repos-comment-editor-max-width">
                                                                        <div className="flex-column flex-grow padding-vertical-4">
                                                                            <div className="bolt-textfield flex-row flex-center focus-treatment">
                                                                                <input 
                                                                                    id={`reply-box-${thread.id}`}
                                                                                    className={`threadId-${thread.id} bolt-textfield-input flex-grow`}
                                                                                    style={{ backgroundColor: "transparent", color: "var(--text-primary-color, inherit)" }}
                                                                                    autoComplete="off" 
                                                                                    placeholder="Write a reply..." 
                                                                                    tabIndex={0} 
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            const val = (e.target as HTMLInputElement).value;
                                                                                            if (val) {
                                                                                                handleReplySubmit(thread.id, val);
                                                                                                (e.target as HTMLInputElement).value = "";
                                                                                            }
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <button 
                                                                            className="bolt-button enabled bolt-focus-treatment" 
                                                                            role="button" 
                                                                            tabIndex={0} 
                                                                            type="button"
                                                                            style={{ background: "rgba(0,0,0,0.06)", border: "none" }}
                                                                            onClick={() => {
                                                                                const input = document.getElementById(`reply-box-${thread.id}`) as HTMLInputElement;
                                                                                if (input && input.value) {
                                                                                    handleReplySubmit(thread.id, input.value);
                                                                                    input.value = "";
                                                                                }
                                                                            }}
                                                                        >
                                                                            Resolve
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
                                                                    <div className="flex-row flex-grow flex-center rhythm-horizontal-8 repos-comment-editor-max-width">
                                                                        <div className="flex-column flex-grow padding-vertical-4">
                                                                            <div className="bolt-textfield flex-row flex-center focus-treatment">
                                                                                <textarea 
                                                                                    id="pr-comment-box"
                                                                                    className="bolt-textfield-input flex-grow"
                                                                                    style={{ minHeight: "80px", resize: "vertical", backgroundColor: "transparent", color: "var(--text-primary-color, inherit)" }}
                                                                                    placeholder="Add a new comment..."
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
                                                                            onClick={() => setAddingCommentPath(null)} 
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button 
                                                                            className="bolt-button enabled primary bolt-focus-treatment"
                                                                            onClick={() => {
                                                                                const val = (document.getElementById("pr-comment-box") as HTMLTextAreaElement).value;
                                                                                if (val) {
                                                                                    handleCommentSubmit(selectedFile, val);
                                                                                    setAddingCommentPath(null);
                                                                                }
                                                                            }} 
                                                                        >
                                                                            Comment
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
                                            filePath={selectedFile} 
                                            onLinkClick={handleFileSelected}
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
