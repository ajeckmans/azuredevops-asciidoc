import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient } from "azure-devops-extension-api/Git";

export class DevOpsService {
    public static async getRepositoryId(): Promise<string> {
        const config = SDK.getConfiguration();
        return config.repositoryId;
    }

    public static async getPullRequestId(): Promise<number> {
        const config = SDK.getConfiguration();
        return config.pullRequestId;
    }

    public static async getProjectName(): Promise<string> {
        const cfg: any = SDK.getConfiguration();
        const host: any = SDK.getHost();
        return cfg.project ? cfg.project.name : (host.project ? host.project.name : "");
    }

    public static async getAsciiDocFiles(repositoryId: string, projectName: string): Promise<any[]> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        const pr = await gitClient.getPullRequestById(prId, projectName);
        
        const commitId = pr.lastMergeSourceCommit ? pr.lastMergeSourceCommit.commitId : pr.lastMergeTargetCommit.commitId;
        
        const items = await gitClient.getItems(
            repositoryId,
            projectName,
            "/",
            120 as any, // recursionLevel (Full)
            true, // includeContentMetadata
            false, // latestProcessedChange
            false, // download
            true, // includeLinks
            { versionType: 2, version: commitId, versionOptions: 0 } as any // versionDescriptor
        );

        return items.filter(item => 
            !item.isFolder && 
            (item.path.endsWith(".adoc") || item.path.endsWith(".asciidoc"))
        );
    }

    public static async getFileContent(repositoryId: string, projectName: string, path: string): Promise<string> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        const pr = await gitClient.getPullRequestById(prId, projectName);
        const commitId = pr.lastMergeSourceCommit ? pr.lastMergeSourceCommit.commitId : pr.lastMergeTargetCommit.commitId;

        const contentStream = await gitClient.getItemText(
            repositoryId,
            path,
            projectName,
            undefined, // scopePath
            undefined, // recursionLevel
            undefined, // includeContentMetadata
            undefined, // latestProcessedChange
            undefined, // download
            { versionType: 2, version: commitId, versionOptions: 0 } as any // versionDescriptor
        );
        
        return contentStream;
    }

    public static async createThread(repositoryId: string, projectName: string, filePath: string, content: string): Promise<void> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        
        const thread: any = {
            comments: [
                {
                    parentCommentId: 0,
                    content: content,
                    commentType: 1 // text
                }
            ],
            status: 1, // active
            threadContext: {
                filePath: filePath
            }
        };

        await gitClient.createThread(thread, repositoryId, prId, projectName);
    }

    public static async getThreads(repositoryId: string, projectName: string): Promise<any[]> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        const threads = await gitClient.getThreads(repositoryId, prId, projectName);
        // Filter out deleted/closed/resolved threads. Status 1 is Active, Status 2 is Fixed, 3 is WontFix, 4 is Closed, 5 is ByDesign, 6 is Pending.
        // We only want Active (1) or Pending (6).
        return threads.filter(t => (t.status === 1 || t.status === 6) && t.threadContext && t.threadContext.filePath);
    }

    public static async createComment(repositoryId: string, projectName: string, threadId: number, content: string): Promise<void> {
        const gitClient = getClient(GitRestClient);
        const prId = await this.getPullRequestId();
        
        const comment: any = {
            content: content,
            commentType: 1 // text
        };

        await gitClient.createComment(comment, repositoryId, prId, threadId, projectName);
    }
}
