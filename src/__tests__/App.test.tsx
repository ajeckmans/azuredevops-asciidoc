/// <reference types="jest" />
import * as React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import { DevOpsService } from '../services/DevOpsService';
import * as SDK from "azure-devops-extension-sdk";

jest.mock('../services/DevOpsService');
jest.mock('azure-devops-extension-sdk', () => ({
    getService: jest.fn().mockResolvedValue({
        getHash: jest.fn().mockResolvedValue("path=/docs/test.adoc")
    }),
    init: jest.fn().mockResolvedValue(true),
    ready: jest.fn().mockResolvedValue(true)
}));

jest.mock('../components/FileTree', () => ({
    FileTree: ({ onFileSelected }: any) => (
        <div data-testid="mock-file-tree">
            <button onClick={() => onFileSelected('/docs/new.adoc')}>Select File</button>
        </div>
    )
}));

jest.mock('../components/AsciiDocRenderer', () => ({
    AsciiDocRenderer: ({ content, previousContent }: any) => (
        <div data-testid="mock-renderer">
            <div data-testid="content">{content}</div>
            <div data-testid="prev-content">{previousContent}</div>
        </div>
    )
}));



describe('App', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (DevOpsService.getRepositoryId as jest.Mock).mockResolvedValue('repo-1');
        (DevOpsService.getProjectName as jest.Mock).mockResolvedValue('proj-1');
        (DevOpsService.getAsciiDocFiles as jest.Mock).mockResolvedValue([{ path: '/docs/test.adoc' }]);
        (DevOpsService.getThreads as jest.Mock).mockResolvedValue([]);
        (DevOpsService.getFileContent as jest.Mock).mockResolvedValue('Test Content');
        (DevOpsService.getPreviousFileContent as jest.Mock).mockResolvedValue('Old Content');
    });

    it('renders loading state initially', async () => {
        render(<App />);
        expect(screen.getByText('Loading files...')).toBeInTheDocument();
        
        await waitFor(() => {
            expect(screen.queryByText('Loading files...')).not.toBeInTheDocument();
        });
    });

    it('loads and renders the file tree and content based on hash', async () => {
        render(<App />);
        
        await waitFor(() => {
            expect(screen.getByTestId('mock-file-tree')).toBeInTheDocument();
        });

        // Hash points to /docs/test.adoc
        expect(screen.getByTestId('mock-renderer')).toBeInTheDocument();
        expect(screen.getByTestId('content')).toHaveTextContent('Test Content');
    });

    it('handles file selection correctly', async () => {
        render(<App />);
        
        await waitFor(() => {
            expect(screen.getByTestId('mock-file-tree')).toBeInTheDocument();
        });

        // Click the mock button
        const selectButton = screen.getByText('Select File');
        fireEvent.click(selectButton);
        
        await waitFor(() => {
            expect(DevOpsService.getFileContent).toHaveBeenCalledWith('repo-1', 'proj-1', '/docs/new.adoc');
        });
    });

    it('renders threads when available for the selected file', async () => {
        const mockThread = {
            id: 1,
            threadContext: { filePath: '/docs/test.adoc' },
            comments: [
                {
                    id: 101,
                    content: 'Test comment',
                    author: { displayName: 'John Doe', _links: { avatar: { href: 'avatar.png' } } },
                    publishedDate: new Date().toISOString()
                }
            ]
        };
        (DevOpsService.getThreads as jest.Mock).mockResolvedValue([mockThread]);
        
        const { container } = render(<App />);
        
        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('Test comment')).toBeInTheDocument();
        });

        // Simulate reply via Enter key
        const replyInput = screen.getByPlaceholderText('Write a reply...') as HTMLInputElement;
        expect(replyInput).toBeInTheDocument();
        if (replyInput) {
            fireEvent.change(replyInput, { target: { value: 'My reply' } });
            fireEvent.keyDown(replyInput, { key: 'Enter' });

            await waitFor(() => {
                expect(DevOpsService.createComment).toHaveBeenCalledWith('repo-1', 'proj-1', 1, 'My reply');
            });
        }
    });
});
