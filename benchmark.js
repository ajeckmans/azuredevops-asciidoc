const { performance } = require('perf_hooks');

// Simulating the original O(N*M) behavior
function originalBuildTreeItems(files, threads) {
    const root = [];
    const nodeMap = new Map();

    files.forEach(file => {
        const cleanPath = file.path.startsWith("/") ? file.path.substring(1) : file.path;
        const parts = cleanPath.split("/");

        let currentLevel = root;
        let currentPath = "";

        parts.forEach((part, index) => {
            currentPath += (currentPath === "" ? "" : "/") + part;
            const isFolder = index < parts.length - 1;

            let existingNode = nodeMap.get(currentPath);

            if (!existingNode) {
                const nodePath = "/" + currentPath;
                const newNode = { path: nodePath, childItems: [] };
                existingNode = newNode;

                if (!isFolder) {
                    // This is the bottleneck
                    const fileThreads = threads.filter(t => t.threadContext && t.threadContext.filePath === nodePath);
                    if (fileThreads.length > 0) {
                        existingNode.childItems = fileThreads.map(thread => ({ data: 'comment' }));
                    }
                }

                nodeMap.set(currentPath, existingNode);
                currentLevel.push(existingNode);
            }

            if (isFolder && existingNode.childItems) {
                currentLevel = existingNode.childItems;
            }
        });
    });
    return root;
}

// Simulating the optimized O(N+M) behavior
function optimizedBuildTreeItems(files, threads) {
    const root = [];
    const nodeMap = new Map();

    // ⚡ Bolt: Replace O(n²) nested loop with O(n) hash map lookup
    const threadsByPath = new Map();
    threads.forEach(t => {
        if (t.threadContext && t.threadContext.filePath) {
            const path = t.threadContext.filePath;
            if (!threadsByPath.has(path)) {
                threadsByPath.set(path, []);
            }
            threadsByPath.get(path).push(t);
        }
    });

    files.forEach(file => {
        const cleanPath = file.path.startsWith("/") ? file.path.substring(1) : file.path;
        const parts = cleanPath.split("/");

        let currentLevel = root;
        let currentPath = "";

        parts.forEach((part, index) => {
            currentPath += (currentPath === "" ? "" : "/") + part;
            const isFolder = index < parts.length - 1;

            let existingNode = nodeMap.get(currentPath);

            if (!existingNode) {
                const nodePath = "/" + currentPath;
                const newNode = { path: nodePath, childItems: [] };
                existingNode = newNode;

                if (!isFolder) {
                    const fileThreads = threadsByPath.get(nodePath) || [];
                    if (fileThreads.length > 0) {
                        existingNode.childItems = fileThreads.map(thread => ({ data: 'comment' }));
                    }
                }

                nodeMap.set(currentPath, existingNode);
                currentLevel.push(existingNode);
            }

            if (isFolder && existingNode.childItems) {
                currentLevel = existingNode.childItems;
            }
        });
    });

    return root;
}

function generateMockData(numFiles, numThreads) {
    const files = [];
    for (let i = 0; i < numFiles; i++) {
        files.push({ path: `/src/components/feature/file_${i}.adoc` });
    }

    const threads = [];
    for (let i = 0; i < numThreads; i++) {
        // Distribute threads randomly across files
        const fileIndex = Math.floor(Math.random() * numFiles);
        threads.push({
            id: i,
            threadContext: {
                filePath: `/src/components/feature/file_${fileIndex}.adoc`
            }
        });
    }

    return { files, threads };
}

function runBenchmark(name, numFiles, numThreads) {
    console.log(`\n--- Benchmark: ${name} (${numFiles} files, ${numThreads} threads) ---`);
    const { files, threads } = generateMockData(numFiles, numThreads);

    // Warmup
    originalBuildTreeItems(files, threads);
    optimizedBuildTreeItems(files, threads);

    const ITERATIONS = 100;

    const startOriginal = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
        originalBuildTreeItems(files, threads);
    }
    const endOriginal = performance.now();
    const timeOriginal = (endOriginal - startOriginal) / ITERATIONS;

    const startOptimized = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
        optimizedBuildTreeItems(files, threads);
    }
    const endOptimized = performance.now();
    const timeOptimized = (endOptimized - startOptimized) / ITERATIONS;

    console.log(`Original approach:  ${timeOriginal.toFixed(2)} ms / execution`);
    console.log(`Optimized approach: ${timeOptimized.toFixed(2)} ms / execution`);
    console.log(`Speedup:            ${(timeOriginal / timeOptimized).toFixed(2)}x faster`);
}

// Small PR: 10 files, 5 comments
runBenchmark("Small PR", 10, 5);

// Medium PR: 100 files, 50 comments
runBenchmark("Medium PR", 100, 50);

// Large PR: 1000 files, 500 comments
runBenchmark("Large PR", 1000, 500);
