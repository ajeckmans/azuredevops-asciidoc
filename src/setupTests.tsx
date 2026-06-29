/// <reference types="jest" />
import '@testing-library/jest-dom';
import * as React from 'react';

jest.mock("azure-devops-ui/TreeEx", () => ({
    Tree: () => <div />,
    renderExpandableTreeCell: jest.fn()
}));

jest.mock("azure-devops-ui/Utilities/TreeItemProvider", () => ({
    TreeItemProvider: class {
        clear = jest.fn();
        splice = jest.fn();
        toggle = jest.fn();
        value = [];
    }
}));

jest.mock("azure-devops-ui/List", () => ({
    ListSelection: class {
        clear = jest.fn();
        select = jest.fn();
    }
}));

jest.mock("azure-devops-ui/Core/Observable", () => ({
    ObservableValue: class {}
}));

jest.mock('azure-devops-ui/Surface', () => ({
    Surface: ({ children }: any) => <div>{children}</div>,
    SurfaceBackground: { neutral: 'neutral' }
}));

jest.mock('azure-devops-ui/Page', () => ({
    Page: ({ children }: any) => <div>{children}</div>,
    Header: ({ title, description }: any) => <div>{title} - {description}</div>
}));

jest.mock('azure-devops-ui/Card', () => ({
    Card: ({ children }: any) => <div>{children}</div>
}));

jest.mock('azure-devops-ui/TooltipEx', () => ({
    Tooltip: ({ children }: any) => <div>{children}</div>
}));
