/// <reference types="jest" />
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FileTree } from '../FileTree';

jest.mock("azure-devops-ui/TreeEx", () => ({
    Tree: (props: any) => {
        const [items, setItems] = React.useState(props.itemProvider.value || []);
        React.useEffect(() => {
            const listener = () => setItems([...props.itemProvider.value]);
            if (props.itemProvider.subscribe) props.itemProvider.subscribe(listener);
            return () => { if (props.itemProvider.unsubscribe) props.itemProvider.unsubscribe(listener); };
        }, [props.itemProvider]);

        return <div data-testid="mock-tree">
            {items.map((item: any, idx: number) => {
                const data = item.underlyingItem.data;
                return <div key={idx} 
                     data-testid={`tree-item-${data.path}`}
                     onClick={() => props.onSelect(null, { data: item })}>
                    {props.columns[0].renderCell(idx, 0, {}, item)}
                </div>;
            })}
        </div>;
    },
    renderExpandableTreeCell: jest.fn().mockImplementation((_, __, ___, treeItem) => <span>{treeItem.underlyingItem.data.name.textNode || treeItem.underlyingItem.data.name.text}</span>)
}));

jest.mock("azure-devops-ui/Utilities/TreeItemProvider", () => {
    class MockTreeItemProvider {
        items: any[] = [];
        value: any[] = [];
        listeners = new Set<any>();
        subscribe(l: any) { this.listeners.add(l); }
        unsubscribe(l: any) { this.listeners.delete(l); }
        splice = jest.fn((_, __, arr) => {
            if (arr && arr[0] && arr[0].items) {
                this.items = arr[0].items;
                this.value = this.flatten(this.items);
                this.listeners.forEach(l => l());
            }
        });
        clear = jest.fn(() => { this.items = []; this.value = []; this.listeners.forEach(l => l()); });
        
        flatten(items: any[]): any[] {
            let res: any[] = [];
            for (const item of items) {
                res.push({ underlyingItem: item });
                if (item.childItems) {
                    res.push(...this.flatten(item.childItems));
                }
            }
            return res;
        }
    }
    return { TreeItemProvider: MockTreeItemProvider };
});

jest.mock("azure-devops-ui/List", () => ({
    ListSelection: class {
        clear = jest.fn();
        select = jest.fn();
    }
}));

jest.mock("azure-devops-ui/Core/Observable", () => ({
    ObservableValue: class {
        constructor(public value: any) {}
    }
}));

describe('FileTree', () => {
    const mockFiles = [
        { path: '/docs/getting-started.adoc' },
        { path: '/docs/architecture/system.adoc' },
        { path: '/docs/architecture/components.adoc' },
        { path: '/README.adoc' }
    ];

    const mockThreads = [
        { threadContext: { filePath: '/docs/getting-started.adoc' } },
        { threadContext: { filePath: '/docs/getting-started.adoc' } },
        { threadContext: { filePath: '/README.adoc' } }
    ];

    const mockOnFileSelected = jest.fn();
    const mockOnAddComment = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the root files and folders', () => {
        render(<FileTree 
            files={mockFiles} 
            threads={mockThreads} 
            selectedFile={null} 
            onFileSelected={mockOnFileSelected} 
            onAddComment={mockOnAddComment} 
        />);

        // Should see root folder "docs" and root file "README.adoc"
        expect(screen.getByText('docs')).toBeInTheDocument();
        expect(screen.getByText('README.adoc')).toBeInTheDocument();
    });



    it('calls onAddComment when comment button is clicked', () => {
        render(<FileTree 
            files={mockFiles} 
            threads={[]} 
            selectedFile="/README.adoc" 
            onFileSelected={mockOnFileSelected} 
            onAddComment={mockOnAddComment} 
        />);

        // The button should be rendered next to the selected file
        const addCommentButtons = screen.getAllByText('+');
        
        // Find the button with the plus icon
        if (addCommentButtons.length > 0) {
            fireEvent.click(addCommentButtons[0]);
            expect(mockOnAddComment).toHaveBeenCalledWith('/docs/getting-started.adoc');
        }
    });

    it('calls onFileSelected when a file is clicked', () => {
        render(<FileTree 
            files={mockFiles} 
            threads={[]} 
            selectedFile={null} 
            onFileSelected={mockOnFileSelected} 
            onAddComment={mockOnAddComment} 
        />);

        fireEvent.click(screen.getByText('README.adoc'));
        expect(mockOnFileSelected).toHaveBeenCalledWith('/README.adoc');
    });
});
