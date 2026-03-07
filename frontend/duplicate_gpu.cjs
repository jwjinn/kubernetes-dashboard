const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.replace(new RegExp(search, 'g'), replace);
    }
    fs.writeFileSync(filePath, content);
}

// 1. Copy features/gpu to features/npu
fs.cpSync('./src/features/gpu', './src/features/npu', { recursive: true });

// Rename files in features/npu
const npuDir = './src/features/npu/components';
const files = fs.readdirSync(npuDir);
files.forEach(file => {
    if (file.includes('Gpu')) {
        const newName = file.replace(/Gpu/g, 'Npu');
        fs.renameSync(path.join(npuDir, file), path.join(npuDir, newName));
    }
});

// Replace content in features/npu
const replaceMap = [
    ['Gpu', 'Npu'],
    ['gpu', 'npu'],
    ['GPU', 'NPU']
];
fs.readdirSync(npuDir).forEach(file => {
    replaceInFile(path.join(npuDir, file), replaceMap);
});

// 2. Copy Pages
fs.copyFileSync('./src/pages/GpuDashboardPage.tsx', './src/pages/NpuDashboardPage.tsx');
fs.copyFileSync('./src/pages/GpuTrendPage.tsx', './src/pages/NpuTrendPage.tsx');

replaceInFile('./src/pages/NpuDashboardPage.tsx', replaceMap);
replaceInFile('./src/pages/NpuTrendPage.tsx', replaceMap);

console.log('Duplication complete');
