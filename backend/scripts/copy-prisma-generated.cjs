const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

const sourcePath = path.join(projectRoot, 'src', 'generated', 'prisma');
const destinationPath = path.join(projectRoot, 'dist', 'generated', 'prisma');

function pathExists(targetPath) {
  return fs.existsSync(targetPath);
}

function removeDirectory(targetPath) {
  if (pathExists(targetPath)) {
    fs.rmSync(targetPath, {
      recursive: true,
      force: true,
    });
  }
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, {
    recursive: true,
  });
}

function copyDirectory(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
}

function main() {
  if (!pathExists(sourcePath)) {
    console.error(
      `[Prisma Copy] مسیر Prisma Generated Client پیدا نشد: ${sourcePath}`,
    );
    console.error(
      '[Prisma Copy] ابتدا دستور زیر را اجرا کنید: npx prisma generate',
    );
    process.exit(1);
  }

  ensureDirectory(path.dirname(destinationPath));
  removeDirectory(destinationPath);
  copyDirectory(sourcePath, destinationPath);

  console.log(
    `[Prisma Copy] Prisma Generated Client با موفقیت کپی شد: ${destinationPath}`,
  );
}

main();
