import * as React from "react";

import { Header } from "azure-devops-ui/Header";
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
            <div style={{ display: "flex", flex: 1, overflow: "hidden", borderTop: "1px solid #eaeaea" }}>
                <div style={{ width: "300px", flexShrink: 0, overflow: "auto", borderRight: "1px solid #eaeaea", backgroundColor: "#faf9f8" }}>
                    {loading ? (
                        <div style={{ padding: "16px" }}>Loading files...</div>
                    ) : (
                        <FileTree files={files} threads={threads} selectedFile={selectedFile} onFileSelected={handleFileSelected} onAddComment={handleAddComment} />
                    )}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#f3f2f1" }}>
                    {selectedFile ? (
                        <div style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column" }}>
                            <div style={{ 
                                backgroundColor: "white", 
                                borderRadius: "4px", 
                                boxShadow: "0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <div style={{ padding: "12px 16px", borderBottom: "1px solid #eaeaea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <div style={{ display: "flex", alignItems: "center" }}>
                                            <span style={{ fontSize: "14px", fontWeight: "600", color: "#333", marginRight: "8px" }}>{selectedFile.split('/').pop()}</span>
                                            {addingCommentPath === selectedFile && (
                                                <span style={{ fontSize: "12px", color: "#107c41", fontWeight: "bold" }}>+ new comment</span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>{selectedFile}</span>
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column" }}>
                                {fileThreads.map(thread => (
                                    <div key={thread.id} style={{ margin: "16px 16px 0 16px", padding: "12px 16px", border: "1px solid #eaeaea", backgroundColor: "#faf9f8", borderRadius: "2px" }}>
                                        {thread.comments.map((comment: any, index: number) => (
                                            <div key={comment.id} style={{ display: "flex", flexDirection: "column", paddingBottom: "16px", marginBottom: index < thread.comments.length - 1 ? "16px" : "12px", borderBottom: index < thread.comments.length - 1 ? "1px solid #eaeaea" : "none" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div style={{ display: "flex", alignItems: "center" }}>
                                                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#107c41", color: "white", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px", flexShrink: 0, fontSize: "10px", fontWeight: "bold" }}>
                                                            {comment.author?.displayName?.substring(0, 2).toUpperCase() || "U"}
                                                        </div>
                                                        <span style={{ fontWeight: 600, fontSize: "14px", color: "#333" }}>{comment.author?.displayName || "Unknown User"}</span>
                                                        <span style={{ fontSize: "12px", color: "#666", marginLeft: "12px" }}>
                                                            {comment.publishedDate ? new Date(comment.publishedDate).toLocaleDateString() : "Just now"}
                                                        </span>
                                                    </div>
                                                    {index === 0 && (
                                                        <div style={{ display: "flex", alignItems: "center", fontSize: "12px", fontWeight: "600", color: "#333" }}>
                                                            Active
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: "14px", color: "#333", marginLeft: "36px", marginTop: "8px" }}>
                                                    {comment.content}
                                                </div>
                                            </div>
                                        ))}

                                        <div style={{ display: "flex", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #eaeaea" }}>
                                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#107c41", color: "white", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "12px", flexShrink: 0, fontSize: "10px", fontWeight: "bold" }}>
                                                U
                                            </div>
                                            <input 
                                                id={`reply-box-${thread.id}`}
                                                type="text"
                                                style={{ flex: 1, padding: "6px 12px", border: "1px solid #c8c8c8", borderRadius: "2px", fontSize: "14px", backgroundColor: "white", outline: "none", fontFamily: "inherit" }}
                                                placeholder="Write a reply..."
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
                                            <button 
                                                style={{ backgroundColor: "#f3f2f1", color: "#333", border: "1px solid #c8c8c8", padding: "5px 16px", borderRadius: "2px", marginLeft: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}
                                                onClick={() => {
                                                    const input = document.getElementById(`reply-box-${thread.id}`) as HTMLInputElement;
                                                    if (input && input.value) {
                                                        handleReplySubmit(thread.id, input.value);
                                                        input.value = "";
                                                    }
                                                }} 
                                            >
                                                Reply
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {addingCommentPath === selectedFile && (
                                    <div style={{ margin: "16px 16px 0 16px", padding: "12px 16px", border: "1px solid #0078d4", backgroundColor: "white", borderRadius: "2px", boxShadow: "0 0 4px rgba(0,120,212,0.3)" }}>
                                        <textarea 
                                            id="pr-comment-box"
                                            style={{ width: "100%", minHeight: "80px", padding: "8px", border: "none", outline: "none", resize: "vertical", fontFamily: "inherit", fontSize: "14px", backgroundColor: "transparent" }}
                                            placeholder="Add a new comment..."
                                            autoFocus
                                        />
                                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px", borderTop: "1px solid #eaeaea", paddingTop: "8px" }}>
                                            <button 
                                                style={{ backgroundColor: "transparent", color: "#333", border: "none", padding: "6px 16px", borderRadius: "2px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}
                                                onClick={() => setAddingCommentPath(null)} 
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                style={{ backgroundColor: "#0078d4", color: "white", border: "none", padding: "6px 16px", borderRadius: "2px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}
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
                                )}

                                <AsciiDocRenderer 
                                    content={fileContent} 
                                    filePath={selectedFile} 
                                    onLinkClick={handleFileSelected}
                                />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: "16px", color: "#666" }}>
                            Select an AsciiDoc file from the tree to view its content.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;
