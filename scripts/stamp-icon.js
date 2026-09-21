const { execFileSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')

const rcedit = path.join('node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe')
const icon = path.join('build', 'icon.ico')
const files = process.argv.slice(2).filter((file) => existsSync(file))
if (!files.length) {
  console.error('stamp-icon: укажите exe внутри win-unpacked, не готовый установщик')
  process.exit(1)
}

for (const file of files) {
  execFileSync(rcedit, [file, '--set-icon', icon], { stdio: 'inherit' })
}
