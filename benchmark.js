const { performance } = require('perf_hooks');

const NUM_REPOS = 100000;
const NUM_WITH_ASCIIDOC = 50000;

// Setup mock data
const allRepos = [];
for (let i = 0; i < NUM_REPOS; i++) {
    allRepos.push({ id: `repo-${i}`, name: `Repository ${i}` });
}

const reposWithAsciidoc = [];
for (let i = 0; i < NUM_WITH_ASCIIDOC; i++) {
    reposWithAsciidoc.push(`repo-${i * 2}`); // Pick every other repo
}

const globalState = { reposWithAsciidoc };

// Baseline
const startBaseline = performance.now();
const finalReposBaseline = allRepos.filter(r => globalState.reposWithAsciidoc.includes(r.id));
const endBaseline = performance.now();
console.log(`Baseline (Array.includes): ${endBaseline - startBaseline} ms`);

// Optimized
const startOptimized = performance.now();
const reposWithAsciidocSet = new Set(globalState.reposWithAsciidoc);
const finalReposOptimized = allRepos.filter(r => reposWithAsciidocSet.has(r.id));
const endOptimized = performance.now();
console.log(`Optimized (Set.has): ${endOptimized - startOptimized} ms`);

console.log(`Results match: ${finalReposBaseline.length === finalReposOptimized.length}`);
