import { containsPlantUml, renderPlantUml } from "../PlantUmlService";

// Mock the vendor plantuml.js module
const mockRenderToString = jest.fn();
jest.mock("../../vendor/plantuml.js", () => ({
    renderToString: (...args: any[]) => mockRenderToString(...args)
}), { virtual: true });

describe("PlantUmlService", () => {
    beforeEach(() => {
        mockRenderToString.mockReset();
    });

    describe("containsPlantUml", () => {
        it("detects [plantuml] block attribute", () => {
            expect(containsPlantUml("[plantuml, test, svg]\n----\nBob -> Alice\n----")).toBe(true);
        });

        it("detects [c4plantuml] block attribute", () => {
            expect(containsPlantUml("[c4plantuml]\n----\nPerson(a, 'b')\n----")).toBe(true);
        });

        it("detects @startuml marker", () => {
            expect(containsPlantUml("@startuml\nAlice -> Bob\n@enduml")).toBe(true);
        });

        it("returns false for plain AsciiDoc text without diagrams", () => {
            expect(containsPlantUml("= Document Title\n\nSome normal paragraph text.")).toBe(false);
        });
    });

    describe("renderPlantUml", () => {
        it("renders diagram and returns SVG string", async () => {
            mockRenderToString.mockImplementation((lines, onSuccess, onError, options) => {
                onSuccess("<svg><text>Rendered Diagram</text></svg>");
            });

            const svg = await renderPlantUml("Alice -> Bob : hello");
            expect(svg).toBe("<svg><text>Rendered Diagram</text></svg>");
            expect(mockRenderToString).toHaveBeenCalledWith(
                ["@startuml", "Alice -> Bob : hello", "@enduml"],
                expect.any(Function),
                expect.any(Function),
                { dark: false }
            );
        });

        it("passes dark option to renderer", async () => {
            mockRenderToString.mockImplementation((lines, onSuccess, onError, options) => {
                onSuccess("<svg data-theme='dark'></svg>");
            });

            const svg = await renderPlantUml("Alice -> Bob : dark", { dark: true });
            expect(svg).toBe("<svg data-theme='dark'></svg>");
            expect(mockRenderToString).toHaveBeenCalledWith(
                expect.any(Array),
                expect.any(Function),
                expect.any(Function),
                { dark: true }
            );
        });

        it("rejects when renderToString calls error callback", async () => {
            mockRenderToString.mockImplementation((lines, onSuccess, onError, options) => {
                onError("Syntax Error on line 2");
            });

            await expect(renderPlantUml("invalid syntax diagram")).rejects.toThrow("Syntax Error on line 2");
        });
    });
});
