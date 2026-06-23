/// <reference types="jest" />
import * as React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HubApp from '../HubApp';
import { DevOpsService } from '../services/DevOpsService';
import * as SDK from "azure-devops-extension-sdk";

jest.mock('../services/DevOpsService');
jest.mock('azure-devops-extension-sdk', () => ({
    getService: jest.fn().mockResolvedValue({
        getHash: jest.fn().mockResolvedValue("path=/docs/test.adoc"),
        getQueryParams: jest.fn().mockResolvedValue({}),
        setQueryParams: jest.fn()
    }),
    init: jest.fn().mockResolvedValue(true),
    ready: jest.fn().mockResolvedValue(true)
}));

jest.mock('../components/FileTree', () => ({
    FileTree: ({ onFileSelected }: any) => (
        <div data-testid="mock-file-tree">
            <button onClick={() => onFileSelected('/docs/test.adoc')}>Select File</button>
        </div>
    )
}));

jest.mock("azure-devops-ui/TreeEx", () => ({
    Tree: ({ onSelect }: any) => {
        return (
            <div data-testid="mock-tree">
                <button onClick={() => {
                    const treeRow = { data: { underlyingItem: { data: { repoId: 'repo-1', path: '/docs/test.adoc', isFolder: false, isRepo: false } } } };
                    if (onSelect) onSelect(new Event('click'), treeRow);
                }}>Select File Node</button>
                <button onClick={() => {
                    const treeRow = { data: { underlyingItem: { data: { repoId: 'repo-1', path: '/docs', isFolder: true, isRepo: false } } } };
                    if (onSelect) onSelect(new Event('click'), treeRow);
                }}>Select Folder Node</button>
                <button onClick={() => {
                    const treeRow = { data: { underlyingItem: { data: { repoId: 'repo-1', path: '', isFolder: true, isRepo: true } } } };
                    if (onSelect) onSelect(new Event('click'), treeRow);
                }}>Select Repo Node</button>
            </div>
        );
    },
    renderExpandableTreeCell: jest.fn()
}));

jest.mock('../components/AsciiDocRenderer', () => ({
    AsciiDocRenderer: ({ content, previousContent }: any) => (
        <div data-testid="mock-renderer">
            <div data-testid="content">{content}</div>
        </div>
    )
}));

jest.mock("azure-devops-ui/Spinner", () => ({
    Spinner: ({ label }: any) => <div data-testid="mock-spinner">{label}</div>,
    SpinnerSize: { large: "large" }
}));

describe('HubApp', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (DevOpsService.getRepositoryId as jest.Mock).mockResolvedValue('repo-1');
        (DevOpsService.getProjectName as jest.Mock).mockResolvedValue('proj-1');
        (DevOpsService.getRepositories as jest.Mock).mockResolvedValue([{ id: 'repo-1', name: 'Repo 1', defaultBranch: 'main' }]);
        (DevOpsService.getGlobalRepoState as jest.Mock).mockResolvedValue(null);
        (DevOpsService.setGlobalRepoState as jest.Mock).mockResolvedValue(true);
        (DevOpsService.getRepoFileContent as jest.Mock).mockResolvedValue('Hub Content');
        (DevOpsService.getRepoAsciiDocFiles as jest.Mock).mockResolvedValue([{ path: '/docs/test.adoc' }]);
        (DevOpsService.getFileContent as jest.Mock).mockResolvedValue('Hub Content');
        (DevOpsService.getPreviousFileContent as jest.Mock).mockResolvedValue('');
    });

    it('renders loading state initially', async () => {
        render(<HubApp />);
        expect(screen.getByText('Loading repositories...')).toBeInTheDocument();
        
        await waitFor(() => {
            expect(screen.queryByText('Loading repositories...')).not.toBeInTheDocument();
        });
    });

    it('loads repos and shows placeholder when no file is selected', async () => {
        render(<HubApp />);
        
        await waitFor(() => {
            expect(screen.getByText('Select an AsciiDoc file from the repository tree to view its content.')).toBeInTheDocument();
        });
    });

    it('handles global state and repo selection', async () => {
        // Set up mock to simulate hash containing a path and repo
        (SDK.getService as jest.Mock).mockResolvedValue({
            getHash: jest.fn().mockResolvedValue(""),
            getQueryParams: jest.fn().mockResolvedValue({ repoId: 'repo-1', path: '/docs/test.adoc' }),
            setQueryParams: jest.fn()
        });
        
        render(<HubApp />);
        
        await waitFor(() => {
            expect(DevOpsService.getRepoFileContent).toHaveBeenCalledWith('repo-1', 'proj-1', '/docs/test.adoc');
            expect(screen.getByTestId('mock-renderer')).toBeInTheDocument();
        });
    });

    it('handles file tree node selection', async () => {
        (SDK.getService as jest.Mock).mockResolvedValue({
            getHash: jest.fn().mockResolvedValue(""),
            getQueryParams: jest.fn().mockResolvedValue({}),
            setQueryParams: jest.fn()
        });

        const { container } = render(<HubApp />);
        
        await waitFor(() => {
            expect(screen.getByText('Select File Node')).toBeInTheDocument();
        });

        const fileNodeButton = screen.getByText('Select File Node');
        fireEvent.click(fileNodeButton);

        await waitFor(() => {
            expect(DevOpsService.getRepoFileContent).toHaveBeenCalled();
        });
    });

    it('handles folder tree node selection', async () => {
        (SDK.getService as jest.Mock).mockResolvedValue({
            getHash: jest.fn().mockResolvedValue(""),
            getQueryParams: jest.fn().mockResolvedValue({}),
            setQueryParams: jest.fn()
        });

        render(<HubApp />);
        
        await waitFor(() => {
            expect(screen.getByText('Select Folder Node')).toBeInTheDocument();
        });

        const folderNodeButton = screen.getByText('Select Folder Node');
        fireEvent.click(folderNodeButton);
        
        await waitFor(() => {
            expect(DevOpsService.getRepoFileContent).not.toHaveBeenCalled();
        });
    });

    it('handles repo tree node selection', async () => {
        (SDK.getService as jest.Mock).mockResolvedValue({
            getHash: jest.fn().mockResolvedValue(""),
            getQueryParams: jest.fn().mockResolvedValue({}),
            setQueryParams: jest.fn()
        });

        render(<HubApp />);
        
        await waitFor(() => {
            expect(screen.getByText('Select Repo Node')).toBeInTheDocument();
        });

        const repoNodeButton = screen.getByText('Select Repo Node');
        fireEvent.click(repoNodeButton);
        
        await waitFor(() => {
            expect(DevOpsService.getRepoFileContent).not.toHaveBeenCalled();
        });
    });
});
