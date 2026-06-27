import * as React from "react";
import { Card } from "azure-devops-ui/Card";

export interface DiscussionThreadProps {
    thread: any;
    currentUserInitials: string;
    isSubmitting: boolean;
    onReplySubmit: (threadId: number, comment: string) => void;
}

// ⚡ Bolt: Memoize DiscussionThread and pass targeted boolean props
// (isSubmitting) instead of global IDs to prevent O(N) re-rendering across list items
export const DiscussionThread: React.FC<DiscussionThreadProps> = React.memo(({ thread, currentUserInitials, isSubmitting, onReplySubmit }) => {
    return (
        <Card className="margin-bottom-16 flex-column depth-4">
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
                                                            <div className="bolt-coin flex-noshrink repos-comment-header-persona size24" aria-hidden="true">
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
                                                                    <button aria-label="Copy link to comment" className="comment-viewers bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="menuitem" tabIndex={0} type="button">
                                                                        <span className="fluent-icons-enabled"><span aria-hidden="true" className="left-icon flex-noshrink fabric-icon ms-Icon--Link medium"></span></span>
                                                                    </button>
                                                                    {isFirst && (
                                                                        <>
                                                                            <button aria-label="Resolve thread" className="comment-viewers bolt-button bolt-icon-button enabled subtle icon-only bolt-focus-treatment" role="menuitem" tabIndex={0} type="button">
                                                                                <span className="fluent-icons-enabled"><span aria-hidden="true" className="left-icon flex-noshrink fabric-icon ms-Icon--PageCheckedin medium"></span></span>
                                                                            </button>
                                                                            <div className="bolt-dropdown-expandable bolt-expandable-button inline-flex-row">
                                                                                <button aria-label="Thread status" aria-expanded="false" aria-haspopup="true" className="bolt-button enabled subtle bolt-focus-treatment" role="button" tabIndex={0} type="button">
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
                                            <div className="bolt-coin flex-noshrink margin-right-4 margin-top-4 size24" aria-hidden="true">
                                                <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#107c41", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>
                                                    {currentUserInitials}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-row flex-grow flex-center rhythm-horizontal-8 repos-comment-editor-max-width">
                                            <div className="flex-column flex-grow padding-vertical-4">
                                                <div className="bolt-textfield flex-row flex-center focus-treatment">
                                                    <input 
                                                        id={`reply-box-${thread.id}`}
                                                        className={`threadId-${thread.id} bolt-textfield-input flex-grow`}
                                                        style={{ backgroundColor: "transparent", color: "var(--text-primary-color, inherit)", opacity: isSubmitting ? 0.6 : 1 }}
                                                        autoComplete="off" 
                                                        placeholder="Write a reply..." 
                                                        aria-label="Write a reply"
                                                        disabled={isSubmitting}
                                                        tabIndex={0} 
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const val = (e.target as HTMLInputElement).value;
                                                                if (val) {
                                                                    onReplySubmit(thread.id, val);
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
                                                disabled={isSubmitting}
                                                style={{ background: "rgba(0,0,0,0.06)", border: "none", opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? "not-allowed" : "pointer" }}
                                                onClick={() => {
                                                    const input = document.getElementById(`reply-box-${thread.id}`) as HTMLInputElement;
                                                    if (input && input.value) {
                                                        onReplySubmit(thread.id, input.value);
                                                    }
                                                }}
                                            >
                                                {isSubmitting ? "Replying..." : "Reply"}
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
    );
});
